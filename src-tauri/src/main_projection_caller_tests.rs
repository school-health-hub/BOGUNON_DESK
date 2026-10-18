use super::*;
#[path = "main_caller_identity.rs"]
#[expect(
    dead_code,
    reason = "Fixture includes pure verifier without its runtime registration path"
)]
mod caller_identity;
use caller_identity::{Identity, Observed, Pinned};
use std::{cell::Cell, sync::Arc};

#[test]
fn main_identity_allows_publication_and_non_main_cannot_mutate_cache() {
    for (label, same_resource, allowed) in [
        ("main", true, true),
        ("surface", true, false),
        ("main", false, false),
    ] {
        // Given the actual pure caller verifier and pure lifetime implementation.
        let pinned = Pinned {
            webview: Arc::new(Identity),
            window: Arc::new(Identity),
        };
        let observed = Observed {
            webview_label: label,
            window_label: "main",
            caller_webview: Some(if same_resource {
                Arc::clone(&pinned.webview)
            } else {
                Arc::new(Identity)
            }),
            caller_window: Some(Arc::clone(&pinned.window)),
            registered_webview: Some(Arc::clone(&pinned.webview)),
            registered_window: Some(Arc::clone(&pinned.window)),
        };
        let mut lifetime = state::Lifetime::new();
        let writes = Cell::new(0);
        // When authorization gates the producer, as in the runtime bridge.
        let result = caller_identity::dispatch(pinned.authorize(observed), || {
            writes.set(writes.get() + 1);
            let lease = lifetime.publisher_lease()?;
            lifetime.publish_projection(&lease, 1)
        });
        // Then rejected callers cause zero publication effects.
        assert_eq!(result.is_ok(), allowed);
        assert_eq!(writes.get(), usize::from(allowed));
        assert_eq!(lifetime.projection().is_ok(), allowed);
    }
}
#[test]
fn approved_projection_serializes_only_revision() {
    // Given a value from the actual pure publisher.
    let mut lifetime = state::Lifetime::new();
    let lease = lifetime.publisher_lease().unwrap();
    let approved = lifetime.publish_projection(&lease, 7).unwrap();
    // When the runtime's allowlisted output is serialized.
    let wire = Projection {
        revision: approved.revision(),
    };
    // Then no authority, source payload or identity is exposed.
    assert_eq!(
        serde_json::to_value(wire).unwrap(),
        serde_json::json!({"revision": 7})
    );
}
