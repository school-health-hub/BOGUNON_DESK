use super::observation_fixture::Fake;
use super::{observation::*, observation_reader::*};

#[test]
fn zero_style_and_absent_owner_are_not_query_failures() {
    assert_eq!(checked_style(0, 0), Ok(0));
    assert!(checked_style(0, 5).is_err());
    assert_eq!(checked_optional_window(None, 0), Ok(None));
    assert!(checked_optional_window(None, 5).is_err());
}

#[test]
fn synthetic_snapshot_collects_without_mutation_or_attach_authorization() {
    let mut reader = Reader(Fake::default());
    let before = reader.0.window.clone();
    let snapshot = reader.collect(before.identity.id).unwrap();
    assert_eq!(snapshot.main.identity, before.identity);
    assert_eq!(snapshot.worker, reader.0.shell.workers[0].identity);
    assert_eq!(snapshot.explorer, reader.0.shell.shell.process);
    assert!(snapshot.finished >= snapshot.started);
    assert_eq!(snapshot.main.screen, before.screen);
    assert_eq!(snapshot.main.client, before.client);
    assert_eq!(snapshot.main.monitor, before.monitor);
    assert_eq!(snapshot.main.placement, before.placement);
    assert_eq!(
        (
            snapshot.main.visible,
            snapshot.main.minimized,
            snapshot.main.maximized
        ),
        (true, false, false)
    );
    assert_eq!((snapshot.main.style, snapshot.main.extended_style), (0, 0));
    assert!(snapshot.main.owner.is_none());
    assert_eq!(reader.0.calls, reader.0.closes.get());
}

#[test]
fn parent_and_owner_remain_distinct() {
    let mut fake = Fake::default();
    fake.window.owner = Some(fake.shell.progman.clone());
    fake.window.parent = Parent::Child(fake.shell.host.clone());
    let snapshot = Reader(fake).collect(WindowId(100)).unwrap();
    assert_ne!(
        snapshot.main.owner.as_ref().unwrap().id,
        match snapshot.main.parent {
            Parent::Child(parent) => parent.id,
            Parent::DesktopRoot(id) => id,
        }
    );
}

#[test]
fn explorer_image_session_creation_or_pid_mismatch_is_rejected() {
    for variant in 0..4 {
        let mut fake = Fake::default();
        match variant {
            0 => fake.shell.shell.process.image = "C:\\fake\\explorer.exe".encode_utf16().collect(),
            1 => fake.shell.shell.process.session += 1,
            2 => fake.shell.shell.process.created += 1,
            3 => fake.shell.shell.process.pid += 1,
            _ => unreachable!(),
        }
        assert!(matches!(
            Reader(fake).collect(WindowId(100)),
            Err(QueryError::ShellIdentity)
        ));
    }
}

#[test]
fn pid_reuse_during_collection_is_rejected() {
    let fake = Fake {
        changed_identity: true,
        ..Fake::default()
    };
    assert!(matches!(
        Reader(fake).collect(WindowId(100)),
        Err(QueryError::IdentityChanged)
    ));
}

#[test]
fn every_query_failure_returns_no_snapshot_and_releases_leases() {
    for point in 1..=5 {
        let mut reader = Reader(Fake {
            fail_at: Some(point),
            ..Fake::default()
        });
        assert!(matches!(
            reader.collect(WindowId(100)),
            Err(QueryError::Api(_, 5))
        ));
        assert_eq!(reader.0.calls, point);
        assert_eq!(reader.0.closes.get(), point);
    }
}

#[test]
fn topology_change_during_collection_is_rejected() {
    let fake = Fake {
        changed_topology: true,
        ..Fake::default()
    };
    assert!(matches!(
        Reader(fake).collect(WindowId(100)),
        Err(QueryError::TopologyChanged)
    ));
}

#[test]
fn ambiguous_or_missing_worker_is_rejected() {
    for duplicate in [true, false] {
        let mut fake = Fake::default();
        if duplicate {
            let mut second = fake.shell.workers[0].clone();
            second.identity.id = WindowId(14);
            fake.shell.workers.push(second);
        } else {
            fake.shell.workers.clear();
        }
        assert!(matches!(
            Reader(fake).collect(WindowId(100)),
            Err(error) if error == if duplicate {
                QueryError::AmbiguousWorker
            } else {
                QueryError::NoEligibleWorker
            }
        ));
    }
}

