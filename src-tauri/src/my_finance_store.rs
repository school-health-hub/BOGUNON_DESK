//! SQLCipher-only persistence. No network, plaintext export, or automatic restore.
//! Snapshot/portable backup schema stays independent from the database schema.
use crate::my_finance_snapshot::{validate_income_entry, IncomeEntry};
use crate::my_finance_snapshot::{
    validate_snapshot, FinanceSnapshot, SnapshotIdentity, SNAPSHOT_SCHEMA_VERSION,
};
use rusqlite::{Connection, OpenFlags, OptionalExtension, TransactionBehavior};
use std::path::Path;
use uuid::Uuid;
use zeroize::Zeroizing;

const STORAGE_ERROR: &str =
    "암호화 금융 저장소를 열지 못했습니다. 기존 파일을 보존하고 복구 절차를 확인해 주세요.";
const DB_VERSION: i64 = 1;

pub(crate) struct FinanceStore(Connection);

pub(crate) enum IncomeMutation {
    Create(IncomeEntry),
    Update(IncomeEntry),
    Delete(Uuid),
}

const CONFLICT: &str = "금융 데이터가 변경되었습니다. 최신 목록을 다시 불러와 주세요.";
const INVALID: &str = "수입 데이터가 올바르지 않습니다.";
const SNAPSHOT_TOO_LARGE: &str =
    "금융 데이터가 백업 가능한 최대 크기를 초과했습니다. 기존 데이터를 줄인 뒤 다시 시도해 주세요.";
const MAX_SAFE_KRW: i64 = 9_007_199_254_740_991;

