//! Synthetic SQLCipher restore, durability and interruption regressions.
use super::*;
use crate::my_finance_snapshot::{IncomeKind, RestoreDecision, TaxCategory};

fn forward(current: &FinanceSnapshot) -> FinanceSnapshot {
    let mut next = current.clone();
    next.identity.revision += 1;
    next.identity.history.push(Uuid::new_v4());
    next.income.push(IncomeEntry {
        id: Uuid::new_v4(),
        source_name: "SYNTHETIC RESTORE ONLY".into(),
        income_kind: IncomeKind::Lecture,
        contract_label: String::new(),
        tax_category: TaxCategory::Unverified,
        tax_category_verified: false,
        earned_on: "2026-10-16".into(),
        paid_on: None,
        gross_krw: 100_000,
        deductions: vec![],
        net_krw: 100_000,
        notes: "synthetic restored".into(),
    });
    next
}
fn seed(store: &mut FinanceStore) -> FinanceSnapshot {
    let initial = store.load().unwrap();
    let mut entry = forward(&initial).income.remove(0);
    entry.source_name = "SYNTHETIC EXISTING DATA".into();
    entry.notes = "synthetic original must survive".into();
    store
        .apply(&initial.identity, IncomeMutation::Create(entry))
        .unwrap()
}
fn safety(store: &FinanceStore) -> FinanceSnapshot {
    let bytes: Vec<u8> = store
        .0
        .query_row(
            "SELECT payload FROM finance_restore_safety ORDER BY rowid DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}
#[test]
fn my_finance_restore_durable_safety_and_exact_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[42; 32]).unwrap();
    let original = seed(&mut store);
    let next = forward(&original);
    assert_eq!(store.restore(&original, next.clone()).unwrap(), next);
    assert_eq!(safety(&store), original);
    drop(store);
    let store = FinanceStore::open(&path, &[42; 32]).unwrap();
    assert_eq!(store.load().unwrap(), next);
    assert_eq!(safety(&store), original);
    let bytes = std::fs::read(&path).unwrap();
    for marker in ["datasetId", "SYNTHETIC RESTORE ONLY", "synthetic restored"] {
        assert!(!bytes.windows(marker.len()).any(|w| w == marker.as_bytes()));
    }
    assert!(FinanceStore::open(&path, &[43; 32]).is_err());
}
#[test]
fn my_finance_restore_blocks_all_ineligible_cases_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[42; 32]).unwrap();
    let first = seed(&mut store);
    let current = forward(&first);
    store.restore(&first, current.clone()).unwrap();
    let mut other = forward(&current);
    other.identity.dataset_id = Uuid::new_v4();
    let mut fork = forward(&current);
    fork.identity.history[0] = Uuid::new_v4();
    let mut legacy = forward(&current);
    legacy.identity.schema_version = 1;
    let mut altered = current.clone();
    altered.income[0].notes = "synthetic conflicting content".into();
    let mut unsafe_amount = forward(&current);
    unsafe_amount.income[0].gross_krw = MAX_SAFE_KRW + 1;
    unsafe_amount.income[0].net_krw = MAX_SAFE_KRW + 1;
    for (incoming, reason) in [
        (first, RestoreDecision::RejectStale),
        (other, RestoreDecision::RejectDifferentDataset),
        (fork, RestoreDecision::RejectDiverged),
        (legacy, RestoreDecision::RejectInvalid),
        (altered, RestoreDecision::RejectDiverged),
        (current.clone(), RestoreDecision::AlreadyCurrent),
        (unsafe_amount, RestoreDecision::RejectInvalid),
    ] {
        let before = std::fs::read(&path).unwrap();
        assert_eq!(restore_decision(&current, &incoming), reason);
        assert!(store.restore(&current, incoming).is_err());
        assert_eq!(store.load().unwrap(), current);
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
}
#[test]
fn my_finance_restore_stale_confirmation_and_safety_failure_preserve_live_data() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = FinanceStore::open(&dir.path().join("finance.db"), &[42; 32]).unwrap();
    let first = seed(&mut store);
    let next = forward(&first);
    let mut changed = first.clone();
    changed.identity.history[0] = Uuid::new_v4();
    assert!(store.restore(&changed, next.clone()).is_err());
    store.0.execute_batch("CREATE TABLE finance_restore_safety(id TEXT PRIMARY KEY,payload BLOB NOT NULL); CREATE TRIGGER fail_safety BEFORE INSERT ON finance_restore_safety BEGIN SELECT RAISE(ABORT,'synthetic safety failure'); END;").unwrap();
    assert!(store.restore(&first, next).is_err());
    assert_eq!(store.load().unwrap(), first);
}
#[test]
fn my_finance_restore_update_and_commit_failures_roll_back_but_keep_safety() {
    for mode in [0, 1, 2] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("finance.db");
        let mut store = FinanceStore::open(&path, &[42; 32]).unwrap();
        let first = seed(&mut store);
        let next = forward(&first);
        if mode == 0 {
            store.0.execute_batch("CREATE TRIGGER fail_restore BEFORE UPDATE ON finance_snapshot BEGIN SELECT RAISE(ABORT,'synthetic update failure'); END;").unwrap();
        }
        if mode == 2 {
            store.0.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED); CREATE TRIGGER fail_commit AFTER UPDATE ON finance_snapshot BEGIN INSERT INTO child(id) VALUES(999); END;").unwrap();
        }
        let result = store.restore_with_hook(&first, next, || {
            if mode == 1 {
                Err("synthetic interrupted operation")
            } else {
                Ok(())
            }
        });
        assert!(result.is_err());
        assert_eq!(store.load().unwrap(), first);
        assert_eq!(safety(&store), first);
        drop(store);
        assert_eq!(
            FinanceStore::open(&path, &[42; 32])
                .unwrap()
                .load()
                .unwrap(),
            first
        );
    }
}
#[test]
fn my_finance_restore_process_interruption_and_restart() {
    const ROOT: &str = "BOGUNON_SYNTHETIC_RESTORE_ROOT";
    const MODE: &str = "BOGUNON_SYNTHETIC_RESTORE_MODE";
    if let Some(root) = std::env::var_os(ROOT) {
        let root = std::path::PathBuf::from(root);
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("bogunon-synthetic-restore-"));
        let mut store = FinanceStore::open(&root.join("finance.db"), &[42; 32]).unwrap();
        let current = store.load().unwrap();
        if std::env::var(MODE).unwrap() == "interrupt" {
            let next = forward(&current);
            let _ = store.restore_with_hook(&current, next, || std::process::exit(73));
            panic!("synthetic interruption did not run");
        }
        assert_eq!(current.income.len(), 2);
        assert_eq!(current.income[0].notes, "synthetic original must survive");
        assert_eq!(current.income[1].notes, "synthetic restored");
        assert_eq!(current.identity.revision, 3);
        let previous = safety(&store);
        assert_eq!(previous.identity.revision, 2);
        assert_eq!(previous.income.len(), 1);
        assert_eq!(previous.income[0], current.income[0]);
        return;
    }
    let dir = tempfile::Builder::new()
        .prefix("bogunon-synthetic-restore-")
        .tempdir()
        .unwrap();
    let path = dir.path().join("finance.db");
    let first = seed(&mut FinanceStore::open(&path, &[42; 32]).unwrap());
    let full = concat!(
        module_path!(),
        "::my_finance_restore_process_interruption_and_restart"
    );
    let name = full.split_once("::").unwrap().1;
    let child = |mode: &str| {
        std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", name, "--nocapture"])
            .env(ROOT, dir.path())
            .env(MODE, mode)
            .status()
            .unwrap()
    };
    assert_eq!(child("interrupt").code(), Some(73));
    let mut store = FinanceStore::open(&path, &[42; 32]).unwrap();
    assert_eq!(store.load().unwrap(), first);
    assert_eq!(safety(&store), first);
    let next = forward(&first);
    store.restore(&first, next.clone()).unwrap();
    drop(store);
    assert!(child("verify").success());
    assert_eq!(
        FinanceStore::open(&path, &[42; 32])
            .unwrap()
            .load()
            .unwrap(),
        next
    );
}

