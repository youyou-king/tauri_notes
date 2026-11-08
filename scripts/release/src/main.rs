//! `release` 命令行入口：版本同步。

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = release::run(&args) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
