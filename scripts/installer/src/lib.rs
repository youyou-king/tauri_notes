//! 安装器脚本的公共逻辑。
//!
//! 这一类的三个命令都围绕 Windows 安装器：
//! - `build`：编译 C# 卸载器与安装器；
//! - `verify`：检查安装器内嵌资源是否与构建产物一致；
//! - `verify-install`：静默安装后检查释放出来的文件。
//!
//! 安装器依赖 .NET Framework，所以这些命令只在 Windows 上运行；
//! crate 本身可以在其他平台编译，方便 CI 做静态检查。

use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};

/// 脚本统一使用的错误类型：直接保存可读的中文错误信息。
pub type Result<T> = std::result::Result<T, String>;

/// 安装器相关的固定路径。
pub struct Paths {
    /// 仓库根目录（tauri_notes）。
    pub project: PathBuf,
    /// 安装器 C# 源码目录。
    pub custom: PathBuf,
    /// release 构建出的应用。
    pub app: PathBuf,
    /// 内置帮助知识库。
    pub help: PathBuf,
    /// 构建出的卸载器。
    pub uninstaller: PathBuf,
    /// 构建出的安装器。
    pub setup: PathBuf,
    /// C# 编译器。
    pub csc: PathBuf,
    /// 安装器使用的应用清单。
    pub manifest: PathBuf,
    /// 安装器窗口图标。
    pub icon_ico: PathBuf,
    /// 安装器中显示的应用图标。
    pub icon_png: PathBuf,
}

impl Paths {
    /// 根据源码位置推导所有路径，不依赖当前工作目录。
    pub fn discover() -> Self {
        let project = project_root();
        let custom = project.join("installer").join("custom");
        let icons = project.join("src-tauri").join("icons");
        let windir = env::var_os("WINDIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\Windows"));

        Self {
            app: project
                .join("src-tauri")
                .join("target")
                .join("release")
                .join(exe_name("tauri-notes")),
            help: project.join("resources").join("help.note"),
            uninstaller: custom.join("Uninstall.exe"),
            setup: custom.join("Tauri Notes Setup.exe"),
            manifest: custom.join("admin.manifest"),
            icon_ico: icons.join("icon.ico"),
            icon_png: icons.join("icon.png"),
            csc: windir
                .join("Microsoft.NET")
                .join("Framework64")
                .join("v4.0.30319")
                .join("csc.exe"),
            custom,
            project,
        }
    }
}

/// 找到 tauri_notes 目录：从当前 crate 向上找 package.json。
pub fn project_root() -> PathBuf {
    let start = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    start
        .ancestors()
        .find(|path| path.join("package.json").is_file())
        .expect("scripts/installer 必须位于仓库根目录下")
        .to_path_buf()
}

/// 默认安装器路径：tauri_notes 的上一级。
pub fn default_setup() -> PathBuf {
    project_root()
        .parent()
        .expect("scripts 目录应位于仓库根目录下")
        .join("Tauri Notes Setup.exe")
}

/// 默认临时安装目录：tauri_notes/.tmp/installer-verify。
pub fn default_target() -> PathBuf {
    project_root().join(".tmp").join("installer-verify")
}

/// 编译并输出安装器。
pub fn build(output: Option<&Path>) -> Result<PathBuf> {
    ensure_windows()?;
    let paths = Paths::discover();

    for (path, label) in [
        (&paths.app, "release 应用"),
        (&paths.csc, "C# 编译器 csc.exe"),
        (&paths.help, "帮助知识库"),
        (&paths.icon_ico, "安装器窗口图标"),
        (&paths.icon_png, "应用图标"),
        (&paths.manifest, "应用清单"),
    ] {
        require_file(path, label)?;
    }

    build_uninstaller(&paths)?;
    build_setup(&paths)?;

    let output = output.map(Path::to_path_buf).unwrap_or_else(default_setup);
    if let Some(parent) = output.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| format!("创建输出目录失败：{error}"))?;
        }
    }
    fs::copy(&paths.setup, &output)
        .map_err(|error| format!("复制安装器到 {} 失败：{error}", output.display()))?;
    println!("安装器已生成：{}", output.display());
    Ok(output)
}

