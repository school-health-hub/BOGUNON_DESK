use super::check;
const TRACE: &str = "gate,create,observe,cleanup,save,drop";
#[test]
fn save_failure_is_nonzero_with_unchanged_protocol() {
    check(
        "evidence-failure",
        6,
        &["WINDOW=PASS", "CAPABILITY=SUPPORTED"],
        TRACE,
        "full",
    );
}
#[test]
fn cleanup_and_save_failure_preserve_cleanup_exit() {
    check(
        "cleanup-evidence",
        5,
        &[
            "WINDOW=FAIL",
            "CAPABILITY=SUPPORTED",
            "FAIL_CLEANUP",
            "E_CLEANUP",
        ],
        TRACE,
        "1",
    );
}
#[test]
fn panic_and_save_failure_are_private_and_nonzero() {
    check(
        "panic-evidence",
        4,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_INTERNAL_PANIC"],
        TRACE,
        "full",
    );
}
#[test]
fn panic_cleanup_and_save_failure_preserve_both_errors() {
    check(
        "panic-cleanup-evidence",
        5,
        &[
            "WINDOW=FAIL",
            "CAPABILITY=NOT_OBSERVED",
            "FAIL_CLEANUP",
            "E_INTERNAL_PANIC",
            "E_CLEANUP",
        ],
        TRACE,
        "full",
    );
}
#[test]
fn observation_failure_is_not_replaced_by_save_failure() {
    check(
        "snapshot-evidence",
        3,
        &["WINDOW=FAIL", "CAPABILITY=NOT_OBSERVED", "E_SNAPSHOT"],
        TRACE,
        "full",
    );
}
#[test]
fn persistence_panic_is_caught_after_cleanup() {
    check(
        "evidence-panic",
        4,
        &["WINDOW=FAIL", "CAPABILITY=SUPPORTED", "E_INTERNAL_PANIC"],
        TRACE,
        "full",
    );
}
