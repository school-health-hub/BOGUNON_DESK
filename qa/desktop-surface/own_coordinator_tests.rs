use crate::own_coordinator::{run, Driver, Notice, NoticeKind};
use crate::own_result::{Counters, Error, Evidence, Report};
use crate::surface_event_types::Binding;

#[derive(Default)]
struct Fake {
    notices: Vec<Notice>,
    fail: Option<Error>,
    omit_create: bool,
    duplicate_create: bool,
    close_create: bool,
    stale_destroy: bool,
    omit_destroy: bool,
    original: Option<Binding>,
    disposed: bool,
    cleaned: bool,
}
impl Driver for Fake {
    fn create(&mut self, binding: &Binding) -> Result<(), Error> {
        self.original = Some(binding.clone());
        if !self.omit_create {
            self.notices.push(Notice {
                binding: binding.clone(),
                kind: NoticeKind::Created,
            });
        }
        if self.duplicate_create {
            self.notices.push(Notice {
                binding: binding.clone(),
                kind: NoticeKind::Created,
            });
        }
        if self.close_create {
            self.notices.push(Notice {
                binding: binding.clone(),
                kind: NoticeKind::CloseRequested,
            });
        }
        match self.fail {
            Some(Error::Native) => Err(Error::Native),
            _ => Ok(()),
        }
    }
    fn observe(&mut self) -> Result<(), Error> {
        match self.fail {
            Some(Error::Model) => Err(Error::Model),
            _ => Ok(()),
        }
    }
    fn drain(&mut self) -> Result<Vec<Notice>, Error> {
        match self.fail {
            Some(Error::Callback) => Err(Error::Callback),
            _ => Ok(std::mem::take(&mut self.notices)),
        }
    }
    fn dispose(&mut self, binding: &Binding) -> Result<(), Error> {
        self.disposed = true;
        if self.fail == Some(Error::Cleanup) {
            return Err(Error::Native);
        }
        if !self.omit_destroy {
            self.notices.push(Notice {
                binding: if self.stale_destroy {
                    self.original.clone().expect("create precedes disposal")
                } else {
                    binding.clone()
                },
                kind: NoticeKind::Destroyed,
            });
        }
        Ok(())
    }
    fn cleanup(&mut self) -> Result<(), Error> {
        self.cleaned = true;
        Ok(())
    }
    fn remaining(&self) -> Option<u32> {
        Some(0)
    }
}

#[test]
fn lifecycle_when_valid_callbacks() {
    // Given
    let mut driver = Fake::default();
    // When
    let result = run(&mut driver).expect("synthetic lifecycle");
    // Then
    assert_eq!(
        result,
        Counters {
            created: 1,
            destroyed: 1,
            rejected: 1,
            main_unchanged: true
        }
    );
}
#[test]
fn cleanup_remains_boundary_owned_when_scenario_finishes() {
    let mut driver = Fake::default(); // Given
    run(&mut driver).expect("synthetic lifecycle"); // When
    assert!(!driver.cleaned); // Then
}
#[test]
fn native_partial_failure_stops_before_disposal() {
    let mut driver = Fake {
        fail: Some(Error::Native),
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Native)); // When / Then
    assert!(!driver.disposed);
}
#[test]
fn missing_creation_notice_fails_closed() {
    let mut driver = Fake {
        omit_create: true,
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Callback)); // When / Then
}
#[test]
fn duplicate_creation_notice_fails_closed() {
    let mut driver = Fake {
        duplicate_create: true,
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Callback)); // When / Then
}
#[test]
fn close_request_during_creation_fails_closed() {
    let mut driver = Fake {
        close_create: true,
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Callback)); // When / Then
}
#[test]
fn stale_creation_binding_cannot_complete_disposal() {
    let mut driver = Fake {
        stale_destroy: true,
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Callback)); // When / Then
}
#[test]
fn missing_destruction_notice_fails_closed() {
    let mut driver = Fake {
        omit_destroy: true,
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Callback)); // When / Then
}
#[test]
fn disposal_native_failure_remains_failure() {
    let mut driver = Fake {
        fail: Some(Error::Cleanup),
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Native)); // When / Then
}
#[test]
fn callback_queue_failure_stops_scenario() {
    let mut driver = Fake {
        fail: Some(Error::Callback),
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Callback)); // When / Then
}
#[test]
fn observation_failure_stops_before_disposal() {
    let mut driver = Fake {
        fail: Some(Error::Model),
        ..Fake::default()
    }; // Given
    assert_eq!(run(&mut driver), Err(Error::Model)); // When / Then
    assert!(!driver.disposed);
}
#[test]
fn cleanup_failure_has_priority_over_panic() {
    let mut report = Report::new(Err(Error::Panic)); // Given
    report.finish_cleanup(Err(Error::Cleanup), None); // When
    assert_eq!(report.code(), 5); // Then
}
#[test]
fn panic_has_priority_over_evidence_failure() {
    let mut report = Report::new(Err(Error::Panic));
    report.finish_cleanup(Ok(()), Some(0)); // Given
    report.evidence_failed = true; // When
    assert_eq!(report.code(), 4); // Then
}
#[test]
fn unknown_remaining_count_is_cleanup_failure() {
    let mut report = Report::new(Err(Error::Native)); // Given
    report.finish_cleanup(Ok(()), None); // When
    assert_eq!(report.code(), 5); // Then
}
#[test]
fn strict_evidence_rejects_unknown_fields_and_versions() {
    let report = Report::new(Err(Error::Gate));
    let mut value =
        serde_json::to_value(Evidence::new(String::new(), String::new(), &report)).unwrap(); // Given
    value["private_path"] = "SECRET".into(); // When
    assert!(serde_json::from_value::<Evidence>(value).is_err()); // Then
    for (key, invalid) in [
        ("schema_version", serde_json::json!(2)),
        ("runner_kind", serde_json::json!("OTHER")),
    ] {
        let mut value =
            serde_json::to_value(Evidence::new(String::new(), String::new(), &report)).unwrap();
        value[key] = invalid;
        assert!(serde_json::from_value::<Evidence>(value).is_err());
    }
}
#[test]
fn output_contains_only_fixed_protocol_values() {
    let mut report = Report::new(Err(Error::Panic));
    report.finish_cleanup(Ok(()), Some(0));
    let mut output = Vec::new(); // Given
    let code = report.write_to(&mut output); // When
    assert_eq!(code, 4); // Then
    assert_eq!(
        String::from_utf8(output).unwrap(),
        "WINDOW=FAIL\nCAPABILITY=NOT_OBSERVED\nE_PANIC\n"
    );
}

#[test]
fn nullable_evidence_is_explicit_and_private_fixture_is_absent() {
    let mut driver = Fake::default();
    let report = Report::new(run(&mut driver));
    let evidence = Evidence::new(String::from("source"), String::from("artifact"), &report);
    let value = serde_json::to_value(&evidence).unwrap();
    let encoded = serde_json::to_string(&evidence).unwrap();
    assert!(!encoded.contains("synthetic-unsaved-note"));
    for key in [
        "binding",
        "hwnd",
        "pid",
        "tid",
        "title",
        "path",
        "unsaved_note",
    ] {
        assert!(value.get(key).is_none());
    }
    for key in ["counters", "remaining_own_windows", "reason"] {
        let mut missing = value.clone();
        missing.as_object_mut().unwrap().remove(key);
        assert!(serde_json::from_value::<Evidence>(missing).is_err());
    }
}
