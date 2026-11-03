fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--read-only-preflight"] {
        std::process::exit(2);
    }
    #[cfg(windows)]
    {
        let Some(source) = option_env!("BOGUNON_NATIVE_SOURCE_SHA") else {
            std::process::exit(2);
        };
        if source.len() != 40 || !source.bytes().all(|b| b.is_ascii_hexdigit()) {
            std::process::exit(2);
        }
        let report = bogunon_workerw_boundary::observe_shell();
        let result = serde_json::json!({"sourceSha":source,"mode":"ReadOnly","observation":report});
        if serde_json::to_writer(std::io::stdout().lock(), &result).is_err() {
            std::process::exit(2);
        }
    }
    #[cfg(not(windows))]
    std::process::exit(2);
}
