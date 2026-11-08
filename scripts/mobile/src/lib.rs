//! `mobile` 命令背后的 Android 模拟器逻辑。
//!
//! 移动端脚本集中在同一个 crate：`src/main.rs` 解析子命令
//! （`doctor`、`up`、`smoke` 等），本模块负责 SDK / adb / emulator 的公共操作。
//!
//! 这个 crate 刻意只使用标准库：开发机没有 Node.js、仓库放在任意路径时也能运行。

use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub type Result<T> = std::result::Result<T, String>;

const DEFAULT_AVD: &str = "tn_test";
const DEFAULT_PACKAGE: &str = "com.youyou.taurinotes";
const DEFAULT_ACTIVITY: &str = ".MainActivity";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(180);

fn exe_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

fn project_root() -> PathBuf {
    let start = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut current = start.as_path();
    loop {
        if current.join("package.json").is_file() {
            return current.to_path_buf();
        }
        current = current
            .parent()
            .expect("scripts/mobile 必须位于仓库根目录下");
    }
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
}

fn is_sdk(path: &Path) -> bool {
    path.join("platform-tools").join(exe_name("adb")).is_file()
}

fn sdk_from_path() -> Option<PathBuf> {
    let finder = if cfg!(windows) { "where" } else { "which" };
    let output = Command::new(finder).arg("adb").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let adb = stdout.lines().next()?.trim();
    if adb.is_empty() {
        return None;
    }
    Path::new(adb).parent()?.parent().map(Path::to_path_buf)
}

fn common_sdk_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let home = home_dir();
    if cfg!(windows) {
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            candidates.push(PathBuf::from(local).join("Android").join("Sdk"));
        }
        if let Some(home) = &home {
            candidates.push(
                home.join("AppData")
                    .join("Local")
                    .join("Android")
                    .join("Sdk"),
            );
        }
        for letter in b'C'..=b'Z' {
            let drive = format!("{}:\\", letter as char);
            candidates.push(PathBuf::from(&drive).join("Android").join("sdk"));
            candidates.push(PathBuf::from(&drive).join("Android").join("Sdk"));
            candidates.push(PathBuf::from(&drive).join("android-sdk"));
            candidates.push(PathBuf::from(&drive).join("Sdk"));
        }
    } else {
        if let Some(home) = &home {
            candidates.push(home.join("Library").join("Android").join("sdk"));
            candidates.push(home.join("Android").join("Sdk"));
        }
        candidates.push(PathBuf::from("/usr/local/lib/android/sdk"));
        candidates.push(PathBuf::from("/opt/android-sdk"));
    }
    candidates
}

fn dedup_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut output: Vec<PathBuf> = Vec::new();
    for path in paths {
        if !output.iter().any(|existing| existing == &path) {
            output.push(path);
        }
    }
    output
}

pub struct Sdk {
    pub root: PathBuf,
}

impl Sdk {
    pub fn discover(explicit: Option<&Path>) -> Result<Self> {
        if let Some(path) = explicit {
            if !is_sdk(path) {
                return Err(format!(
                    "指定的 SDK 不可用：{}（缺少 platform-tools/adb）",
                    path.display()
                ));
            }
            return Ok(Self {
                root: path.to_path_buf(),
            });
        }

        let mut candidates = Vec::new();
        for key in ["ANDROID_HOME", "ANDROID_SDK_ROOT", "ANDROID_SDK"] {
            if let Some(value) = env::var_os(key) {
                candidates.push(PathBuf::from(value));
            }
        }
        if let Some(path) = sdk_from_path() {
            candidates.push(path);
        }
        candidates.extend(common_sdk_candidates());

        dedup_paths(candidates)
            .into_iter()
            .find(|path| is_sdk(path))
            .map(|root| Self { root })
            .ok_or_else(|| {
                "未找到 Android SDK。请设置 ANDROID_HOME / ANDROID_SDK_ROOT，或用 --sdk 指定 SDK 路径。"
                    .to_string()
            })
    }