impl FinanceStore {
    pub(crate) fn open(path: &Path, key: &[u8; 32]) -> Result<Self, &'static str> {
        let db = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
        )
        .map_err(|_| STORAGE_ERROR)?;
        db.busy_timeout(std::time::Duration::from_secs(2))
            .map_err(|_| STORAGE_ERROR)?;
        // Key before any schema access. Never include it in diagnostics.
        let mut hex = Zeroizing::new(String::with_capacity(67));
        hex.push_str("x'");
        for byte in key {
            use std::fmt::Write;
            write!(&mut *hex, "{byte:02x}").map_err(|_| STORAGE_ERROR)?;
        }
        hex.push('\'');
        db.pragma_update(None, "key", hex.as_str())
            .map_err(|_| STORAGE_ERROR)?;
        let cipher: String = db
            .query_row("PRAGMA cipher_version", [], |r| r.get(0))
            .map_err(|_| STORAGE_ERROR)?;
        if cipher.is_empty() {
            return Err(STORAGE_ERROR);
        }
        // Force key verification before any persistent change; never accept plain SQLite.
        db.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
            r.get::<_, i64>(0)
        })
        .map_err(|_| STORAGE_ERROR)?;
        let version: i64 = db
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(|_| STORAGE_ERROR)?;
        if version != 0 && version != DB_VERSION {
            return Err(STORAGE_ERROR);
        }
        // Reject unsupported databases before changing journal settings.
        db.execute_batch("PRAGMA temp_store=MEMORY; PRAGMA mmap_size=0; PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE;")
            .map_err(|_| STORAGE_ERROR)?;
        let mut store = Self(db);
        if version == 0 {
            let count: i64 = store
                .0
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
                    [],
                    |r| r.get(0),
                )
                .map_err(|_| STORAGE_ERROR)?;
            if count != 0 {
                return Err(STORAGE_ERROR);
            }
            let initial = FinanceSnapshot {
                identity: SnapshotIdentity {
                    schema_version: SNAPSHOT_SCHEMA_VERSION,
                    dataset_id: Uuid::new_v4(),
                    revision: 1,
                    history: vec![Uuid::new_v4()],
                },
                income: vec![],
            };
            let payload = Zeroizing::new(serde_json::to_vec(&initial).map_err(|_| STORAGE_ERROR)?);
            let tx = store.0.transaction().map_err(|_| STORAGE_ERROR)?;
            tx.execute_batch("CREATE TABLE finance_snapshot (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload BLOB NOT NULL); PRAGMA user_version=1;").map_err(|_| STORAGE_ERROR)?;
            tx.execute(
                "INSERT INTO finance_snapshot(singleton,payload) VALUES(1,?1)",
                [payload.as_slice()],
            )
            .map_err(|_| STORAGE_ERROR)?;
            tx.commit().map_err(|_| STORAGE_ERROR)?;
        }
        store.load()?;
        Ok(store)
    }

    pub(crate) fn load(&self) -> Result<FinanceSnapshot, &'static str> {
        Self::read_snapshot(&self.0)
    }

    /// Lock before reading: revision comparison and payload/history update are
    /// one transaction, including across separate connections/processes.
    pub(crate) fn apply(
        &mut self,
        expected: &SnapshotIdentity,
        change: IncomeMutation,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.apply_with_limit(expected, change, crate::my_finance_backup::MAX_PLAINTEXT)
    }

    fn apply_with_limit(
        &mut self,
        expected: &SnapshotIdentity,
        change: IncomeMutation,
        max_serialized_bytes: usize,
    ) -> Result<FinanceSnapshot, &'static str> {
        let tx = self
            .0
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| CONFLICT)?;
        let mut snapshot = Self::read_snapshot(&tx)?;
        if &snapshot.identity != expected {
            return Err(CONFLICT);
        }
        let current_size = serde_json::to_vec(&snapshot)
            .map_err(|_| STORAGE_ERROR)?
            .len();
        match change {
            IncomeMutation::Create(entry) => {
                Self::validate_input(&entry)?;
                if snapshot.income.iter().any(|item| item.id == entry.id) {
                    return Err("이미 등록된 수입 ID입니다.");
                }
                snapshot.income.push(entry);
            }
            IncomeMutation::Update(entry) => {
                Self::validate_input(&entry)?;
                let item = snapshot
                    .income
                    .iter_mut()
                    .find(|item| item.id == entry.id)
                    .ok_or("수정할 수입을 찾지 못했습니다.")?;
                *item = entry;
            }
            IncomeMutation::Delete(id) => {
                let position = snapshot
                    .income
                    .iter()
                    .position(|item| item.id == id)
                    .ok_or("삭제할 수입을 찾지 못했습니다.")?;
                snapshot.income.remove(position);
            }
        }
        snapshot.identity.revision = snapshot.identity.revision.checked_add(1).ok_or(INVALID)?;
        snapshot.identity.history.push(Uuid::new_v4());
        if !validate_snapshot(&snapshot) {
            return Err(INVALID);
        }
        let payload = Zeroizing::new(serde_json::to_vec(&snapshot).map_err(|_| STORAGE_ERROR)?);
        if !mutation_size_allowed(current_size, payload.len(), max_serialized_bytes) {
            return Err(SNAPSHOT_TOO_LARGE);
        }
        if tx
            .execute(
                "UPDATE finance_snapshot SET payload=?1 WHERE singleton=1",
                [payload.as_slice()],
            )
            .map_err(|_| STORAGE_ERROR)?
            != 1
        {
            return Err(STORAGE_ERROR);
        }
        tx.commit().map_err(|_| STORAGE_ERROR)?;
        Ok(snapshot)
    }

    /// A durable, encrypted pre-image is committed BEFORE replacing the live
    /// snapshot. A second BEGIN IMMEDIATE/CAS prevents a race between commits.
    /// Safety images remain local to this SQLCipher DB and are never exported.
    pub(crate) fn restore(
        &mut self,
        expected: &FinanceSnapshot,
        incoming: FinanceSnapshot,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.restore_confirmed(expected, incoming, false)
    }

    pub(crate) fn restore_confirmed(
        &mut self,
        expected: &FinanceSnapshot,
        incoming: FinanceSnapshot,
        confirm_dataset_change: bool,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.restore_confirmed_with_limit(
            expected,
            incoming,
            confirm_dataset_change,
            crate::my_finance_backup::MAX_PLAINTEXT,
        )
    }

    fn restore_confirmed_with_limit(
        &mut self,
        expected: &FinanceSnapshot,
        incoming: FinanceSnapshot,
        confirm_dataset_change: bool,
        max_serialized_bytes: usize,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.restore_confirmed_with_hook_and_limit(
            expected,
            incoming,
            confirm_dataset_change,
            max_serialized_bytes,
            || Ok(()),
        )
    }

    #[cfg(test)]
    fn restore_with_hook(
        &mut self,
        expected: &FinanceSnapshot,
        incoming: FinanceSnapshot,
        after_update: impl FnOnce() -> Result<(), &'static str>,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.restore_confirmed_with_hook_and_limit(
            expected,
            incoming,
            false,
            crate::my_finance_backup::MAX_PLAINTEXT,
            after_update,
        )
    }

    #[cfg(test)]
    fn restore_confirmed_with_hook(
        &mut self,
        expected: &FinanceSnapshot,
        incoming: FinanceSnapshot,
        confirm_dataset_change: bool,
        after_update: impl FnOnce() -> Result<(), &'static str>,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.restore_confirmed_with_hook_and_limit(
            expected,
            incoming,
            confirm_dataset_change,
            crate::my_finance_backup::MAX_PLAINTEXT,
            after_update,
        )
    }

    fn restore_confirmed_with_hook_and_limit(
        &mut self,
        expected: &FinanceSnapshot,
        incoming: FinanceSnapshot,
        confirm_dataset_change: bool,
        max_serialized_bytes: usize,
        after_update: impl FnOnce() -> Result<(), &'static str>,
    ) -> Result<FinanceSnapshot, &'static str> {
        let payload = Zeroizing::new(serde_json::to_vec(&incoming).map_err(|_| STORAGE_ERROR)?);
        if !crate::my_finance_backup::plaintext_size_allowed(payload.len(), max_serialized_bytes) {
            return Err(SNAPSHOT_TOO_LARGE);
        }
        let tx = self
            .0
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| CONFLICT)?;
        let current = Self::read_snapshot(&tx)?;
        if &current != expected {
            return Err(CONFLICT);
        }
        use crate::my_finance_snapshot::RestoreDecision;
        match restore_decision(&current, &incoming) {
            RestoreDecision::AllowForward => {}
            RestoreDecision::AllowNewDataset if confirm_dataset_change => {}
            RestoreDecision::AllowNewDataset => {
                return Err("최초 이식에는 데이터셋 변경에 대한 별도 확인이 필요합니다.")
            }
            _ => return Err("이 백업은 현재 데이터에 복원할 수 없습니다."),
        }
        let safety = Zeroizing::new(serde_json::to_vec(&current).map_err(|_| STORAGE_ERROR)?);
        tx.execute_batch("CREATE TABLE IF NOT EXISTS finance_restore_safety (id TEXT PRIMARY KEY, payload BLOB NOT NULL);").map_err(|_| STORAGE_ERROR)?;
        tx.execute(
            "INSERT INTO finance_restore_safety(id,payload) VALUES(?1,?2)",
            rusqlite::params![Uuid::new_v4().to_string(), safety.as_slice()],
        )
        .map_err(|_| STORAGE_ERROR)?;
        tx.commit().map_err(|_| STORAGE_ERROR)?;

        let tx = self
            .0
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| CONFLICT)?;
        // Compare the full pre-image too: an identity alone must not authorize
        // replacing a payload changed out of band under the same identity.
        if Self::read_snapshot(&tx)? != current {
            return Err(CONFLICT);
        }
        if tx
            .execute(
                "UPDATE finance_snapshot SET payload=?1 WHERE singleton=1",
                [payload.as_slice()],
            )
            .map_err(|_| STORAGE_ERROR)?
            != 1
        {
            return Err(STORAGE_ERROR);
        }
        after_update()?;
        tx.commit().map_err(|_| STORAGE_ERROR)?;
        // Adopt the exact incoming lineage; creating a new local revision here
        // would fork the portable dataset on every transfer.
        Ok(incoming)
    }

    fn validate_input(entry: &IncomeEntry) -> Result<(), &'static str> {
        // JSON/JavaScript must represent every KRW amount exactly. Serde i64
        // rejects fractional/out-of-range numbers before they reach this layer.
        if !validate_income_entry(entry)
            || entry.gross_krw > MAX_SAFE_KRW
            || entry.deductions.iter().any(|d| d.amount_krw > MAX_SAFE_KRW)
        {
            return Err(INVALID);
        }
        Ok(())
    }

    fn read_snapshot(db: &Connection) -> Result<FinanceSnapshot, &'static str> {
        let payload: Option<Vec<u8>> = db
            .query_row(
                "SELECT payload FROM finance_snapshot WHERE singleton=1",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(|_| STORAGE_ERROR)?;
        let payload = Zeroizing::new(payload.ok_or(STORAGE_ERROR)?);
        let snapshot =
            serde_json::from_slice::<FinanceSnapshot>(&payload).map_err(|_| STORAGE_ERROR)?;
        if !validate_snapshot(&snapshot) {
            return Err(STORAGE_ERROR);
        }
        Ok(snapshot)
    }
}

