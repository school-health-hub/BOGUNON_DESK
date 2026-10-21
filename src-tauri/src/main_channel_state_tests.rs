use super::ChannelState;
#[test]
fn reload_and_reregister_reject_old_leases_and_old_unregistration() {
    let mut state = ChannelState::default();
    assert!(!state.matches(None));
    let old = state.register(1).unwrap();
    assert!(state.matches(Some(old)));
    state.invalidate();
    assert!(!state.matches(Some(old)));
    let new = state.register(2).unwrap();
    assert!(new > old);
    state.unregister(old);
    assert!(state.matches(Some(new)));
    assert!(state.deliver(Some(old), |_, _| Ok(())).is_err());
    assert!(state.deliver(Some(new), |_, _| Err(())).is_err());
    assert!(!state.matches(Some(new)));
}
#[test]
fn replacement_and_exhaustion_fail_closed() {
    let mut state = ChannelState::default();
    let first = state.register(1).unwrap();
    let second = state.register(2).unwrap();
    assert!(!state.matches(Some(first)));
    assert!(state
        .deliver(Some(second), |value, _| {
            assert_eq!(*value, 2);
            Ok(())
        })
        .is_ok());
    state.next = 9_007_199_254_740_991;
    assert!(state.register(3).is_err());
    assert!(!state.matches(Some(second)));
}

#[test]
fn transfer_id_exhaustion_revokes_and_never_calls_sender() {
    let mut state = ChannelState::default();
    let epoch = state.register(1).unwrap();
    state.transfer = 9_007_199_254_740_991;
    assert!(state
        .deliver(Some(epoch), |_, _| panic!("exhaustion must not send"))
        .is_err());
    assert!(!state.matches(Some(epoch)));
}
