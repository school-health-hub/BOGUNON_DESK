use super::*;
fn topology() -> Topology {
    let p = ProcessIdentity {
        pid: 1,
        created: 2,
        session: 3,
        image: vec![69],
    };
    let w = |id, class: &str| WindowIdentity {
        id: WindowId(id),
        process: p.clone(),
        thread: 4,
        class: class.into(),
    };
    Topology {
        shell: w(1, "Progman"),
        progman: w(1, "Progman"),
        host: w(1, "Progman"),
        def_view: w(2, "SHELLDLL_DefView"),
        def_view_parent: WindowId(1),
        workers: vec![Worker {
            identity: w(3, "WorkerW"),
            parent: Parent::DesktopRoot(WindowId(0)),
            visible: true,
            usable: true,
            has_def_view: false,
            follows_host: true,
        }],
    }
}
#[test]
fn counts_cannot_substitute_for_unique_policy_evidence() {
    let mut t = topology();
    let good = t.workers[0].clone();
    t.workers = vec![good.clone(); 15];
    for w in &mut t.workers {
        w.visible = false;
    }
    t.workers[11] = good;
    let (selected, facts) = classify_shell(&t, &[69], 3).unwrap();
    assert_eq!(selected, Some(t.workers[11].identity.clone()));
    assert_eq!(facts.iter().filter(|v| v.iter().all(|b| *b)).count(), 1);
    t.workers[0].visible = true;
    assert!(classify_shell(&t, &[69], 3).unwrap().0.is_none());
}
#[test]
fn every_existing_worker_policy_condition_is_preserved() {
    for case in 0..8 {
        let mut t = topology();
        let w = &mut t.workers[0];
        match case {
            0 => w.identity.class = "Other".into(),
            1 => w.identity.process.created += 1,
            2 => w.parent = Parent::Child(t.progman.clone()),
            3 => w.visible = false,
            4 => w.usable = false,
            5 => w.has_def_view = true,
            6 => w.follows_host = false,
            _ => w.identity.id = t.host.id,
        }
        assert!(classify_shell(&t, &[69], 3).unwrap().0.is_none());
    }
}
#[test]
fn shell_identity_session_and_empty_candidates_fail_closed() {
    let t = topology();
    assert!(classify_shell(&t, &[69], 99).is_err());
    assert!(classify_shell(&t, &[70], 3).is_err());
    let mut t = t;
    t.def_view_parent = WindowId(99);
    assert!(classify_shell(&t, &[69], 3).is_err());
    let mut t = topology();
    t.workers.clear();
    assert!(classify_shell(&t, &[69], 3).unwrap().0.is_none());
}
