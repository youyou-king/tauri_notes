//! `verify` 命令行入口：全量验证。

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = verify::run(&args) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
