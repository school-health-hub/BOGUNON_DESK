//! Local-only IPC entry point. No finance values enter account settings or events.
use crate::my_finance_snapshot::FinanceSnapshot;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub(crate) struct FinanceState(Arc<Mutex<()>>);

use crate::my_finance_snapshot::{IncomeEntry, SnapshotIdentity};
use crate::my_finance_store::{FinanceStore, IncomeMutation};
use uuid::Uuid;

async fn run(
    app: tauri::AppHandle,
    lock: Arc<Mutex<()>>,
    initialize: bool,
    operation: impl FnOnce(&mut FinanceStore) -> Result<FinanceSnapshot, &'static str> + Send + 'static,
) -> Result<FinanceSnapshot, &'static str> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "금융 저장소가 사용 중입니다.")?;
        with_local_store(&app, initialize, operation)
    })
    .await
    .map_err(|_| "금융 저장소 작업을 완료하지 못했습니다.")?
}

#[tauri::command]
pub(crate) async fn my_finance_load_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<FinanceSnapshot, &'static str> {
    run(app, state.inner().0.clone(), true, |store| store.load()).await
}

#[tauri::command]
pub(crate) async fn my_finance_list_income(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<FinanceSnapshot, &'static str> {
    run(app, state.inner().0.clone(), true, |store| store.load()).await
}

#[tauri::command]
pub(crate) async fn my_finance_create_income(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    entry: IncomeEntry,
) -> Result<FinanceSnapshot, &'static str> {
    run(app, state.inner().0.clone(), false, move |store| {
        store.apply(&expected, IncomeMutation::Create(entry))
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_update_income(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    entry: IncomeEntry,
) -> Result<FinanceSnapshot, &'static str> {
    run(app, state.inner().0.clone(), false, move |store| {
        store.apply(&expected, IncomeMutation::Update(entry))
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_delete_income(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    id: Uuid,
) -> Result<FinanceSnapshot, &'static str> {
    run(app, state.inner().0.clone(), false, move |store| {
        store.apply(&expected, IncomeMutation::Delete(id))
    })
    .await
}

#[cfg(not(windows))]
fn with_local_store(
    _app: &tauri::AppHandle,
    _initialize: bool,
    _operation: impl FnOnce(&mut FinanceStore) -> Result<FinanceSnapshot, &'static str>,
) -> Result<FinanceSnapshot, &'static str> {
    Err("암호화 금융 저장소는 Windows에서만 사용할 수 있습니다.")
}

#[cfg(windows)]
fn with_local_store(
    app: &tauri::AppHandle,
    initialize: bool,
    operation: impl FnOnce(&mut FinanceStore) -> Result<FinanceSnapshot, &'static str>,
) -> Result<FinanceSnapshot, &'static str> {
    use tauri::Manager;
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "금융 저장소 위치를 확인하지 못했습니다.")?
        .join("my-finance");
    if !initialize
        && !root
            .join("finance.db")
            .try_exists()
            .map_err(|_| "금융 저장소를 확인하지 못했습니다.")?
    {
        return Err("금융 저장소가 없습니다. 목록을 다시 불러와 주세요.");
    }
    operation(&mut open_at(&root)?)
}

#[cfg(all(test, windows))]
fn load_at(root: &std::path::Path) -> Result<FinanceSnapshot, &'static str> {
    open_at(root)?.load()
}

