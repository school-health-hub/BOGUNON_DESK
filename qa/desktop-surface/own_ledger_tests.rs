use crate::{
    disposable_surface::Support, own_callbacks::Ledger, own_coordinator::NoticeKind,
    own_result::Error, surface_event_router::Router, surface_event_types::MainState,
};

#[test]
fn destroyed_notice_keeps_disposal_binding() {
    // Given a registered creation and a newer disposal binding.
    let main = MainState::new(1, 0, String::new());
    let mut router = Router::new(main.projection(), 1);
    let creation = router.create(Support::Supported).expect("creation");
    router
        .created(&creation, crate::disposable_surface::Completion::Succeeded)
        .expect("created");
    let disposal = router.dispose().expect("disposal");
    let mut ledger = Ledger::new();
    let token = ledger.reserve(&creation).expect("reserved");
    ledger.register(10, token).expect("registered");
    ledger.bind_disposal(&disposal).expect("bound");
    // When destruction retires the window.
    ledger.notice(10, NoticeKind::Destroyed).expect("destroyed");
    // Then the queued notification retains the disposal ticket.
    let mut notices = Vec::with_capacity(16);
    ledger.drain(&mut notices).expect("drain");
    assert_eq!(notices[0].binding, disposal);
    assert!(!ledger.matches(10, token));
}

#[test]
fn tombstone_prevents_numeric_handle_adoption() {
    // Given a retired numeric handle and a fresh reservation.
    let main = MainState::new(1, 0, String::new());
    let mut router = Router::new(main.projection(), 1);
    let binding = router.create(Support::Supported).expect("creation");
    let mut ledger = Ledger::new();
    let first = ledger.reserve(&binding).expect("reserved");
    ledger.register(10, first).expect("registered");
    ledger.notice(10, NoticeKind::Destroyed).expect("destroyed");
    let second = ledger.reserve(&binding).expect("replacement reserved");
    // When a second native creation presents the retired numeric handle.
    let result = ledger.register(10, second);
    // Then the reservation cannot adopt that handle.
    assert_eq!(result, Err(Error::Callback));
    assert!(ledger.live.is_none());
}

#[test]
fn full_queue_still_retires_destroyed_window() {
    // Given the bounded callback queue at capacity.
    let main = MainState::new(1, 0, String::new());
    let mut router = Router::new(main.projection(), 1);
    let binding = router.create(Support::Supported).expect("creation");
    let mut ledger = Ledger::new();
    let token = ledger.reserve(&binding).expect("reserved");
    ledger.register(10, token).expect("registered");
    for _ in 0..16 {
        ledger
            .notice(10, NoticeKind::CloseRequested)
            .expect("bounded notice");
    }
    // When destruction occurs after overflow.
    let result = ledger.notice(10, NoticeKind::Destroyed);
    // Then failure is explicit and cleanup cannot destroy the retired handle.
    assert_eq!(result, Err(Error::Callback));
    assert!(!ledger.matches(10, token));
}