#[test]
fn dpi_uses_provider_semantic_comparison_not_integer_equality() {
    let mut reader = Reader(Fake::default());
    assert_ne!(reader.0.window.context.0, reader.0.window.caller_context.0);
    assert!(reader.collect(WindowId(100)).is_ok());
    reader.0.window.caller_context = DpiContext(2);
    assert!(matches!(
        reader.collect(WindowId(100)),
        Err(QueryError::DpiMismatch)
    ));
}

#[test]
fn screen_client_and_placement_are_different_types_and_spaces() {
    use std::any::TypeId;
    assert_ne!(TypeId::of::<ScreenRect>(), TypeId::of::<ClientRect>());
    assert_ne!(TypeId::of::<ScreenRect>(), TypeId::of::<PlacementRect>());
    assert_ne!(PlacementSpace::Workspace, PlacementSpace::Screen);
}

#[test]
fn explicit_requery_and_topology_check_detect_stale_observations() {
    let mut reader = Reader(Fake::default());
    let snapshot = reader.collect(WindowId(100)).unwrap();
    assert_eq!(
        reader.requery_identity(WindowId(100)).unwrap(),
        snapshot.main.identity
    );
    assert!(reader.topology_consistent(&snapshot).is_ok());
    reader.0.changed_topology = true;
    assert!(matches!(
        reader.topology_consistent(&snapshot),
        Err(QueryError::TopologyChanged)
    ));
}

#[test]
fn lease_closes_exactly_once_on_early_return() {
    use std::cell::Cell;
    let closed = Cell::new(0);
    let run = || -> Result<(), QueryError> {
        let lease = Lease::new(7, |value| {
            assert_eq!(value, 7);
            closed.set(closed.get() + 1);
        });
        assert_eq!(lease.get(), Some(&7));
        Err(QueryError::InvalidValue("synthetic"))
    };
    assert!(run().is_err());
    assert_eq!(closed.get(), 1);
}

#[test]
fn image_path_normalization_is_bounded_and_rejects_relative_or_traversal() {
    use super::read_only_process::normalize_path;
    let normalized = normalize_path(
        &"\\\\?\\C:/Windows/explorer.exe"
            .encode_utf16()
            .collect::<Vec<_>>(),
    )
    .unwrap();
    assert_eq!(
        normalized,
        "C:\\Windows\\explorer.exe"
            .encode_utf16()
            .collect::<Vec<_>>()
    );
    for path in ["explorer.exe", "C:\\Windows\\..\\fake.exe", "C:\\bad\0.exe"] {
        assert!(normalize_path(&path.encode_utf16().collect::<Vec<_>>()).is_err());
    }
}

#[test]
fn native_factory_is_link_checked_but_never_called() {
    let factory: fn() -> Result<Reader<super::read_only_windows::NativeQueries>, QueryError> =
        super::read_only_windows::reader;
    let _ = factory;
}

#[test]
fn native_candidate_projection_does_not_hide_multiple_following_workers() {
    use super::read_only_topology::following_workers;
    let order = [WindowId(11), WindowId(13), WindowId(14)];
    assert_eq!(
        following_workers(&order, Some(WindowId(13))).unwrap(),
        &order[1..]
    );
    assert!(following_workers(&order, Some(WindowId(99))).is_err());
    assert!(following_workers(&order, None).unwrap().is_empty());
}
#[test]
fn native_hresult_errors_keep_their_error_domain() {
    use windows::core::{Error, HRESULT};
    for code in [0x80070005u32, 0x80004005u32] {
        let signed = i32::from_ne_bytes(code.to_ne_bytes());
        let result =
            super::read_only_process::api::<()>(Err(Error::from_hresult(HRESULT(signed))), "probe");
        assert_eq!(result, Err(QueryError::Hresult("probe", signed)));
    }
    assert_eq!(
        checked_style(0, 5),
        Err(QueryError::Api("GetWindowLongPtrW", 5))
    );
}