    pub fn adb(&self) -> PathBuf {
        self.root.join("platform-tools").join(exe_name("adb"))
    }

    pub fn emulator(&self) -> PathBuf {
        self.root.join("emulator").join(exe_name("emulator"))
    }

    pub fn tool_env(&self) -> Vec<(OsString, OsString)> {
        vec![
            ("ANDROID_HOME".into(), self.root.as_os_str().to_os_string()),
            (
                "ANDROID_SDK_ROOT".into(),
                self.root.as_os_str().to_os_string(),
            ),
        ]
    }

    fn adb_command(&self, serial: Option<&str>) -> Command {
        let mut command = Command::new(self.adb());
        if let Some(serial) = serial {
            command.arg("-s").arg(serial);
        }
        command
    }

    /// 提前启动 adb server，避免它继承调用方的输出管道导致命令不退出。
    fn start_adb_server(&self) {
        let _ = Command::new(self.adb())
            .arg("start-server")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }

    pub fn adb_text(&self, serial: Option<&str>, args: &[&str]) -> Result<String> {
        let mut command = self.adb_command(serial);
        command.args(args);
        run_checked(command)
    }

    pub fn adb_bytes(&self, serial: Option<&str>, args: &[&str]) -> Result<Vec<u8>> {
        let mut command = self.adb_command(serial);
        command.args(args);
        let output = command
            .output()
            .map_err(|error| format!("执行 adb 失败：{error}"))?;
        if !output.status.success() {
            return Err(format!(
                "adb {} 失败：{}",
                args.join(" "),
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(output.stdout)
    }
}

fn run_checked(mut command: Command) -> Result<String> {
    let output = command
        .output()
        .map_err(|error| format!("执行命令失败：{error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim()
        } else {
            stderr.trim()
        };
        return Err(format!("命令失败（{}）：{detail}", output.status));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[derive(Debug, Clone)]
pub struct Device {
    pub serial: String,
    pub state: String,
}

fn list_devices(sdk: &Sdk) -> Result<Vec<Device>> {
    let output = sdk.adb_text(None, &["devices"])?;
    let devices = output
        .lines()
        .skip(1)
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let mut parts = line.split_whitespace();
            let serial = parts.next()?.to_string();
            let state = parts.next()?.to_string();
            Some(Device { serial, state })
        })
        .collect();
    Ok(devices)
}

fn format_devices(devices: &[Device]) -> String {
    if devices.is_empty() {
        return "（无）".to_string();
    }
    devices
        .iter()
        .map(|device| format!("  {}\t{}", device.serial, device.state))
        .collect::<Vec<_>>()
        .join("\n")
}

fn choose_device(sdk: &Sdk, options: &Options) -> Result<String> {
    let devices = list_devices(sdk)?;
    if let Some(requested) = &options.device {
        if devices.iter().any(|device| &device.serial == requested) {
            return Ok(requested.clone());
        }
        return Err(format!(
            "没有找到设备 {requested}。\n{}",
            format_devices(&devices)
        ));
    }
    let ready: Vec<&Device> = devices
        .iter()
        .filter(|device| device.state == "device")
        .collect();
    match ready.as_slice() {
        [] => Err(format!(
            "没有可用设备。\n{}\n先运行：cargo run -p mobile -- start --sdk <sdk>",
            format_devices(&devices)
        )),
        [device] => Ok(device.serial.clone()),
        _ => Err(format!(
            "检测到多个设备，请用 --device 指定：\n{}",
            format_devices(&devices)
        )),
    }
}

fn wait_for_device(sdk: &Sdk, timeout: Duration) -> Result<String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Ok(devices) = list_devices(sdk) {
            if let Some(device) = devices.iter().find(|device| device.state == "device") {
                return Ok(device.serial.clone());
            }
        }
        sleep(Duration::from_millis(1500));
    }
    Err("等待模拟器连接超时。".to_string())
}

fn wait_for_boot(sdk: &Sdk, serial: &str, timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    let mut last = String::new();
    while Instant::now() < deadline {
        if let Ok(value) = sdk.adb_text(Some(serial), &["shell", "getprop", "sys.boot_completed"]) {
            last = value;
            if last.trim() == "1" {
                return Ok(());
            }
        }
        sleep(Duration::from_secs(2));
    }
    Err(format!("等待 Android 启动超时（最后状态：{last}）。"))
}

fn adb_install(sdk: &Sdk, serial: &str, apk: &Path) -> Result<()> {
    let output = sdk.adb_text(Some(serial), &["install", "-r", &apk.to_string_lossy()])?;
    if output.to_lowercase().contains("failure") {
        return Err(format!("安装失败：{output}"));
    }
    Ok(())
}

fn apk_base_dir() -> PathBuf {
    project_root()
        .join("src-tauri")
        .join("gen")
        .join("android")
        .join("app")
        .join("build")
        .join("outputs")
        .join("apk")
}

fn find_latest_apk_in(base: &Path) -> Option<PathBuf> {
    if !base.is_dir() {
        return None;
    }

    fn walk(dir: &Path, found: &mut Vec<(SystemTime, PathBuf)>) {
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(&path, found);
            } else if path.extension().and_then(|value| value.to_str()) == Some("apk") {
                let modified = fs::metadata(&path)
                    .and_then(|metadata| metadata.modified())
                    .unwrap_or(UNIX_EPOCH);
                found.push((modified, path));
            }
        }
    }

    let mut found = Vec::new();
    walk(base, &mut found);
    found.sort_by_key(|left| std::cmp::Reverse(left.0));
    found.first().map(|(_, path)| path.clone())
}

