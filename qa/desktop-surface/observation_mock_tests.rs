use crate::{
    observation::*,
    observation_fixture::Fake,
    window_lifecycle::WindowError,
    window_observation::{relations, unchanged},
};

#[test]
fn identical_synthetic_window_is_unchanged_without_shell_access() {
    let fake = Fake::default();
    assert_eq!(unchanged(&fake, &fake.window, &fake.window), Ok(()));
}
#[test]
fn every_observed_state_change_fails_invariance() {
    let fake = Fake::default();
    for field in 0..15 {
        let mut after = fake.window.clone();
        match field {
            0 => after.identity.process.created += 1,
            1 => after.parent = Parent::Child(fake.shell.host.clone()),
            2 => after.owner = Some(fake.shell.progman.clone()),
            3 => after.style += 1,
            4 => after.extended_style += 1,
            5 => after.placement.flags += 1,
            6 => after.screen.0 += 1,
            7 => after.client.2 += 1,
            8 => after.visible = !after.visible,
            9 => after.minimized = !after.minimized,
            10 => after.maximized = !after.maximized,
            11 => after.monitor.work.0 += 1,
            12 => after.dpi += 1,
            13 => after.context = DpiContext(2),
            14 => after.caller_context = DpiContext(2),
            _ => unreachable!(),
        }
        assert_eq!(
            unchanged(&fake, &fake.window, &after),
            Err(WindowError::Observation)
        );
    }
}
#[test]
fn native_relationship_contract_distinguishes_parent_and_owner() {
    let fake = Fake::default();
    let mut root = fake.window.clone();
    root.visible = false;
    let mut owned = root.clone();
    owned.identity.id = WindowId(101);
    owned.owner = Some(root.identity.clone());
    let mut child = root.clone();
    child.identity.id = WindowId(102);
    child.parent = Parent::Child(root.identity.clone());
    assert_eq!(
        relations(&[root.clone(), owned.clone(), child.clone()]),
        Ok(())
    );
    child.owner = Some(root.identity.clone());
    assert_eq!(
        relations(&[root, owned, child]),
        Err(WindowError::Observation)
    );
}
