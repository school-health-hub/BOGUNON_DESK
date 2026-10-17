use std::process::Command;

#[test]
fn own_synthetic_process_protocol_and_exit_codes() {
    let cases = [
        ("pass", 0),
        ("gate", 2),
        ("observe-fail", 3),
        ("cleanup-fail", 5),
        ("panic", 4),
        ("partial-panic", 4),
        ("panic-cleanup", 5),
        ("evidence-fail", 6),
        ("cleanup-evidence", 5),
        ("writer-fail", 6),
        ("typed-cleanup-panic", 5),
    ];
    for backtrace in ["0", "1", "full"] {
        for (scenario, exit) in cases {
            let output = Command::new(env!("CARGO_BIN_EXE_desktop-surface-own-synthetic"))
                .arg(scenario)
                .env("RUST_BACKTRACE", backtrace)
                .output()
                .unwrap();
            assert_eq!(output.status.code(), Some(exit), "scenario {scenario}");
            assert!(output.stderr.is_empty(), "scenario {scenario}");
            let text = String::from_utf8(output.stdout).unwrap();
            assert!(!text.contains("PRIVATE_PATH_HWND_MARKER"));
            if exit == 5 {
                assert!(text.lines().any(|line| line == "FAIL_CLEANUP"));
            }
            if matches!(
                scenario,
                "panic" | "partial-panic" | "panic-cleanup" | "typed-cleanup-panic"
            ) {
                assert!(text.lines().any(|line| line == "E_PANIC"));
            }
            if scenario == "writer-fail" {
                assert!(text.is_empty());
                continue;
            }
            let mut lines = text.lines();
            assert_eq!(
                lines.next(),
                Some(match exit {
                    0 => "WINDOW=PASS",
                    2 => "WINDOW=BLOCKED",
                    _ => "WINDOW=FAIL",
                })
            );
            assert_eq!(lines.next(), Some("CAPABILITY=NOT_OBSERVED"));
            for line in lines {
                assert!(matches!(
                    line,
                    "FAIL_CLEANUP"
                        | "E_GATE"
                        | "E_NATIVE"
                        | "E_CALLBACK"
                        | "E_MODEL"
                        | "E_MAIN"
                        | "E_CLEANUP"
                        | "E_EVIDENCE"
                        | "E_PANIC"
                ));
            }
        }
    }
}
