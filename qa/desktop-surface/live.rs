use crate::{
    gate,
    observation::*,
    observation_reader::Reader,
    outcome::{Capability, Report, WindowResult},
    test_window::NativeWindows,
    window_lifecycle::{OwnedWindows, WindowError},
    window_observation::{relations, unchanged},
};

fn observe(
    reader: &mut Reader<crate::read_only_windows::NativeQueries>,
    ids: &[WindowId],
) -> Report {
    let before = ids
        .iter()
        .map(|id| reader.0.window(*id))
        .collect::<Result<Vec<_>, _>>();
    let Ok(before) = before else {
        return Report {
            window: WindowResult::Fail,
            capability: Capability::NotObserved,
        };
    };
    if relations(&before).is_err() {
        return Report {
            window: WindowResult::Fail,
            capability: Capability::NotObserved,
        };
    }
    let capability = reader.collect(before[0].identity.id).and_then(|snapshot| {
        unchanged(&reader.0, &before[0], &snapshot.main)
            .map_err(|_| QueryError::IdentityChanged)?;
        reader.topology_consistent(&snapshot)
    });
    let window = before.iter().try_for_each(|old| {
        let after = reader
            .0
            .window(old.identity.id)
            .map_err(|_| WindowError::Observation)?;
        unchanged(&reader.0, old, &after)
    });
    Report::finish(window, capability, Ok(()))
}

#[test]
#[ignore = "separate approval, approved executable manifest and explicit opt-in required"]
fn approved_read_only_windows_diagnostic() {
    let permit = match gate::authorize() {
        Ok(permit) => permit,
        Err(_) => {
            eprintln!("{} GATE=BLOCKED", Report::not_run().line());
            panic!("diagnostic gate blocked");
        }
    };
    let api = NativeWindows::new(permit).unwrap_or_else(|_| panic!("window setup blocked"));
    let mut windows =
        OwnedWindows::register(api).unwrap_or_else(|_| panic!("class registration failed"));
    let result = windows.create_all();
    let mut report = match result {
        Ok(()) => match crate::read_only_windows::reader() {
            Ok(mut reader) => observe(&mut reader, windows.ids()),
            Err(_) => Report {
                window: WindowResult::Fail,
                capability: Capability::NotObserved,
            },
        },
        Err(_) => Report {
            window: WindowResult::Fail,
            capability: Capability::NotObserved,
        },
    };
    if windows.close().is_err() {
        report.window = WindowResult::Fail;
        eprintln!("FAIL_CLEANUP");
    }
    println!("{}", report.line());
    assert_eq!(
        report.window,
        WindowResult::Pass,
        "own-window observation failed"
    );
    assert!(
        matches!(
            report.capability,
            Capability::Supported | Capability::Unsupported
        ),
        "capability observation failed"
    );
}
