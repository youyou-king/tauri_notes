//! 发布相关脚本：版本同步。
//!
//! 一个 crate 对应一类“发布”脚本，命令通过子命令区分：
//! - `version`：检查或设置四个文件里的版本号。

use std::env;
use std::path::PathBuf;

pub mod version;

/// 脚本统一使用的错误类型：直接保存可读的中文错误信息。
pub type Result<T> = std::result::Result<T, String>;

/// 仓库根目录（tauri_notes）。
pub fn project_root() -> PathBuf {
    let start = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    start
        .ancestors()
        .find(|path| path.join("package.json").is_file())
        .expect("scripts/release 必须位于仓库根目录下")
        .to_path_buf()
}

/// 解析并执行命令行。
pub fn run(args: &[String]) -> Result<()> {
    let Some((command, rest)) = args.split_first() else {
        print_help(None);
        return Ok(());
    };
    let command = command.as_str();

    if is_help(command) {
        print_help(None);
        return Ok(());
    }

    match command {
        "version" => run_version(rest),
        other => Err(format!(
            "未知命令：{other}\n\n运行 `release --help` 查看用法。"
        )),
    }
}

fn run_version(args: &[String]) -> Result<()> {
    if args.iter().any(|arg| is_help(arg)) {
        print_help(Some("version"));
        return Ok(());
    }

    match args.first().map(String::as_str) {
        None => version::check(),
        Some("check") => {
            if args.len() > 1 {
                return Err("version check 不接受额外参数".to_string());
            }
            version::check()
        }
        Some("set") => {
            let next = args
                .get(1)
                .ok_or_else(|| "version set 需要版本号".to_string())?;
            if args.len() > 2 {
                return Err("version set 只接受一个版本号".to_string());
            }
            version::set(next)
        }
        Some(other) => Err(format!(
            "未知 version 子命令：{other}\n\n可用：check / set <semver>"
        )),
    }
}

fn is_help(value: &str) -> bool {
    matches!(value, "help" | "--help" | "-h")
}

fn print_help(command: Option<&str>) {
    match command {
        Some("version") => {
            println!("release version\n");
            println!("用法：cargo run -p release -- version [check|set <semver>]\n");
            println!("check        检查 package.json、tauri.conf.json、Cargo.toml、Cargo.lock 版本是否一致");
            println!("set <semver> 把四处版本号统一设置为指定值");
        }
        _ => {
            println!("release\n");
            println!("用法：cargo run -p release -- <命令> [参数]\n");
            println!("命令：");
            println!("  version check                    检查四处版本号是否一致");
            println!("  version set <semver>             设置版本号");
            println!();
            println!("运行 `release <命令> --help` 查看单个命令的说明。");
        }
    }
}
