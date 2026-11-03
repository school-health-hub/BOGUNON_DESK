#![forbid(unsafe_code)]
fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--inherited-restore-only"] {
        std::process::exit(2);
    }
    // Headless IPC-only watchdog. No child processes or OS windows exist in this binary.
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(120));
        std::process::exit(124);
    });
    if bogunon_surface_channel_host::workerw_channel::run(
        &mut std::io::stdin().lock(),
        &mut std::io::stdout().lock(),
        std::process::id(),
    )
    .is_err()
    {
        eprintln!("HOST_CHANNEL_REJECTED");
        std::process::exit(2);
    }
}
