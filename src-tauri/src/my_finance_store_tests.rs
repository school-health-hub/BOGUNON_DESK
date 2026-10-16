//! Synthetic-only CRUD, rollback and cross-connection concurrency regression tests.
use super::*;
use crate::my_finance_snapshot::{DeductionKind, IncomeDeduction, IncomeKind, TaxCategory};

fn entry() -> IncomeEntry {
    IncomeEntry {
        id: Uuid::new_v4(),
        source_name: "SYNTHETIC CRUD".into(),
        income_kind: IncomeKind::Lecture,
        contract_label: "synthetic".into(),
        tax_category: TaxCategory::Unverified,
        tax_category_verified: false,
        earned_on: "2024-02-29".into(),
        paid_on: None,
        gross_krw: 100_000,
        deductions: vec![IncomeDeduction {
            kind: DeductionKind::IncomeTax,
            amount_krw: 3_000,
        }],
        net_krw: 97_000,
        notes: String::new(),
    }
}

fn advance(previous: &FinanceSnapshot, next: &FinanceSnapshot) {
    assert_eq!(next.identity.dataset_id, previous.identity.dataset_id);
    assert_eq!(
        next.identity.schema_version,
        previous.identity.schema_version
    );
    assert_eq!(next.identity.revision, previous.identity.revision + 1);
    assert_eq!(
        &next.identity.history[..previous.identity.history.len()],
        &previous.identity.history
    );
    assert_eq!(next.identity.history.len(), next.identity.revision as usize);
    assert!(validate_snapshot(next));
}

#[test]
fn my_finance_crud_persists_each_success_across_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let key = [0x42; 32];
    let mut store = FinanceStore::open(&path, &key).unwrap();
    let first = store.load().unwrap();
    let mut item = entry();
    let created = store
        .apply(&first.identity, IncomeMutation::Create(item.clone()))
        .unwrap();
    advance(&first, &created);
    assert_eq!(created.income, vec![item.clone()]);
    drop(store);
    let mut store = FinanceStore::open(&path, &key).unwrap();
    assert_eq!(store.load().unwrap(), created);
    item.paid_on = Some("2026-10-16".into());
    item.source_name = "SYNTHETIC EDIT".into();
    item.gross_krw = 200_000;
    item.net_krw = 197_000;
    let updated = store
        .apply(&created.identity, IncomeMutation::Update(item.clone()))
        .unwrap();
    advance(&created, &updated);
    assert_eq!(updated.income, vec![item.clone()]);
    drop(store);
    let mut store = FinanceStore::open(&path, &key).unwrap();
    assert_eq!(store.load().unwrap(), updated);
    let deleted = store
        .apply(&updated.identity, IncomeMutation::Delete(item.id))
        .unwrap();
    advance(&updated, &deleted);
    assert!(deleted.income.is_empty());
    drop(store);
    assert_eq!(
        FinanceStore::open(&path, &key).unwrap().load().unwrap(),
        deleted
    );
    let bytes = std::fs::read(&path).unwrap();
    assert!(!bytes.starts_with(b"SQLite format 3"));
    assert!(!bytes.windows(b"SYNTHETIC".len()).any(|w| w == b"SYNTHETIC"));
}