fn find_latest_apk() -> Option<PathBuf> {
    find_latest_apk_in(&apk_base_dir())
}

fn apk_dir_for_abi(abi: &str) -> Option<&'static str> {
    match abi.trim() {
        "x86_64" => Some("x86_64"),
        "arm64-v8a" => Some("arm64"),
        "armeabi-v7a" => Some("arm"),
        "x86" => Some("x86"),
        _ => None,
    }
}

fn resolve_apk(sdk: &Sdk, serial: &str, options: &Options) -> Result<PathBuf> {
    if let Some(path) = &options.apk {
        if path.is_file() {
            return Ok(path.clone());
        }
        return Err(format!("APK 不存在：{}", path.display()));
    }

    let abi = sdk
        .adb_text(Some(serial), &["shell", "getprop", "ro.product.cpu.abi"])
        .unwrap_or_default();
    apk_dir_for_abi(&abi)
        .and_then(|dir| find_latest_apk_in(&apk_base_dir().join(dir)))
        .or_else(find_latest_apk)
        .ok_or_else(|| "未找到 APK。请用 --apk 指定路径，或先构建 Android 工程。".to_string())
}

fn package_installed(sdk: &Sdk, serial: &str) -> Result<bool> {
    let output = sdk.adb_text(
        Some(serial),
        &["shell", "pm", "list", "packages", DEFAULT_PACKAGE],
    )?;
    let expected = format!("package:{DEFAULT_PACKAGE}");
    Ok(output.lines().any(|line| line.trim() == expected))
}

fn ensure_installed(sdk: &Sdk, serial: &str, options: &Options) -> Result<()> {
    if package_installed(sdk, serial)? {
        return Ok(());
    }
    let apk = resolve_apk(sdk, serial, options)?;
    println!("应用未安装，先安装 {}（{serial}）…", apk.display());
    adb_install(sdk, serial, &apk)?;
    println!("安装完成。");
    Ok(())
}

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn launch(sdk: &Sdk, options: &Options) -> Result<()> {
    let serial = choose_device(sdk, options)?;
    if !package_installed(sdk, &serial)? {
        return Err(format!(
            "应用未安装（{serial}）。请先运行 mobile up，或 mobile install --device {serial}。"
        ));
    }
    println!("启动 {DEFAULT_PACKAGE}/{DEFAULT_ACTIVITY}（{serial}）…");
    sdk.adb_text(
        Some(&serial),
        &[
            "shell",
            "am",
            "start",
            "-W",
            "-n",
            &format!("{DEFAULT_PACKAGE}/{DEFAULT_ACTIVITY}"),
        ],
    )?;
    println!("应用已启动。");
    Ok(())
}

