//! SQLCipher-only persistence. No network, plaintext export, or automatic restore.
//! Snapshot/portable backup schema stays independent from the database schema.
use crate::my_finance_snapshot::{
    validate_snapshot, FinanceSnapshot, SnapshotIdentity, SNAPSHOT_SCHEMA_VERSION,
};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use std::path::Path;
use uuid::Uuid;
use zeroize::Zeroizing;

const STORAGE_ERROR: &str =
    "암호화 금융 저장소를 열지 못했습니다. 기존 파일을 보존하고 복구 절차를 확인해 주세요.";
const DB_VERSION: i64 = 1;

pub(crate) struct FinanceStore(Connection);

impl FinanceStore {
    pub(crate) fn open(path: &Path, key: &[u8; 32]) -> Result<Self, &'static str> {
        let db = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
        )
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
        let payload: Option<Vec<u8>> = self
            .0
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