#[test]
fn my_finance_restore_two_connections_cannot_overwrite_each_other() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let a = FinanceStore::open(&path, &[42; 32]).unwrap();
    let b = FinanceStore::open(&path, &[42; 32]).unwrap();
    let original = a.load().unwrap();
    let one = forward(&original);
    let two = forward(&original);
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
    let handles = [a, b]
        .into_iter()
        .zip([one, two])
        .map(|(mut store, incoming)| {
            let original = original.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                store.restore(&original, incoming)
            })
        })
        .collect::<Vec<_>>();
    let results = handles
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    let winner = results.into_iter().find_map(Result::ok).unwrap();
    assert_eq!(
        FinanceStore::open(&path, &[42; 32])
            .unwrap()
            .load()
            .unwrap(),
        winner
    );
}

#[test]
fn my_finance_restore_rejects_oversized_snapshot_before_safety_write() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[42; 32]).unwrap();
    let current = seed(&mut store);
    let incoming = forward(&current);
    let exact_limit = serde_json::to_vec(&incoming).unwrap().len();

    let restored = store
        .restore_confirmed_with_limit(&current, incoming.clone(), false, exact_limit)
        .unwrap();
    assert_eq!(restored, incoming);
    assert_eq!(safety(&store), current);

    let oversized = forward(&restored);
    let before = store.load().unwrap();
    let before_safety: i64 = store
        .0
        .query_row("SELECT count(*) FROM finance_restore_safety", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(
        store
            .restore_confirmed_with_limit(&before, oversized, false, exact_limit)
            .unwrap_err(),
        SNAPSHOT_TOO_LARGE
    );
    assert_eq!(store.load().unwrap(), before);
    assert_eq!(
        store
            .0
            .query_row("SELECT count(*) FROM finance_restore_safety", [], |row| {
                row.get(0)
            })
            .unwrap(),
        before_safety
    );
}
