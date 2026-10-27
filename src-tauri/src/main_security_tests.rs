use super::{install_steps, install_tail_steps, InstallError, InstallProgress, InstallStage};
use crate::main_lifetime;
use std::cell::RefCell;

#[test]
fn given_navigation_is_ready_when_security_tail_runs_then_host_follows_only_successful_lifetime_and_events(
) {
    // Given each possible tail failure and the real shared tail installer.
    for failed in [
        None,
        Some(InstallStage::Lifetime),
        Some(InstallStage::Events),
    ] {
        let operations = RefCell::new(Vec::new());
        // When the deferred security tail is continued.
        let result = install_tail_steps(
            &mut |_| {},
            || {
                operations.borrow_mut().push("lifetime");
                if failed == Some(InstallStage::Lifetime) {
                    Err(main_lifetime::InstallError::OriginMismatch)
                } else {
                    Ok(())
                }
            },
            || {
                operations.borrow_mut().push("events");
                if failed == Some(InstallStage::Events) {
                    Err(())
                } else {
                    Ok(())
                }
            },
        );
        if result.is_ok() {
            operations.borrow_mut().push("host");
        }
        // Then no failure can reach the Host continuation.
        let expected = match failed {
            None => vec!["lifetime", "events", "host"],
            Some(InstallStage::Lifetime) => vec!["lifetime"],
            Some(InstallStage::Events) => vec!["lifetime", "events"],
            Some(InstallStage::Caller) => unreachable!(),
        };
        assert_eq!(operations.into_inner(), expected);
    }
}

#[test]
fn given_each_security_step_succeeds_when_installed_then_order_is_fixed() {
    let observed = RefCell::new(Vec::new());

    let result = install_steps(
        &mut |stage| observed.borrow_mut().push(stage),
        || Ok(()),
        || Ok(()),
        || Ok(()),
    );

    assert_eq!(result, Ok(()));
    assert_eq!(
        observed.into_inner(),
        vec![
            InstallProgress::Started(InstallStage::Caller),
            InstallProgress::Completed(InstallStage::Caller),
            InstallProgress::Started(InstallStage::Lifetime),
            InstallProgress::Completed(InstallStage::Lifetime),
            InstallProgress::Started(InstallStage::Events),
            InstallProgress::Completed(InstallStage::Events),
        ]
    );
}

#[test]
fn given_a_security_step_fails_when_installed_then_later_steps_are_not_started() {
    for (failed_stage, expected_error, expected_observed) in [
        (
            InstallStage::Caller,
            InstallError::Caller,
            vec![InstallProgress::Started(InstallStage::Caller)],
        ),
        (
            InstallStage::Lifetime,
            InstallError::Lifetime(main_lifetime::InstallError::OriginMismatch),
            vec![
                InstallProgress::Started(InstallStage::Caller),
                InstallProgress::Completed(InstallStage::Caller),
                InstallProgress::Started(InstallStage::Lifetime),
            ],
        ),
        (
            InstallStage::Events,
            InstallError::Events,
            vec![
                InstallProgress::Started(InstallStage::Caller),
                InstallProgress::Completed(InstallStage::Caller),
                InstallProgress::Started(InstallStage::Lifetime),
                InstallProgress::Completed(InstallStage::Lifetime),
                InstallProgress::Started(InstallStage::Events),
            ],
        ),
    ] {
        let observed = RefCell::new(Vec::new());
        let step = RefCell::new(0_u8);
        let result = install_steps(
            &mut |stage| observed.borrow_mut().push(stage),
            || {
                *step.borrow_mut() += 1;
                (failed_stage != InstallStage::Caller)
                    .then_some(())
                    .ok_or(())
            },
            || {
                *step.borrow_mut() += 1;
                (failed_stage != InstallStage::Lifetime)
                    .then_some(())
                    .ok_or(main_lifetime::InstallError::OriginMismatch)
            },
            || {
                *step.borrow_mut() += 1;
                (failed_stage != InstallStage::Events)
                    .then_some(())
                    .ok_or(())
            },
        );

        let expected_calls = match failed_stage {
            InstallStage::Caller => 1,
            InstallStage::Lifetime => 2,
            InstallStage::Events => 3,
        };
        assert_eq!(result, Err(expected_error));
        assert_eq!(observed.into_inner(), expected_observed);
        assert_eq!(usize::from(*step.borrow()), expected_calls);
    }
}