const fn mutation_size_allowed(current: usize, next: usize, limit: usize) -> bool {
    next > 0 && (next <= limit || (current > limit && next < current))
}

#[cfg(test)]
mod tests {
    use super::*;
    struct File(std::path::PathBuf);
    impl File {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("my-finance-synthetic-{}.db", Uuid::new_v4())))
        }
    }
    impl Drop for File {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    #[test]
    fn my_finance_sqlcipher_restart_and_wrong_key() {
        let file = File::new();
        let key = [0x24; 32]; // Synthetic keys only.
        let snapshot = FinanceStore::open(&file.0, &key).unwrap().load().unwrap();
        assert!(validate_snapshot(&snapshot));
        assert_eq!(
            FinanceStore::open(&file.0, &key).unwrap().load().unwrap(),
            snapshot
        );
        let before = std::fs::read(&file.0).unwrap();
        assert!(!before.starts_with(b"SQLite format 3"));
        assert!(!before
            .windows(b"datasetId".len())
            .any(|w| w == b"datasetId"));
        assert!(FinanceStore::open(&file.0, &[0x25; 32]).is_err());
        assert_eq!(std::fs::read(&file.0).unwrap(), before);
        let plain = Connection::open(&file.0).unwrap();
        assert!(plain
            .query_row("SELECT payload FROM finance_snapshot", [], |r| r
                .get::<_, Vec<u8>>(0))
            .is_err());
    }

    #[test]
    fn my_finance_synthetic_income_persists_and_keeps_portable_backup_contract() {
        use crate::my_finance_snapshot::{IncomeEntry, IncomeKind, TaxCategory};
        let file = File::new();
        let key = [0x24; 32];
        let store = FinanceStore::open(&file.0, &key).unwrap();
        let mut snapshot = store.load().unwrap();
        snapshot.income.push(IncomeEntry {
            id: Uuid::new_v4(),
            source_name: "SYNTHETIC FINANCE FIXTURE".into(),
            income_kind: IncomeKind::Lecture,
            contract_label: "synthetic".into(),
            tax_category: TaxCategory::Unverified,
            tax_category_verified: false,
            earned_on: "2026-10-15".into(),
            paid_on: None,
            gross_krw: 100_000,
            deductions: vec![],
            net_krw: 100_000,
            notes: "synthetic only".into(),
        });
        assert!(validate_snapshot(&snapshot));
        // Test-only fixture insertion; CRUD and restore commands are separate gates.
        let payload = Zeroizing::new(serde_json::to_vec(&snapshot).unwrap());
        store
            .0
            .execute(
                "UPDATE finance_snapshot SET payload=?1 WHERE singleton=1",
                [payload.as_slice()],
            )
            .unwrap();
        drop(store);
        let loaded = FinanceStore::open(&file.0, &key).unwrap().load().unwrap();
        assert_eq!(loaded, snapshot);
        let backup =
            crate::my_finance_codec::export_snapshot(&loaded, "synthetic-password-123").unwrap();
        let (decoded, decision) =
            crate::my_finance_codec::inspect_restore(&backup, "synthetic-password-123", None)
                .unwrap();
        assert_eq!(decoded, loaded);
        assert_eq!(
            decision,
            crate::my_finance_snapshot::RestoreDecision::AllowNewDataset
        );
        let bytes = std::fs::read(&file.0).unwrap();
        assert!(!bytes
            .windows(b"SYNTHETIC FINANCE FIXTURE".len())
            .any(|w| w == b"SYNTHETIC FINANCE FIXTURE"));
    }

    #[test]
    fn my_finance_refuses_plain_database_without_modifying_it() {
        let file = File::new();
        Connection::open(&file.0)
            .unwrap()
            .execute_batch("CREATE TABLE synthetic(value TEXT);")
            .unwrap();
        let before = std::fs::read(&file.0).unwrap();
        assert!(FinanceStore::open(&file.0, &[0x24; 32]).is_err());
        assert_eq!(std::fs::read(&file.0).unwrap(), before);
    }

    #[test]
    fn my_finance_rejects_invalid_stored_snapshot_and_future_database_version() {
        let file = File::new();
        let store = FinanceStore::open(&file.0, &[0x24; 32]).unwrap();
        store
            .0
            .execute("UPDATE finance_snapshot SET payload=?1", [b"{}".as_slice()])
            .unwrap();
        assert!(store.load().is_err());
        store.0.pragma_update(None, "user_version", 99).unwrap();
        drop(store);
        let before = std::fs::read(&file.0).unwrap();
        assert!(FinanceStore::open(&file.0, &[0x24; 32]).is_err());
        assert_eq!(std::fs::read(&file.0).unwrap(), before);
    }
}