#[test]
fn my_finance_invalid_input_never_changes_payload_or_identity() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[0x42; 32]).unwrap();
    let initial = store.load().unwrap();
    let mut invalid = vec![];
    macro_rules! bad {
        ($field:ident, $value:expr) => {{
            let mut e = entry();
            e.$field = $value;
            invalid.push(e);
        }};
    }
    bad!(id, Uuid::nil());
    bad!(source_name, " ".into());
    bad!(earned_on, "2025-02-29".into());
    bad!(earned_on, "2026-04-31".into());
    bad!(earned_on, "1899-12-31".into());
    bad!(earned_on, "2026-1-01".into());
    bad!(paid_on, Some("2026-02-30".into()));
    bad!(gross_krw, -1);
    bad!(net_krw, 97_001);
    bad!(gross_krw, MAX_SAFE_KRW + 1);
    bad!(contract_label, "x".repeat(201));
    bad!(notes, "x".repeat(5001));
    bad!(
        deductions,
        vec![IncomeDeduction {
            kind: DeductionKind::Other,
            amount_krw: -1
        }]
    );
    bad!(
        deductions,
        vec![IncomeDeduction {
            kind: DeductionKind::Other,
            amount_krw: 100_001
        }]
    );
    bad!(
        deductions,
        vec![
            IncomeDeduction {
                kind: DeductionKind::Other,
                amount_krw: i64::MAX
            };
            2
        ]
    );
    bad!(tax_category_verified, true);
    let mut e = entry();
    e.tax_category = TaxCategory::Unknown;
    e.tax_category_verified = true;
    invalid.push(e);
    let before = std::fs::read(&path).unwrap();
    for e in invalid {
        assert!(store
            .apply(&initial.identity, IncomeMutation::Create(e.clone()))
            .is_err());
        assert!(store
            .apply(&initial.identity, IncomeMutation::Update(e))
            .is_err());
        assert_eq!(store.load().unwrap(), initial);
    }
    assert_eq!(std::fs::read(&path).unwrap(), before);
}

#[test]
fn my_finance_ipc_json_rejects_fractional_money_unknown_classifications_and_fields() {
    for (field, value) in [
        ("grossKrw", serde_json::json!(1.5)),
        ("netKrw", serde_json::json!(1.1)),
        ("grossKrw", serde_json::json!(u64::MAX)),
        ("taxCategory", serde_json::json!("invented")),
        ("incomeKind", serde_json::json!("invented")),
        ("id", serde_json::json!("invalid-uuid")),
        ("extra", serde_json::json!(true)),
    ] {
        let mut json = serde_json::to_value(entry()).unwrap();
        json[field] = value;
        assert!(serde_json::from_value::<IncomeEntry>(json).is_err());
    }
    let mut json = serde_json::to_value(entry()).unwrap();
    json["deductions"][0]["amountKrw"] = serde_json::json!(0.5);
    assert!(serde_json::from_value::<IncomeEntry>(json).is_err());
    let mut json = serde_json::to_value(entry()).unwrap();
    json["deductions"][0]["kind"] = serde_json::json!("invented");
    assert!(serde_json::from_value::<IncomeEntry>(json).is_err());
}

#[test]
fn my_finance_duplicate_missing_and_stale_mutations_do_not_advance_history() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[0x42; 32]).unwrap();
    let initial = store.load().unwrap();
    let item = entry();
    let current = store
        .apply(&initial.identity, IncomeMutation::Create(item.clone()))
        .unwrap();
    let before = std::fs::read(&path).unwrap();
    let mut invalid_update = item.clone();
    invalid_update.net_krw += 1;
    assert!(store
        .apply(&current.identity, IncomeMutation::Update(invalid_update))
        .is_err());
    assert!(store
        .apply(&current.identity, IncomeMutation::Create(item.clone()))
        .is_err());
    assert!(store
        .apply(&current.identity, IncomeMutation::Update(entry()))
        .is_err());
    assert!(store
        .apply(&current.identity, IncomeMutation::Delete(Uuid::new_v4()))
        .is_err());
    assert!(store
        .apply(&current.identity, IncomeMutation::Delete(Uuid::nil()))
        .is_err());
    for change in [
        IncomeMutation::Create(entry()),
        IncomeMutation::Update(item.clone()),
        IncomeMutation::Delete(item.id),
    ] {
        assert_eq!(
            store.apply(&initial.identity, change).unwrap_err(),
            CONFLICT
        );
    }
    let mut other = current.identity.clone();
    other.dataset_id = Uuid::new_v4();
    assert_eq!(
        store
            .apply(&other, IncomeMutation::Delete(item.id))
            .unwrap_err(),
        CONFLICT
    );
    other = current.identity.clone();
    other.history[0] = Uuid::new_v4();
    assert_eq!(
        store
            .apply(&other, IncomeMutation::Delete(item.id))
            .unwrap_err(),
        CONFLICT
    );
    assert_eq!(store.load().unwrap(), current);
    assert_eq!(std::fs::read(&path).unwrap(), before);
}