fn start(sdk: &Sdk, options: &Options) -> Result<()> {
    let existing = list_devices(sdk)?;
    if existing.iter().any(|device| device.state == "device") && !options.force {
        println!("已有可用设备，跳过启动：\n{}", format_devices(&existing));
        if options.launch {
            let serial = choose_device(sdk, options)?;
            ensure_installed(sdk, &serial, options)?;
            launch(sdk, options)?;
        }
        return Ok(());
    }
    if options.force {
        stop(sdk, options)?;
        sleep(Duration::from_secs(3));
    }

    let avd = &options.avd;
    let emulator = sdk.emulator();
    if !emulator.is_file() {
        return Err(format!(
            "未找到 emulator：{}\n请先安装 Android Emulator。",
            emulator.display()
        ));
    }

    let mut command = Command::new(&emulator);
    command
        .arg("-avd")
        .arg(avd)
        .arg("-no-audio")
        .arg("-no-boot-anim")
        .arg("-gpu")
        .arg(&options.gpu)
        .arg("-accel")
        .arg("on")
        .arg("-no-snapshot");
    if options.headless {
        command.arg("-no-window");
    }

    // 保留模拟器输出，启动失败时可以直接看日志。
    let log_path = project_root()
        .join(".tmp")
        .join("mobile")
        .join("emulator.log");
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建模拟器日志目录失败：{error}"))?;
    }
    let log =
        fs::File::create(&log_path).map_err(|error| format!("创建模拟器日志失败：{error}"))?;
    let log_err = log
        .try_clone()
        .map_err(|error| format!("复制模拟器日志句柄失败：{error}"))?;

    command
        .envs(sdk.tool_env())
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));

    println!(
        "启动 AVD {}{}…",
        avd,
        if options.headless {
            "（无窗口）"
        } else {
            ""
        }
    );
    println!("模拟器日志：{}", log_path.display());
    let mut child = command
        .spawn()
        .map_err(|error| format!("启动模拟器失败：{error}"))?;

    let serial = match wait_for_device(sdk, options.timeout) {
        Ok(serial) => serial,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("{error}\n模拟器日志：{}", log_path.display()));
        }
    };
    wait_for_boot(sdk, &serial, options.timeout)?;
    println!("模拟器就绪：{serial}");

    if options.launch {
        ensure_installed(sdk, &serial, options)?;
        launch(sdk, options)?;
    }
    Ok(())
}

fn stop(sdk: &Sdk, _options: &Options) -> Result<()> {
    let devices = list_devices(sdk)?;
    if devices.is_empty() {
        println!("没有运行中的模拟器。");
        return Ok(());
    }
    for device in devices {
        match sdk.adb_text(Some(&device.serial), &["emu", "kill"]) {
            Ok(_) => println!("已关闭 {}。", device.serial),
            Err(_) => println!("关闭 {} 失败（可能不是 emulator）。", device.serial),
        }
    }
    Ok(())
}

fn install(sdk: &Sdk, options: &Options) -> Result<()> {
    let serial = choose_device(sdk, options)?;
    let apk = resolve_apk(sdk, &serial, options)?;
    println!("安装 {}（{serial}）…", apk.display());
    adb_install(sdk, &serial, &apk)?;
    println!("安装完成。");
    Ok(())
}

fn screenshot(sdk: &Sdk, options: &Options) -> Result<PathBuf> {
    let serial = choose_device(sdk, options)?;
    let output = if let Some(path) = &options.out {
        path.clone()
    } else {
        project_root()
            .join("test-artifacts")
            .join("mobile")
            .join(format!("mobile-{}.png", timestamp()))
    };
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建截图目录失败：{error}"))?;
    }
    let bytes = sdk.adb_bytes(Some(&serial), &["exec-out", "screencap", "-p"])?;
    fs::write(&output, bytes).map_err(|error| format!("写入截图失败：{error}"))?;
    println!("{}", output.display());
    Ok(output)
}