#[cfg(windows)]
fn open_at(root: &std::path::Path) -> Result<FinanceStore, &'static str> {
    use std::io::Write;
    use zeroize::Zeroizing;
    const ERROR: &str =
        "금융 저장소 키를 열지 못했습니다. 기존 파일을 보존하고 복구 절차를 확인해 주세요.";
    std::fs::create_dir_all(root).map_err(|_| ERROR)?;
    let db_path = root.join("finance.db");
    let key_path = root.join("key.dpapi");
    let key = if key_path.try_exists().map_err(|_| ERROR)? {
        let encrypted = std::fs::read(&key_path).map_err(|_| ERROR)?;
        let plain = Zeroizing::new(
            windows_dpapi::decrypt_data(&encrypted, windows_dpapi::Scope::User, None)
                .map_err(|_| ERROR)?,
        );
        if plain.len() != 32 {
            return Err(ERROR);
        }
        let mut key = Zeroizing::new([0_u8; 32]);
        key.copy_from_slice(&plain);
        key
    } else {
        // A missing/unreadable key must never silently replace an existing DB.
        if db_path.try_exists().map_err(|_| ERROR)? {
            return Err(ERROR);
        }
        let key = Zeroizing::new(rand::random::<[u8; 32]>());
        let encrypted = windows_dpapi::encrypt_data(key.as_ref(), windows_dpapi::Scope::User, None)
            .map_err(|_| ERROR)?;
        // Atomic visibility: interruption cannot leave a partially written key.
        // Persist without clobbering any key created by another process.
        let mut file = tempfile::NamedTempFile::new_in(root).map_err(|_| ERROR)?;
        file.write_all(&encrypted).map_err(|_| ERROR)?;
        file.as_file().sync_all().map_err(|_| ERROR)?;
        file.persist_noclobber(&key_path).map_err(|_| ERROR)?;
        key
    };
    FinanceStore::open(&db_path, &key)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn my_finance_dpapi_restart_and_missing_key_fail_closed() {
        let dir = tempfile::tempdir().unwrap();
        let first = load_at(dir.path()).unwrap();
        assert_eq!(first, load_at(dir.path()).unwrap());
        let before = std::fs::read(dir.path().join("finance.db")).unwrap();
        std::fs::remove_file(dir.path().join("key.dpapi")).unwrap();
        assert!(load_at(dir.path()).is_err());
        assert_eq!(
            std::fs::read(dir.path().join("finance.db")).unwrap(),
            before
        );
        assert!(!dir.path().join("key.dpapi").exists());
    }
    #[test]
    fn my_finance_dpapi_crud_restart_preserves_key_and_rejects_stale_request() {
        use crate::my_finance_snapshot::{IncomeKind, TaxCategory};
        let dir = tempfile::tempdir().unwrap();
        let first = load_at(dir.path()).unwrap();
        let protected_key = std::fs::read(dir.path().join("key.dpapi")).unwrap();
        let mut entry = IncomeEntry {
            id: Uuid::new_v4(),
            source_name: "SYNTHETIC WINDOWS CRUD".into(),
            income_kind: IncomeKind::Lecture,
            contract_label: String::new(),
            tax_category: TaxCategory::Unverified,
            tax_category_verified: false,
            earned_on: "2026-10-16".into(),
            paid_on: None,
            gross_krw: 100_000,
            deductions: vec![],
            net_krw: 100_000,
            notes: String::new(),
        };
        let created = open_at(dir.path())
            .unwrap()
            .apply(&first.identity, IncomeMutation::Create(entry.clone()))
            .unwrap();
        assert_eq!(load_at(dir.path()).unwrap(), created);
        entry.paid_on = Some("2026-10-17".into());
        let updated = open_at(dir.path())
            .unwrap()
            .apply(&created.identity, IncomeMutation::Update(entry.clone()))
            .unwrap();
        assert_eq!(load_at(dir.path()).unwrap(), updated);
        assert!(open_at(dir.path())
            .unwrap()
            .apply(&created.identity, IncomeMutation::Delete(entry.id))
            .is_err());
        assert_eq!(load_at(dir.path()).unwrap(), updated);
        let deleted = open_at(dir.path())
            .unwrap()
            .apply(&updated.identity, IncomeMutation::Delete(entry.id))
            .unwrap();
        assert_eq!(load_at(dir.path()).unwrap(), deleted);
        assert_eq!(deleted.identity.revision, first.identity.revision + 3);
        assert_eq!(
            std::fs::read(dir.path().join("key.dpapi")).unwrap(),
            protected_key
        );
    }

    #[test]
    fn my_finance_dpapi_process_restart() {
        const CHILD_ROOT: &str = "BOGUNON_SYNTHETIC_FINANCE_CHILD_ROOT";
        if let Some(root) = std::env::var_os(CHILD_ROOT) {
            let root = std::path::PathBuf::from(root);
            assert!(root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("bogunon-synthetic-crud-"));
            let mut store = open_at(&root).unwrap();
            let current = store.load().unwrap();
            assert_eq!(current.income.len(), 1);
            let mut entry = current.income[0].clone();
            assert_eq!(entry.source_name, "SYNTHETIC PROCESS RESTART");
            entry.notes = "synthetic child update".into();
            store
                .apply(&current.identity, IncomeMutation::Update(entry))
                .unwrap();
            return;
        }
        use crate::my_finance_snapshot::{IncomeKind, TaxCategory};
        let dir = tempfile::Builder::new()
            .prefix("bogunon-synthetic-crud-")
            .tempdir()
            .unwrap();
        let first = load_at(dir.path()).unwrap();
        let entry = IncomeEntry {
            id: Uuid::new_v4(),
            source_name: "SYNTHETIC PROCESS RESTART".into(),
            income_kind: IncomeKind::Lecture,
            contract_label: String::new(),
            tax_category: TaxCategory::Unverified,
            tax_category_verified: false,
            earned_on: "2026-10-16".into(),
            paid_on: None,
            gross_krw: 100_000,
            deductions: vec![],
            net_krw: 100_000,
            notes: String::new(),
        };
        let created = open_at(dir.path())
            .unwrap()
            .apply(&first.identity, IncomeMutation::Create(entry))
            .unwrap();
        let full_name = concat!(module_path!(), "::my_finance_dpapi_process_restart");
        let test_name = full_name.split_once("::").unwrap().1;
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", test_name, "--nocapture"])
            .env(CHILD_ROOT, dir.path())
            .status()
            .unwrap();
        assert!(status.success());
        let reopened = load_at(dir.path()).unwrap();
        assert_eq!(reopened.identity.revision, created.identity.revision + 1);
        assert_eq!(
            &reopened.identity.history[..created.identity.history.len()],
            &created.identity.history
        );
        assert_eq!(reopened.income[0].notes, "synthetic child update");
    }

    #[test]
    fn my_finance_corrupt_dpapi_key_is_not_replaced() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("key.dpapi"), b"synthetic-corrupt-key").unwrap();
        assert!(load_at(dir.path()).is_err());
        assert!(!dir.path().join("finance.db").exists());
        assert_eq!(
            std::fs::read(dir.path().join("key.dpapi")).unwrap(),
            b"synthetic-corrupt-key"
        );
    }
}
