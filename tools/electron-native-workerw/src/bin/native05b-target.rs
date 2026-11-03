use std::io::Write;
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let loss = match args.as_slice() {
        [a] if a == "--isolated-test-target" => false,
        [a, b] if a == "--isolated-test-target" && b == "--host-loss" => true,
        _ => std::process::exit(2),
    };
    let Some(source) = option_env!("BOGUNON_NATIVE_SOURCE_SHA") else {
        std::process::exit(2)
    };
    let mut bytes = [0; 20];
    if source.len() != 40 || !source.bytes().all(|b| b.is_ascii_hexdigit()) {
        std::process::exit(2);
    }
    for (i, byte) in bytes.iter_mut().enumerate() {
        match u8::from_str_radix(&source[i * 2..i * 2 + 2], 16) {
            Ok(v) => *byte = v,
            Err(_) => std::process::exit(2),
        }
    }
    #[cfg(windows)]
    {
        let result = bogunon_workerw_boundary::run_target_qa(bytes, loss);
        match result {
            Ok(outcome) => {
                let out = serde_json::json!({"sourceSha":source,"report":&outcome.report});
                let mut stdout = std::io::stdout().lock();
                if serde_json::to_writer(&mut stdout, &out).is_err() || stdout.flush().is_err() {
                    std::process::exit(2);
                }
                if loss {
                    std::process::exit(42);
                }
            }
            Err(_) => {
                eprintln!("NATIVE05B_TEST_TARGET_REJECTED");
                std::process::exit(2)
            }
        }
    }
    #[cfg(not(windows))]
    std::process::exit(2);
}