fn reset(sdk: &Sdk, options: &Options) -> Result<()> {
    let serial = choose_device(sdk, options)?;
    sdk.adb_text(Some(&serial), &["shell", "pm", "clear", DEFAULT_PACKAGE])?;
    println!("已清除 {DEFAULT_PACKAGE} 的应用数据。");
    Ok(())
}

fn smoke(sdk: &Sdk, options: &Options) -> Result<()> {
    launch(sdk, options)?;
    sleep(Duration::from_millis(options.wait_ms));
    let serial = choose_device(sdk, options)?;
    let output = sdk.adb_text(
        Some(&serial),
        &["shell", "dumpsys", "activity", "activities"],
    )?;
    let resumed = output
        .lines()
        .find(|line| line.contains("topResumedActivity") || line.contains("mResumedActivity"))
        .ok_or_else(|| "未找到 resumed activity。".to_string())?;
    if !resumed.contains(DEFAULT_PACKAGE) {
        return Err(format!("应用未成为前台 Activity。\n{resumed}"));
    }
    println!("前台 Activity：{}", resumed.trim());
    screenshot(sdk, options)?;
    Ok(())
}

fn doctor(sdk: &Sdk) -> Result<()> {
    println!("platform: {}", env::consts::OS);
    println!("sdk: {}", sdk.root.display());
    println!("adb: {}", sdk.adb().display());
    println!("emulator: {}", sdk.emulator().display());
    println!("devices:\n{}", format_devices(&list_devices(sdk)?));

    if sdk.emulator().is_file() {
        let output = Command::new(sdk.emulator())
            .arg("-list-avds")
            .envs(sdk.tool_env())
            .output()
            .map_err(|error| format!("读取 AVD 失败：{error}"))?;
        let avds = String::from_utf8_lossy(&output.stdout);
        println!(
            "avds:\n{}",
            if avds.trim().is_empty() {
                "（无）"
            } else {
                avds.trim()
            }
        );
    } else {
        println!("avds:\n（emulator 未安装）");
    }
    println!(
        "latest apk: {}",
        find_latest_apk()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|| "（未找到，需先构建）".to_string())
    );
    Ok(())
}

#[derive(Debug, Clone)]
pub struct Options {
    pub sdk: Option<PathBuf>,
    pub avd: String,
    pub device: Option<String>,
    pub headless: bool,
    pub force: bool,
    pub launch: bool,
    pub timeout: Duration,
    pub wait_ms: u64,
    pub apk: Option<PathBuf>,
    pub out: Option<PathBuf>,
    pub gpu: String,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            sdk: None,
            avd: DEFAULT_AVD.to_string(),
            device: None,
            headless: false,
            force: false,
            launch: false,
            timeout: DEFAULT_TIMEOUT,
            wait_ms: 2500,
            apk: None,
            out: None,
            gpu: "swiftshader_indirect".to_string(),
        }
    }
}

fn take_value(
    args: &[String],
    index: &mut usize,
    inline: Option<&str>,
    key: &str,
) -> Result<String> {
    if let Some(value) = inline {
        if value.is_empty() {
            return Err(format!("--{key} 需要一个值"));
        }
        return Ok(value.to_string());
    }
    *index += 1;
    args.get(*index)
        .cloned()
        .ok_or_else(|| format!("--{key} 需要一个值"))
}

