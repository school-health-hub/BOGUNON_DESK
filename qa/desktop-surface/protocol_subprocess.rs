use std::{
    fs,
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT: AtomicU64 = AtomicU64::new(0);
mod evidence_protocol_tests;

#[test]
fn prepare_panic() {
    check(
        "prepare-panic",
        4,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_INTERNAL_PANIC"],
        "gate",
        "full",
    );
}

#[test]
fn drop_panic() {
    check(
        "drop-panic",
        5,
        &[
            "WINDOW=FAIL",
            "CAPABILITY=SUPPORTED",
            "FAIL_CLEANUP",
            "E_INTERNAL_PANIC",
            "E_CLEANUP",
        ],
        "gate,create,observe,cleanup,drop",
        "full",
    );
}

fn check(case: &str, code: i32, expected: &[&str], trace: &str, backtrace: &str) {
    let path = std::env::temp_dir().join(format!(
        "surface-output-{}-{}.txt",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let output = Command::new(env!("CARGO_BIN_EXE_desktop-surface-synthetic"))
        .args([case])
        .arg(&path)
        .env("RUST_BACKTRACE", backtrace)
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(code));
    assert!(output.stderr.is_empty());
    let bytes = if expected.is_empty() {
        String::new()
    } else {
        format!("{}\n", expected.join("\n"))
    };
    assert_eq!(output.stdout, bytes.as_bytes());
    assert_eq!(fs::read_to_string(&path).unwrap(), trace);
    fs::remove_file(path).unwrap();
}

#[test]
fn pass() {
    check(
        "pass",
        0,
        &["WINDOW=PASS", "CAPABILITY=SUPPORTED"],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn unsupported() {
    check(
        "unsupported",
        0,
        &["WINDOW=PASS", "CAPABILITY=UNSUPPORTED"],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn gate() {
    check(
        "gate",
        2,
        &["WINDOW=BLOCKED", "CAPABILITY=NOT_OBSERVED", "E_GATE_OPT_IN"],
        "gate",
        "0",
    );
}
#[test]
fn snapshot() {
    check(
        "snapshot",
        3,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_SNAPSHOT"],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn shell() {
    check(
        "shell",
        3,
        &["WINDOW=PASS", "CAPABILITY=FAIL", "E_SHELL_IDENTITY"],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn cleanup() {
    check(
        "cleanup",
        5,
        &[
            "WINDOW=FAIL",
            "CAPABILITY=SUPPORTED",
            "FAIL_CLEANUP",
            "E_CLEANUP",
        ],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn panic() {
    check(
        "panic",
        4,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_INTERNAL_PANIC"],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn panic_cleanup() {
    check(
        "panic-cleanup",
        5,
        &[
            "WINDOW=FAIL",
            "CAPABILITY=NOT_OBSERVED",
            "FAIL_CLEANUP",
            "E_INTERNAL_PANIC",
            "E_CLEANUP",
        ],
        "gate,create,observe,cleanup,drop",
        "0",
    );
}
#[test]
fn backtrace_one() {
    check(
        "panic",
        4,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_INTERNAL_PANIC"],
        "gate,create,observe,cleanup,drop",
        "1",
    );
}
#[test]
fn backtrace_full() {
    check(
        "panic",
        4,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_INTERNAL_PANIC"],
        "gate,create,observe,cleanup,drop",
        "full",
    );
}
#[test]
fn writer() {
    check("writer", 6, &[], "gate,create,observe,cleanup,drop", "full");
}
#[test]
fn cleanup_panic() {
    check(
        "cleanup-panic",
        5,
        &[
            "WINDOW=FAIL",
            "CAPABILITY=SUPPORTED",
            "FAIL_CLEANUP",
            "E_INTERNAL_PANIC",
            "E_CLEANUP",
        ],
        "gate,create,observe,cleanup,drop",
        "full",
    );
}