/// 校验安装器内嵌资源与当前构建产物一致。
pub fn verify(setup: &Path) -> Result<()> {
    ensure_windows()?;
    let paths = Paths::discover();
    require_file(setup, "安装器")?;
    require_file(&paths.app, "release 应用")?;

    let resources = read_resources(setup)?;
    let mut names = resources.keys().cloned().collect::<Vec<_>>();
    names.sort();
    println!("资源：{}", names.join(", "));

    let app_hash = sha256_file(&paths.app)?;
    require_resource(
        &resources,
        "AppExe",
        &app_hash,
        "安装器 AppExe 与 release 应用不一致",
    )?;

    if paths.uninstaller.is_file() {
        let expected = sha256_file(&paths.uninstaller)?;
        require_resource(
            &resources,
            "Uninstaller",
            &expected,
            "安装器 Uninstaller 与构建产物不一致",
        )?;
    }

    if paths.icon_png.is_file() {
        let expected = sha256_file(&paths.icon_png)?;
        require_resource(
            &resources,
            "AppIcon",
            &expected,
            "安装器 AppIcon 与源图标不一致",
        )?;
    }

    let help_hash = sha256_file(&paths.help)?;
    require_resource(
        &resources,
        "HelpNote",
        &help_hash,
        "安装器 HelpNote 与帮助知识库不一致",
    )?;

    println!("安装器载荷校验通过。");
    Ok(())
}

/// 静默安装到临时目录，校验释放的文件后清理。
pub fn verify_install(setup: &Path, target: &Path) -> Result<()> {
    ensure_windows()?;
    let paths = Paths::discover();
    require_file(setup, "安装器")?;
    require_file(&paths.app, "release 应用")?;
    require_file(&paths.help, "帮助知识库")?;

    let target = absolute_path(target)?;
    ensure_under_temp(&target, &paths.project.join(".tmp"))?;
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|error| format!("清理临时目录失败：{error}"))?;
    }
    fs::create_dir_all(&target).map_err(|error| format!("创建临时目录失败：{error}"))?;
    let _cleanup = Cleanup(target.clone());

    let child = Command::new(setup)
        .arg("/S")
        .arg(format!("/D={}", target.display()))
        .args([
            "/NOASSOC",
            "/NODESKTOP",
            "/NOSTARTMENU",
            "/NOREG",
            "/NOLAUNCH",
        ])
        .stdin(Stdio::null())
        .spawn()
        .map_err(|error| format!("无法启动安装器：{error}"))?;
    println!("已启动安装器（pid {}）。", child.id());

    let app = target.join("Tauri Notes.exe");
    let uninstaller = target.join("Uninstall.exe");
    let help = target.join("help.note");
    wait_for_files(&[&app, &uninstaller, &help], Duration::from_secs(30))?;

    if !app.is_file() {
        return Err("安装器没有释放应用文件。".to_string());
    }
    if !uninstaller.is_file() {
        return Err("安装器没有释放卸载器。".to_string());
    }
    if !help.is_file() {
        return Err("安装器没有释放帮助知识库。".to_string());
    }

    if sha256_file(&app)? != sha256_file(&paths.app)? {
        return Err("释放的应用与 release 构建不一致。".to_string());
    }
    if sha256_file(&help)? != sha256_file(&paths.help)? {
        return Err("释放的帮助知识库与源文件不一致。".to_string());
    }
    if paths.uninstaller.is_file() && sha256_file(&uninstaller)? != sha256_file(&paths.uninstaller)?
    {
        return Err("释放的卸载器与构建产物不一致。".to_string());
    }

    println!("安装器解包校验通过：{}", app.display());
    Ok(())
}

/// 编译卸载器。
fn build_uninstaller(paths: &Paths) -> Result<()> {
    let mut command = Command::new(&paths.csc);
    command
        .arg("/nologo")
        .arg("/target:winexe")
        .arg(format!("/win32icon:{}", paths.icon_ico.display()))
        .arg(format!("/win32manifest:{}", paths.manifest.display()))
        .arg("/r:System.Drawing.dll")
        .arg(format!("/out:{}", paths.uninstaller.display()))
        .arg(paths.custom.join("Uninstall.cs"));
    run_compiler(command, "卸载器")
}

/// 编译安装器，并把应用、卸载器、帮助和图标嵌入资源。
fn build_setup(paths: &Paths) -> Result<()> {
    let mut command = Command::new(&paths.csc);
    command
        .arg("/nologo")
        .arg("/target:winexe")
        .arg(format!("/win32icon:{}", paths.icon_ico.display()))
        .arg(format!("/win32manifest:{}", paths.manifest.display()))
        .arg("/r:System.Drawing.dll")
        .arg(format!("/out:{}", paths.setup.display()))
        .arg(format!("/resource:{},AppExe", paths.app.display()))
        .arg(format!(
            "/resource:{},Uninstaller",
            paths.uninstaller.display()
        ))
        .arg(format!("/resource:{},HelpNote", paths.help.display()))
        .arg(format!("/resource:{},AppIcon", paths.icon_png.display()))
        .arg(paths.custom.join("Setup.cs"));
    run_compiler(command, "安装器")
}

