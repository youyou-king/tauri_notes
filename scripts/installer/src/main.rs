//! `installer` 命令行入口：构建和校验 Windows 安装器。

use std::collections::HashMap;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = run(&args) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run(args: &[String]) -> Result<(), String> {
    let Some((command, rest)) = args.split_first() else {
        print_help(None);
        return Ok(());
    };
    let command = command.as_str();

    if matches!(command, "help" | "--help" | "-h") {
        print_help(None);
        return Ok(());
    }

    if !matches!(command, "build" | "verify" | "verify-install") {
        return Err(format!(
            "未知命令：{command}\n\n运行 `installer --help` 查看用法。"
        ));
    }

    if rest.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help(Some(command));
        return Ok(());
    }

    match command {
        "build" => {
            let options = parse_options(rest, &["--output"])?;
            let output = options.get("output").map(PathBuf::from);
            installer::build(output.as_deref())?;
        }
        "verify" => {
            let options = parse_options(rest, &["--setup"])?;
            let setup = options
                .get("setup")
                .map(PathBuf::from)
                .unwrap_or_else(installer::default_setup);
            installer::verify(&setup)?;
        }
        "verify-install" => {
            let options = parse_options(rest, &["--setup", "--target"])?;
            let setup = options
                .get("setup")
                .map(PathBuf::from)
                .unwrap_or_else(installer::default_setup);
            let target = options
                .get("target")
                .map(PathBuf::from)
                .unwrap_or_else(installer::default_target);
            installer::verify_install(&setup, &target)?;
        }
        _ => unreachable!("命令已在前面校验"),
    }

    Ok(())
}

/// 解析 `--key value` 和 `--key=value` 两种写法。
fn parse_options(args: &[String], allowed: &[&str]) -> Result<HashMap<String, String>, String> {
    let mut values = HashMap::new();
    let mut index = 0;

    while index < args.len() {
        let arg = &args[index];
        let (key, inline) = match arg.split_once('=') {
            Some((key, value)) => (key, Some(value)),
            None => (arg.as_str(), None),
        };

        if !allowed.contains(&key) {
            return Err(format!("未知参数：{arg}"));
        }

        let value = match inline {
            Some(value) if !value.is_empty() => value.to_string(),
            Some(_) => return Err(format!("{key} 需要一个值")),
            None => {
                index += 1;
                args.get(index)
                    .cloned()
                    .ok_or_else(|| format!("{key} 需要一个值"))?
            }
        };

        values.insert(key.trim_start_matches("--").to_string(), value);
        index += 1;
    }

    Ok(values)
}

fn print_help(command: Option<&str>) {
    println!("installer\n");

    match command {
        Some("build") => {
            println!("编译卸载器与安装器，并复制到输出路径。\n");
            println!("用法：cargo run -p installer -- build [--output <path>]\n");
            println!("选项：");
            println!(
                "  --output <path>  输出路径，默认 tauri_notes 上一级的 Tauri Notes Setup.exe"
            );
        }
        Some("verify") => {
            println!("校验安装器内嵌资源是否与构建产物一致。\n");
            println!("用法：cargo run -p installer -- verify [--setup <path>]\n");
            println!("选项：");
            println!(
                "  --setup <path>  安装器路径，默认 tauri_notes 上一级的 Tauri Notes Setup.exe"
            );
        }
        Some("verify-install") => {
            println!("静默安装到临时目录，校验释放的文件后清理。\n");
            println!("用法：cargo run -p installer -- verify-install [--setup <path>] [--target <path>]\n");
            println!("选项：");
            println!(
                "  --setup <path>   安装器路径，默认 tauri_notes 上一级的 Tauri Notes Setup.exe"
            );
            println!("  --target <path>  临时目录，必须在项目的 .tmp 下");
        }
        _ => {
            println!("用法：cargo run -p installer -- <命令> [选项]\n");
            println!("命令：");
            println!("  build           编译卸载器与安装器");
            println!("  verify          校验安装器内嵌资源");
            println!("  verify-install  静默安装并校验释放的文件");
            println!();
            println!("运行 `installer <命令> --help` 查看单个命令的选项。");
        }
    }
}
