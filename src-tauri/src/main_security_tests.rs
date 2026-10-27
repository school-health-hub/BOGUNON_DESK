use super::{install_steps, InstallError, InstallProgress, InstallStage};
use std::cell::RefCell;

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
            InstallError::Lifetime,
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
        let fail = |stage: InstallStage, counter: &RefCell<u8>| {
            *counter.borrow_mut() += 1;
            if stage == failed_stage {
                Err(())
            } else {
                Ok(())
            }
        };

        let result = install_steps(
            &mut |stage| observed.borrow_mut().push(stage),
            || fail(InstallStage::Caller, &step),
            || fail(InstallStage::Lifetime, &step),
            || fail(InstallStage::Events, &step),
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
