fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = mobile_test_core::run("start", &args) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