#[cfg(test)]
#[path = "my_finance_store_tests.rs"]
mod crud_tests;

/// Validate both content and lineage; never infer eligibility from UI metadata.
pub(crate) fn restore_decision(
    current: &FinanceSnapshot,
    incoming: &FinanceSnapshot,
) -> crate::my_finance_snapshot::RestoreDecision {
    use crate::my_finance_snapshot::{decide_restore, RestoreDecision};
    if !validate_snapshot(current)
        || !validate_snapshot(incoming)
        || incoming
            .income
            .iter()
            .any(|entry| FinanceStore::validate_input(entry).is_err())
    {
        return RestoreDecision::RejectInvalid;
    }
    // Every user CRUD mutation advances revision/history, even deletion of the
    // final record. Empty-but-used stores must never regain adoption eligibility.
    if current.identity.dataset_id != incoming.identity.dataset_id
        && current.income.is_empty()
        && current.identity.revision == 1
        && current.identity.history.len() == 1
    {
        return RestoreDecision::AllowNewDataset;
    }
    let decision = decide_restore(Some(&current.identity), incoming);
    if decision == RestoreDecision::AlreadyCurrent && incoming != current {
        RestoreDecision::RejectDiverged
    } else {
        decision
    }
}

#[cfg(test)]
#[path = "my_finance_restore_tests.rs"]
mod restore_tests;

#[cfg(test)]
#[path = "my_finance_cross_pc_tests.rs"]
pub(crate) mod cross_pc_tests;
