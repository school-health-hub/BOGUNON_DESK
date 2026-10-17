use crate::{
    diagnostic_output::{self, Code, Finding, Session},
    outcome::{Capability, Report, WindowResult},
};
use std::{cell::RefCell, rc::Rc};

struct Synthetic {
    trace: Rc<RefCell<Vec<&'static str>>>,
    cleanup_fails: bool,
    save_fails: bool,
    observation_panics: bool,
    save_panics: bool,
    observation_fails: bool,
}
impl Session for Synthetic {
    fn observe(&mut self) -> Finding {
        self.trace.borrow_mut().push("observe");
        assert!(
            !self.observation_panics,
            "SYNTHETIC_PRIVATE_PATH HWND=PRIVATE"
        );
        if self.observation_fails {
            Finding::failure(Code::Snapshot)
        } else {
            Finding {
                report: Report {
                    window: WindowResult::Pass,
                    capability: Capability::Unsupported,
                },
                error: None,
            }
        }
    }
    fn cleanup(&mut self) -> Result<(), ()> {
        self.trace.borrow_mut().push("cleanup");
        if self.cleanup_fails {
            Err(())
        } else {
            Ok(())
        }
    }
    fn persist_evidence(&mut self) -> Result<(), ()> {
        self.trace.borrow_mut().push("save");
        assert!(!self.save_panics, "SYNTHETIC_PRIVATE_SAVE_PATH");
        if self.save_fails {
            Err(())
        } else {
            Ok(())
        }
    }
}
impl Drop for Synthetic {
    fn drop(&mut self) {
        self.trace.borrow_mut().push("drop");
    }
}
fn run(case: usize) -> (u8, String, Vec<&'static str>) {
    let trace = Rc::new(RefCell::new(Vec::new()));
    let result = diagnostic_output::execute(|| {
        Ok(Synthetic {
            trace: trace.clone(),
            cleanup_fails: case == 2 || case == 5,
            save_fails: (1..=5).contains(&case),
            observation_panics: case == 3 || case == 5,
            save_panics: case == 6,
            observation_fails: case == 4,
        })
    });
    let mut stdout = Vec::new();
    let code = result.write_to(&mut stdout);
    let steps = trace.borrow().clone();
    (code, String::from_utf8(stdout).unwrap(), steps)
}

#[test]
fn evidence_is_saved_only_after_cleanup_and_before_drop() {
    let (exit, stdout, trace) = run(0);
    assert_eq!(exit, 0);
    assert_eq!(stdout, "WINDOW=PASS\nCAPABILITY=UNSUPPORTED\n");
    assert_eq!(trace, ["observe", "cleanup", "save", "drop"]);
}
#[test]
fn evidence_failure_is_existing_output_exit_six_not_success() {
    let (exit, stdout, trace) = run(1);
    assert_eq!(exit, 6);
    assert_eq!(stdout, "WINDOW=PASS\nCAPABILITY=UNSUPPORTED\n");
    assert_eq!(trace, ["observe", "cleanup", "save", "drop"]);
}
#[test]
fn cleanup_failure_has_priority_over_evidence_failure() {
    let (exit, stdout, _) = run(2);
    assert_eq!(exit, 5);
    assert!(stdout.contains("FAIL_CLEANUP\nE_CLEANUP\n"));
}
#[test]
fn observation_panic_still_cleans_and_saves_without_becoming_exit_six() {
    let (exit, stdout, trace) = run(3);
    assert_eq!(exit, 4);
    assert!(stdout.contains("E_INTERNAL_PANIC"));
    assert!(!stdout.contains("PRIVATE"));
    assert_eq!(trace, ["observe", "cleanup", "save", "drop"]);
}
#[test]
fn observation_failure_has_priority_over_evidence_failure() {
    let (exit, stdout, _) = run(4);
    assert_eq!(exit, 3);
    assert!(stdout.contains("E_SNAPSHOT"));
}
#[test]
fn panic_cleanup_and_save_failure_keep_cleanup_exit_and_both_codes() {
    let (exit, stdout, _) = run(5);
    assert_eq!(exit, 5);
    assert!(stdout.contains("E_INTERNAL_PANIC"));
    assert!(stdout.contains("FAIL_CLEANUP"));
}
#[test]
fn evidence_panic_is_internal_panic_after_cleanup() {
    let (exit, stdout, trace) = run(6);
    assert_eq!(exit, 4);
    assert!(stdout.contains("E_INTERNAL_PANIC"));
    assert!(!stdout.contains("PRIVATE"));
    assert_eq!(trace, ["observe", "cleanup", "save", "drop"]);
}