/// 执行编译命令，失败时带上编译器输出。
fn run_compiler(mut command: Command, label: &str) -> Result<()> {
    let status = command
        .status()
        .map_err(|error| format!("无法启动 C# 编译器：{error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{label}编译失败（{status}）。"))
    }
}

/// 借助 PowerShell 的 .NET 反射读取安装器内嵌资源。
///
/// 托管资源没有稳定的纯 Rust 读取方式；安装器校验本来就只在 Windows 上运行，
/// 因此这里只把“读资源”这一步交给系统自带的 PowerShell。
fn read_resources(setup: &Path) -> Result<HashMap<String, String>> {
    let script = r#"
# 读取 .NET 安装器内嵌的托管资源，逐行输出“资源名 SHA256”。
$ErrorActionPreference = "Stop"
$path = $env:TN_INSTALLER_SETUP
$assembly = [System.Reflection.Assembly]::Load([System.IO.File]::ReadAllBytes($path))
foreach ($name in $assembly.GetManifestResourceNames()) {
    $stream = $assembly.GetManifestResourceStream($name)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = ([BitConverter]::ToString($sha.ComputeHash($stream)) -replace "-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
        $stream.Dispose()
    }
    Write-Output "$name $hash"
}
"#;

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env("TN_INSTALLER_SETUP", setup)
        .output()
        .map_err(|error| format!("无法启动 PowerShell 读取安装器资源：{error}"))?;

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr);
        return Err(format!("读取安装器资源失败：{}", message.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut resources = HashMap::new();
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let (name, hash) = line
            .split_once(' ')
            .ok_or_else(|| format!("无法解析资源行：{line}"))?;
        resources.insert(name.to_string(), hash.to_string());
    }

    if resources.is_empty() {
        return Err("安装器没有内嵌资源。".to_string());
    }
    Ok(resources)
}

/// 等待一组文件出现，超时后返回错误。
fn wait_for_files(files: &[&Path], timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if files.iter().all(|path| path.is_file()) {
            return Ok(());
        }
        sleep(Duration::from_millis(300));
    }
    if files.iter().all(|path| path.is_file()) {
        Ok(())
    } else {
        Err("等待安装器释放文件超时。".to_string())
    }
}

/// 清理临时安装目录；函数提前返回时也会执行。
struct Cleanup(PathBuf);

impl Drop for Cleanup {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn require_file(path: &Path, label: &str) -> Result<()> {
    if path.is_file() {
        Ok(())
    } else {
        Err(format!("缺少{label}：{}", path.display()))
    }
}

fn require_resource(
    resources: &HashMap<String, String>,
    name: &str,
    expected: &str,
    message: &str,
) -> Result<()> {
    match resources.get(name) {
        Some(actual) if actual == expected => Ok(()),
        Some(_) => Err(message.to_string()),
        None => Err(format!("安装器缺少资源：{name}")),
    }
}

fn sha256_file(path: &Path) -> Result<String> {
    let bytes = fs::read(path).map_err(|error| format!("读取 {} 失败：{error}", path.display()))?;
    let digest = Sha256::digest(&bytes);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn absolute_path(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        return Ok(path.to_path_buf());
    }
    env::current_dir()
        .map(|cwd| cwd.join(path))
        .map_err(|error| format!("读取当前目录失败：{error}"))
}

/// 只允许清理 .tmp 下的目录，避免误删用户文件。
fn ensure_under_temp(target: &Path, temp: &Path) -> Result<()> {
    if target
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("--target 不允许包含 ..".to_string());
    }
    if !target.starts_with(temp) {
        return Err(format!("--target 必须位于 {} 下。", temp.display()));
    }
    Ok(())
}

fn ensure_windows() -> Result<()> {
    if cfg!(windows) {
        Ok(())
    } else {
        Err("安装器脚本仅支持 Windows。".to_string())
    }
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_cleans_targets_inside_temp() {
        let temp = Path::new("repo/.tmp");
        assert!(ensure_under_temp(&temp.join("installer-verify"), temp).is_ok());
        assert!(ensure_under_temp(&temp.join("..").join("outside"), temp).is_err());
        assert!(ensure_under_temp(Path::new("repo/outside"), temp).is_err());
    }
}