#[test]
fn my_finance_two_connections_cannot_overwrite_same_revision() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let key = [0x42; 32];
    let initial = FinanceStore::open(&path, &key).unwrap().load().unwrap();
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
    let threads: Vec<_> = (0..2)
        .map(|_| {
            let path = path.clone();
            let barrier = barrier.clone();
            let expected = initial.identity.clone();
            std::thread::spawn(move || {
                let mut store = FinanceStore::open(&path, &key).unwrap();
                barrier.wait();
                store.apply(&expected, IncomeMutation::Create(entry()))
            })
        })
        .collect();
    let results: Vec<_> = threads.into_iter().map(|t| t.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|r| matches!(r, Err(CONFLICT)))
            .count(),
        1
    );
    let loaded = FinanceStore::open(&path, &key).unwrap().load().unwrap();
    advance(&initial, &loaded);
    assert_eq!(loaded.income.len(), 1);
}

#[test]
fn my_finance_sql_failure_rolls_back_payload_revision_and_history() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[0x42; 32]).unwrap();
    let initial = store.load().unwrap();
    store.0.execute_batch("CREATE TRIGGER synthetic_failure AFTER UPDATE ON finance_snapshot BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;").unwrap();
    let before = std::fs::read(&path).unwrap();
    assert!(store
        .apply(&initial.identity, IncomeMutation::Create(entry()))
        .is_err());
    assert_eq!(store.load().unwrap(), initial);
    assert_eq!(std::fs::read(&path).unwrap(), before);
    drop(store);
    assert_eq!(
        FinanceStore::open(&path, &[0x42; 32])
            .unwrap()
            .load()
            .unwrap(),
        initial
    );
}

#[test]
fn my_finance_revision_limit_fails_without_overwriting_existing_records() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[0x42; 32]).unwrap();
    let mut initial = store.load().unwrap();
    initial.identity.revision = 100_000;
    initial.identity.history = (0..100_000).map(|_| Uuid::new_v4()).collect();
    store
        .0
        .execute(
            "UPDATE finance_snapshot SET payload=?1",
            [serde_json::to_vec(&initial).unwrap()],
        )
        .unwrap();
    assert!(store
        .apply(&initial.identity, IncomeMutation::Create(entry()))
        .is_err());
    assert_eq!(store.load().unwrap(), initial);
}

#[test]
fn my_finance_commit_failure_rolls_back_payload_and_deferred_side_effects() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("finance.db");
    let mut store = FinanceStore::open(&path, &[0x42; 32]).unwrap();
    let initial = store.load().unwrap();
    store.0.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE synthetic_parent(id INTEGER PRIMARY KEY); CREATE TABLE synthetic_child(parent_id INTEGER REFERENCES synthetic_parent(id) DEFERRABLE INITIALLY DEFERRED); CREATE TRIGGER synthetic_commit_failure AFTER UPDATE ON finance_snapshot BEGIN INSERT INTO synthetic_child VALUES(123); END;").unwrap();
    let before = std::fs::read(&path).unwrap();
    assert!(store
        .apply(&initial.identity, IncomeMutation::Create(entry()))
        .is_err());
    assert_eq!(store.load().unwrap(), initial);
    assert_eq!(
        store
            .0
            .query_row("SELECT count(*) FROM synthetic_child", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(std::fs::read(&path).unwrap(), before);
}

#[test]
fn my_finance_accepts_exact_safe_integer_boundary_and_verified_known_category() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = FinanceStore::open(&dir.path().join("finance.db"), &[0x42; 32]).unwrap();
    let initial = store.load().unwrap();
    let mut item = entry();
    item.gross_krw = MAX_SAFE_KRW;
    item.net_krw = MAX_SAFE_KRW - 3_000;
    item.tax_category = TaxCategory::Employment;
    item.tax_category_verified = true;
    let saved = store
        .apply(&initial.identity, IncomeMutation::Create(item.clone()))
        .unwrap();
    assert_eq!(saved.income, vec![item]);
    advance(&initial, &saved);
}