impl Options {
    pub fn parse(args: &[String]) -> Result<Self> {
        let mut options = Self::default();
        let mut index = 0;
        while index < args.len() {
            let arg = &args[index];
            let rest = arg
                .strip_prefix("--")
                .ok_or_else(|| format!("未知参数：{arg}"))?;
            let (key, inline) = match rest.split_once('=') {
                Some((key, value)) => (key, Some(value)),
                None => (rest, None),
            };
            match key {
                "sdk" => {
                    options.sdk = Some(PathBuf::from(take_value(args, &mut index, inline, key)?))
                }
                "avd" => options.avd = take_value(args, &mut index, inline, key)?,
                "device" => options.device = Some(take_value(args, &mut index, inline, key)?),
                "apk" => {
                    options.apk = Some(PathBuf::from(take_value(args, &mut index, inline, key)?))
                }
                "out" => {
                    options.out = Some(PathBuf::from(take_value(args, &mut index, inline, key)?))
                }
                "gpu" => options.gpu = take_value(args, &mut index, inline, key)?,
                "timeout" => {
                    let value = take_value(args, &mut index, inline, key)?;
                    options.timeout = Duration::from_secs(
                        value
                            .parse()
                            .map_err(|_| format!("--timeout 需要秒数：{value}"))?,
                    );
                }
                "wait" => {
                    let value = take_value(args, &mut index, inline, key)?;
                    let seconds: f64 = value
                        .parse()
                        .map_err(|_| format!("--wait 需要秒数：{value}"))?;
                    options.wait_ms = (seconds * 1000.0) as u64;
                }
                "headless" | "no-window" => options.headless = true,
                "force" => options.force = true,
                "launch" => options.launch = true,
                other => return Err(format!("未知参数：--{other}")),
            }
            index += 1;
        }
        Ok(options)
    }
}

/// 同一类脚本共用一个 crate，命令以子命令形式暴露给 `mobile`。
const COMMANDS: &[(&str, &str)] = &[
    ("doctor", "检查 SDK、设备、AVD、APK"),
    ("devices", "列出已连接设备"),
    ("start", "启动模拟器"),
    ("up", "启动模拟器并打开应用"),
    ("launch", "打开已安装应用"),
    ("install", "安装 APK"),
    ("screenshot", "截图"),
    ("reset", "清空应用数据"),
    ("stop", "关闭模拟器"),
    ("smoke", "前台检查并截图"),
];

fn command_summary(command: &str) -> Option<&'static str> {
    COMMANDS
        .iter()
        .find(|entry| entry.0 == command)
        .map(|entry| entry.1)
}

pub fn run(args: &[String]) -> Result<()> {
    let Some((command, rest)) = args.split_first() else {
        print_help(None);
        return Ok(());
    };
    let command = command.as_str();

    if matches!(command, "help" | "--help" | "-h") {
        print_help(None);
        return Ok(());
    }

    if command_summary(command).is_none() {
        return Err(format!(
            "未知命令：{command}\n\n可用命令：{}\n运行 `mobile --help` 查看用法。",
            COMMANDS
                .iter()
                .map(|entry| entry.0)
                .collect::<Vec<_>>()
                .join(" / ")
        ));
    }

    if rest.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help(Some(command));
        return Ok(());
    }

    prepare_temp_dir()?;
    dispatch(command, rest)
}

/// 把 adb / emulator 的临时文件放到项目内，避免系统 TEMP 的权限问题。
fn prepare_temp_dir() -> Result<()> {
    let temp = project_root().join(".tmp").join("mobile");
    fs::create_dir_all(&temp).map_err(|error| format!("创建移动端临时目录失败：{error}"))?;
    env::set_var("TEMP", &temp);
    env::set_var("TMP", &temp);
    Ok(())
}

fn dispatch(command: &str, args: &[String]) -> Result<()> {
    let options = Options::parse(args)?;
    let sdk = Sdk::discover(options.sdk.as_deref())?;
    sdk.start_adb_server();
    match command {
        "doctor" => doctor(&sdk),
        "devices" => {
            println!("{}", format_devices(&list_devices(&sdk)?));
            Ok(())
        }
        "start" => start(&sdk, &options),
        "up" => {
            let mut with_launch = options.clone();
            with_launch.launch = true;
            start(&sdk, &with_launch)
        }
        "launch" => launch(&sdk, &options),
        "stop" => stop(&sdk, &options),
        "install" => install(&sdk, &options),
        "screenshot" => {
            screenshot(&sdk, &options)?;
            Ok(())
        }
        "reset" => reset(&sdk, &options),
        "smoke" => smoke(&sdk, &options),
        other => Err(format!("未知命令：{other}")),
    }
}

