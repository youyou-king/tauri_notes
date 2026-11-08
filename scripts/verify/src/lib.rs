//! 全量验证脚本：前端、Rust、脚本 crate、构建与安装器。
//!
//! 这里只做“按顺序执行并检查退出码”，具体步骤复用各自 crate 或命令行工具。
//! 任何一个步骤失败都会立即停止，并给出中文步骤名和退出码。

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use installer::{build as build_installer, default_setup, default_target};
use installer::{verify as verify_installer, verify_install as verify_installer_install};

/// 脚本统一使用的错误类型：直接保存可读的中文错误信息。
pub type Result<T> = std::result::Result<T, String>;

/// 参与全量验证的 Rust crate；与原有脚本保持一致。
const CRATES: &[&str] = &[
    "tauri-notes-plugin-api",
    "tauri-notes-plugin-runtime",
    "tauri-notes-platform",
    "tauri-notes-storage",
    "tauri-notes-content",
    "tauri-notes-board",
    "tauri-notes-document",
];

/// 命令行选项。
#[derive(Debug, Default)]
pub struct Options {
    pub skip_build: bool,
    pub skip_installer: bool,
    pub cargo: Option<String>,
}

impl Options {
    /// 解析简单开关；未知参数直接报错。
    pub fn parse(args: &[String]) -> Result<Self> {
        let mut options = Self::default();
        let mut index = 0;

        while index < args.len() {
            let arg = args[index].as_str();
            match arg {
                "--skip-build" => options.skip_build = true,
                "--skip-installer" => options.skip_installer = true,
                "--cargo" => {
                    index += 1;
                    options.cargo = Some(
                        args.get(index)
                            .cloned()
                            .ok_or_else(|| "--cargo 需要一个值".to_string())?,
                    );
                }
                _ if arg.starts_with("--cargo=") => {
                    let value = &arg["--cargo=".len()..];
                    if value.is_empty() {
                        return Err("--cargo 需要一个值".to_string());
                    }
                    options.cargo = Some(value.to_string());
                }
                other => return Err(format!("未知参数：{other}")),
            }
            index += 1;
        }

        Ok(options)
    }
}

/// 执行全部验证步骤。
pub fn run(args: &[String]) -> Result<()> {
    if args
        .iter()
        .any(|arg| matches!(arg.as_str(), "help" | "--help" | "-h"))
    {
        print_help();
        return Ok(());
    }

    let options = Options::parse(args)?;
    let root = project_root();
    let temp = root.join(".tmp");
    fs::create_dir_all(&temp).map_err(|error| format!("创建 .tmp 失败：{error}"))?;

    // 子进程统一使用项目内的临时目录，避免污染系统 TEMP。
    env::set_var("TEMP", &temp);
    env::set_var("TMP", &temp);

    let cargo = options.cargo.as_deref().unwrap_or("cargo");
    let src_tauri = root.join("src-tauri");

    run_step("前端检查", npm(&temp).args(["run", "check"]), &root)?;
    run_step("前端 E2E", npm(&temp).args(["run", "e2e"]), &root)?;
    run_step("前端构建", npm(&temp).args(["run", "build"]), &root)?;

    run_step(
        "Rust clippy",
        cargo_command(cargo, &temp).args([
            "clippy",
            "--workspace",
            "--all-targets",
            "--",
            "-D",
            "warnings",
        ]),
        &src_tauri,
    )?;
    for crate_name in CRATES {
        run_step(
            &format!("Rust 测试：{crate_name}"),
            cargo_command(cargo, &temp).args(["test", "-p", crate_name, "--lib"]),
            &src_tauri,
        )?;
    }
    run_step(
        "Rust 测试：tauri-notes",
        cargo_command(cargo, &temp).args(["test", "-p", "tauri-notes", "--lib"]),
        &src_tauri,
    )?;

    run_step(
        "脚本 clippy",
        cargo_command(cargo, &temp).args([
            "clippy",
            "--manifest-path",
            "scripts/Cargo.toml",
            "--workspace",
            "--all-targets",
            "--",
            "-D",
            "warnings",
        ]),
        &root,
    )?;
    run_step(
        "脚本测试",
        cargo_command(cargo, &temp).args([
            "test",
            "--manifest-path",
            "scripts/Cargo.toml",
            "--workspace",
        ]),
        &root,
    )?;

    if !options.skip_build {
        run_step(
            "Tauri release 构建",
            npm(&temp).args(["run", "tauri", "build", "--", "--no-bundle"]),
            &root,
        )?;
    }

    if !options.skip_installer {
        if cfg!(windows) {
            let setup = default_setup();
            println!("\n==> 构建安装器");
            build_installer(Some(&setup))?;
            println!("\n==> 校验安装器载荷");
            verify_installer(&setup)?;
            println!("\n==> 校验安装器解包");
            verify_installer_install(&setup, &default_target())?;
        } else {
            println!("\n当前平台不是 Windows，跳过安装器步骤。");
        }
    }

    println!("\n全部检查通过。");
    Ok(())
}

fn run_step(name: &str, command: &mut Command, dir: &Path) -> Result<()> {
    println!("\n==> {name}");
    let status = command
        .current_dir(dir)
        .status()
        .map_err(|error| format!("{name}：无法启动命令：{error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{name}失败（{status}）。"))
    }
}

/// 在 Windows 上 npm 是 .cmd 脚本，需要通过 cmd.exe 启动。
fn npm(temp: &Path) -> Command {
    let mut command = if cfg!(windows) {
        let mut command = Command::new("cmd");
        command.args(["/D", "/C", "npm"]);
        command
    } else {
        Command::new("npm")
    };
    command.env("TEMP", temp).env("TMP", temp);
    command
}

fn cargo_command(cargo: &str, temp: &Path) -> Command {
    let mut command = Command::new(cargo);
    command.env("TEMP", temp).env("TMP", temp);
    command
}

/// 仓库根目录（tauri_notes）。
pub fn project_root() -> PathBuf {
    let start = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    start
        .ancestors()
        .find(|path| path.join("package.json").is_file())
        .expect("scripts/verify 必须位于仓库根目录下")
        .to_path_buf()
}

fn print_help() {
    println!("verify\n");
    println!("用法：cargo run -p verify -- [选项]\n");
    println!("选项：");
    println!("  --skip-build      跳过 Tauri release 构建");
    println!("  --skip-installer  跳过安装器构建与校验");
    println!("  --cargo <path>    指定 cargo 可执行文件，默认 cargo");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_flags_and_cargo_path() {
        let args = [
            "--skip-build",
            "--skip-installer",
            "--cargo",
            "D:/cargo.exe",
        ]
        .map(str::to_string);
        let options = Options::parse(&args).unwrap();
        assert!(options.skip_build);
        assert!(options.skip_installer);
        assert_eq!(options.cargo.as_deref(), Some("D:/cargo.exe"));
    }

    #[test]
    fn accepts_inline_cargo_path() {
        let args = ["--cargo=D:/cargo.exe"].map(str::to_string);
        let options = Options::parse(&args).unwrap();
        assert_eq!(options.cargo.as_deref(), Some("D:/cargo.exe"));
    }

    #[test]
    fn rejects_unknown_arguments() {
        let args = ["--wat"].map(str::to_string);
        assert!(Options::parse(&args).is_err());
    }
}
