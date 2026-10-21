use super::{Action, Event, Identity, Lease, Observed};
use std::sync::Arc;

fn fixture() -> (Lease, Observed) {
    let webview = Arc::new(Identity);
    let window = Arc::new(Identity);
    let lease = Lease::new(Arc::clone(&webview), Arc::clone(&window));
    let observed = Observed {
        webview: Some(webview),
        window: Some(Arc::clone(&window)),
        caller_window: Some(window),
        revoked: false,
    };
    (lease, observed)
}

#[test]
fn registered_pair_and_actual_window_are_required() {
    let (lease, mut observed) = fixture();
    assert!(lease.authorize(&observed));
    assert!(lease.authorize_window(&observed));
    observed.caller_window = Some(Arc::new(Identity));
    assert!(lease.authorize(&observed));
    assert!(!lease.authorize_window(&observed));
    observed.caller_window = None;
    assert!(!lease.authorize_window(&observed));
}

#[test]
fn missing_replaced_or_revoked_pair_has_zero_effects() {
    for invalid in 0..5 {
        let (lease, mut observed) = fixture();
        match invalid {
            0 => observed.webview = None,
            1 => observed.window = None,
            2 => observed.webview = Some(Arc::new(Identity)),
            3 => observed.window = Some(Arc::new(Identity)),
            4 => observed.revoked = true,
            _ => unreachable!(),
        }
        let mut effects = 0;
        assert!(!lease.authorize(&observed));
        assert!(!lease.dispatch(&observed, Event::Destroyed, |_| effects += 1));
        assert_eq!(effects, 0);
    }
}

#[test]
fn same_label_replacement_cannot_reuse_old_lease() {
    let (old, _) = fixture();
    let (replacement, current) = fixture();
    assert!(!old.authorize(&current));
    assert!(replacement.authorize(&current));
    assert!(replacement.clone().authorize_window(&current));
}

#[test]
fn non_main_window_callbacks_have_zero_effects_for_every_event() {
    let (lease, mut observed) = fixture();
    observed.caller_window = Some(Arc::new(Identity));
    for event in events() {
        let mut effects = 0;
        assert!(!lease.dispatch(&observed, event, |_| effects += 1));
        assert_eq!(effects, 0);
    }
}

fn events() -> [Event; 9] {
    [
        Event::Close {
            close_to_tray: false,
            quitting: false,
        },
        Event::Close {
            close_to_tray: false,
            quitting: true,
        },
        Event::Close {
            close_to_tray: true,
            quitting: false,
        },
        Event::Close {
            close_to_tray: true,
            quitting: true,
        },
        Event::Drop {
            purchase_active: false,
        },
        Event::Drop {
            purchase_active: true,
        },
        Event::Destroyed,
        Event::Other,
        Event::FocusOther,
    ]
}

#[test]
fn authorized_actions_preserve_close_drop_and_retirement_policy() {
    let (lease, observed) = fixture();
    let expected = [
        None,
        None,
        Some(Action::HideMain),
        None,
        Some(Action::ForwardDrop),
        Some(Action::AnalyzeDrop),
        Some(Action::RetireMain),
        None,
        None,
    ];
    for (event, expected) in events().into_iter().zip(expected) {
        let mut actual = None;
        assert_eq!(
            lease.dispatch(&observed, event, |action| actual = Some(action)),
            expected.is_some()
        );
        assert_eq!(actual, expected);
    }
}

#[test]
fn retirement_identity_remains_available_after_registry_removal() {
    let (lease, mut observed) = fixture();
    let own_window = observed.window.take().unwrap();
    assert!(!lease.authorize(&observed));
    assert!(lease.owns_window(&own_window));
    assert!(!lease.owns_window(&Arc::new(Identity)));
}