pub fn print_help(command: Option<&str>) {
    match command {
        Some(command) => {
            println!("mobile {command}\n");
            println!("{}\n", command_summary(command).unwrap_or_default());
            println!("用法：cargo run -p mobile -- {command} [选项]\n");
        }
        None => {
            println!("mobile\n");
            println!("用法：cargo run -p mobile -- <command> [选项]\n");
            println!("命令：");
            for &(name, summary) in COMMANDS {
                println!("  {name:<12}{summary}");
            }
            println!();
        }
    }
    println!("选项：");
    println!("  --sdk <path>        Android SDK（默认读取 ANDROID_HOME / ANDROID_SDK_ROOT）");
    println!("  --avd <name>        AVD 名称，默认 {DEFAULT_AVD}");
    println!("  --device <serial>   多设备时指定");
    println!("  --headless          无窗口启动");
    println!("  --force             关闭已有模拟器后重启");
    println!("  --launch            启动后打开应用");
    println!("  --timeout <sec>     启动超时，默认 180");
    println!("  --wait <sec>        smoke 等待前台的时间，默认 2.5");
    println!("  --apk <path>        install 使用指定 APK");
    println!("  --out <path>        screenshot 输出路径");
    println!("  --gpu <mode>        emulator GPU 模式，默认 swiftshader_indirect");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn parses_flags_and_values() {
        let options = Options::parse(&strings(&[
            "--sdk",
            "D:/sdk",
            "--avd=qa",
            "--headless",
            "--force",
            "--timeout",
            "30",
            "--wait=1.5",
        ]))
        .unwrap();
        assert_eq!(options.sdk.unwrap(), PathBuf::from("D:/sdk"));
        assert_eq!(options.avd, "qa");
        assert!(options.headless);
        assert!(options.force);
        assert_eq!(options.timeout, Duration::from_secs(30));
        assert_eq!(options.wait_ms, 1500);
    }

    #[test]
    fn rejects_unknown_flags() {
        assert!(Options::parse(&strings(&["--wat"])).is_err());
    }

    #[test]
    fn finds_platform_specific_binary_names() {
        assert_eq!(
            exe_name("adb"),
            if cfg!(windows) { "adb.exe" } else { "adb" }
        );
    }

    #[test]
    fn tool_env_leaves_user_avd_paths_alone() {
        let sdk = Sdk {
            root: PathBuf::from("D:/sdk"),
        };
        let keys: Vec<String> = sdk
            .tool_env()
            .into_iter()
            .map(|(key, _)| key.to_string_lossy().into_owned())
            .collect();
        assert!(keys.iter().any(|key| key == "ANDROID_HOME"));
        assert!(keys.iter().any(|key| key == "ANDROID_SDK_ROOT"));
        assert!(!keys.iter().any(|key| key == "ANDROID_AVD_HOME"));
        assert!(!keys.iter().any(|key| key == "ANDROID_USER_HOME"));
    }

    #[test]
    fn maps_device_abi_to_apk_output() {
        assert_eq!(apk_dir_for_abi("x86_64"), Some("x86_64"));
        assert_eq!(apk_dir_for_abi("arm64-v8a"), Some("arm64"));
        assert_eq!(apk_dir_for_abi("armeabi-v7a"), Some("arm"));
        assert_eq!(apk_dir_for_abi("mips"), None);
    }

    #[test]
    fn exposes_every_command_in_one_crate() {
        let names: Vec<&str> = COMMANDS.iter().map(|entry| entry.0).collect();
        assert_eq!(
            names,
            vec![
                "doctor",
                "devices",
                "start",
                "up",
                "launch",
                "install",
                "screenshot",
                "reset",
                "stop",
                "smoke",
            ]
        );
        assert_eq!(command_summary("up"), Some("启动模拟器并打开应用"));
        assert_eq!(command_summary("wat"), None);
    }

    #[test]
    fn rejects_unknown_command_before_touching_the_sdk() {
        let error = run(&strings(&["wat"])).unwrap_err();
        assert!(error.contains("未知命令：wat"));
        assert!(error.contains("mobile --help"));
    }
}
