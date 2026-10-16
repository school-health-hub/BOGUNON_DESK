//! Local-only IPC entry point. No finance values enter account settings or events.
use crate::my_finance_snapshot::FinanceSnapshot;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub(crate) struct FinanceState(
    Arc<Mutex<()>>,
    Arc<Mutex<crate::my_finance_transfer::TransferSession>>,
);

use crate::my_finance_snapshot::{IncomeEntry, SnapshotIdentity};
use crate::my_finance_store::{FinanceStore, IncomeMutation};
use uuid::Uuid;

async fn run<T: Send + 'static>(
    app: tauri::AppHandle,
    lock: Arc<Mutex<()>>,
    initialize: bool,
    operation: impl FnOnce(&mut FinanceStore) -> Result<T, &'static str> + Send + 'static,
) -> Result<T, &'static str> {
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

/// The dialog supplies the only filesystem path; renderer never provides one.
#[tauri::command]
pub(crate) async fn my_finance_export_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    password: String,
) -> Result<bool, &'static str> {
    use tauri_plugin_dialog::DialogExt;
    let password = zeroize::Zeroizing::new(password);
    let dialog_app = app.clone();
    run(app, state.inner().0.clone(), false, move |store| {
        let current = store.load()?;
        if current.identity != expected {
            return Err("금융 데이터가 변경되었습니다. 최신 목록을 다시 불러와 주세요.");
        }
        let encrypted = crate::my_finance_codec::export_snapshot(&current, &password)?;
        drop(password);
        let Some(file) = dialog_app
            .dialog()
            .file()
            .set_file_name("my-finance.bgfnbk")
            .add_filter("MY FINANCE 암호화 백업", &["bgfnbk"])
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = file
            .into_path()
            .map_err(|_| "백업 저장 위치를 확인하지 못했습니다.")?;
        crate::my_finance_transfer::write_backup(&path, &encrypted)?;
        Ok(true)
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_select_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<Option<Uuid>, &'static str> {
    use tauri_plugin_dialog::DialogExt;
    let session = state.inner().1.clone();
    let dialog_app = app.clone();
    run(app, state.inner().0.clone(), false, move |_store| {
        let mut session = session.lock().map_err(|_| "백업 세션을 열지 못했습니다.")?;
        session.cancel();
        let Some(file) = dialog_app
            .dialog()
            .file()
            .add_filter("MY FINANCE 암호화 백업", &["bgfnbk"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "백업 파일을 확인하지 못했습니다.")?;
        session
            .select(crate::my_finance_transfer::read_backup(&path)?)
            .map(Some)
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_inspect_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    token: Uuid,
    password: String,
) -> Result<crate::my_finance_transfer::RestorePreview, &'static str> {
    let password = zeroize::Zeroizing::new(password);
    let session = state.inner().1.clone();
    run(app, state.inner().0.clone(), false, move |store| {
        session
            .lock()
            .map_err(|_| "백업 세션을 열지 못했습니다.")?
            .inspect(token, &password, &store.load()?)
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_restore_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    token: Uuid,
    confirm_dataset_change: Option<bool>,
) -> Result<FinanceSnapshot, &'static str> {
    let session = state.inner().1.clone();
    run(app, state.inner().0.clone(), false, move |store| {
        session
            .lock()
            .map_err(|_| "백업 세션을 열지 못했습니다.")?
            .commit_confirmed(token, store, confirm_dataset_change.unwrap_or(false))
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_cancel_backup(
    state: tauri::State<'_, FinanceState>,
    token: Uuid,
) -> Result<(), &'static str> {
    let session = state.inner().1.clone();
    tauri::async_runtime::spawn_blocking(move || {
        session
            .lock()
            .map_err(|_| "백업 세션을 닫지 못했습니다.")?
            .cancel_ticket(token);
        Ok(())
    })
    .await
    .map_err(|_| "백업 세션을 닫지 못했습니다.")?
}

#[cfg(not(windows))]
fn with_local_store<T>(
    _app: &tauri::AppHandle,
    _initialize: bool,
    _operation: impl FnOnce(&mut FinanceStore) -> Result<T, &'static str>,
) -> Result<T, &'static str> {
    Err("암호화 금융 저장소는 Windows에서만 사용할 수 있습니다.")
}

#[cfg(windows)]
fn with_local_store<T>(
    app: &tauri::AppHandle,
    initialize: bool,
    operation: impl FnOnce(&mut FinanceStore) -> Result<T, &'static str>,
) -> Result<T, &'static str> {
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
        // Exercise the real DPAPI-owned store through the portable envelope,
        // staged inspection and atomic restore before launching another process.
        let mut incoming = created.clone();
        incoming.identity.revision += 1;
        incoming.identity.history.push(Uuid::new_v4());
        incoming.income[0].notes = "synthetic portable restore".into();
        let encrypted =
            crate::my_finance_codec::export_snapshot(&incoming, "synthetic-password-123").unwrap();
        let mut session = crate::my_finance_transfer::TransferSession::default();
        let token = session.select(encrypted).unwrap();
        assert!(
            session
                .inspect(token, "synthetic-password-123", &created)
                .unwrap()
                .eligible
        );
        let protected_key = std::fs::read(dir.path().join("key.dpapi")).unwrap();
        let created = session
            .commit(token, &mut open_at(dir.path()).unwrap())
            .unwrap();
        assert_eq!(created, incoming);
        assert_eq!(load_at(dir.path()).unwrap(), incoming);
        assert_eq!(
            std::fs::read(dir.path().join("key.dpapi")).unwrap(),
            protected_key
        );
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
    #[test]
    fn my_finance_dpapi_cross_pc_round_trip_and_process_restart() {
        const ROOT: &str = "BOGUNON_SYNTHETIC_DPAPI_CROSS_PC_ROOT";
        if let Some(root) = std::env::var_os(ROOT) {
            let root = std::path::PathBuf::from(root);
            assert!(root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("bogunon-synthetic-dpapi-transfer-"));
            let school = load_at(&root.join("school")).unwrap();
            let home = load_at(&root.join("home")).unwrap();
            assert_eq!(school, home);
            assert_eq!(
                home.income,
                crate::my_finance_store::cross_pc_tests::expected_income()
            );
            assert_eq!(home.identity.revision, 6);
            return;
        }
        let dir = tempfile::Builder::new()
            .prefix("bogunon-synthetic-dpapi-transfer-")
            .tempdir()
            .unwrap();
        let school_root = dir.path().join("school");
        let home_root = dir.path().join("home");
        load_at(&school_root).unwrap();
        load_at(&home_root).unwrap();
        let school_key = std::fs::read(school_root.join("key.dpapi")).unwrap();
        let home_key = std::fs::read(home_root.join("key.dpapi")).unwrap();
        let final_snapshot = crate::my_finance_store::cross_pc_tests::round_trip_with(|name| {
            open_at(&dir.path().join(name)).unwrap()
        });
        assert_eq!(load_at(&school_root).unwrap(), final_snapshot);
        assert_eq!(load_at(&home_root).unwrap(), final_snapshot);
        assert_eq!(
            std::fs::read(school_root.join("key.dpapi")).unwrap(),
            school_key
        );
        assert_eq!(
            std::fs::read(home_root.join("key.dpapi")).unwrap(),
            home_key
        );
        let home_plain = zeroize::Zeroizing::new(
            windows_dpapi::decrypt_data(&home_key, windows_dpapi::Scope::User, None).unwrap(),
        );
        let school_plain = zeroize::Zeroizing::new(
            windows_dpapi::decrypt_data(&school_key, windows_dpapi::Scope::User, None).unwrap(),
        );
        assert!(home_plain.as_slice() != school_plain.as_slice());
        let mut foreign_key = zeroize::Zeroizing::new([0_u8; 32]);
        foreign_key.copy_from_slice(&home_plain);
        let before = std::fs::read(school_root.join("finance.db")).unwrap();
        assert!(FinanceStore::open(&school_root.join("finance.db"), &foreign_key).is_err());
        assert_eq!(
            std::fs::read(school_root.join("finance.db")).unwrap(),
            before
        );
        let full = concat!(
            module_path!(),
            "::my_finance_dpapi_cross_pc_round_trip_and_process_restart"
        );
        let name = full.split_once("::").unwrap().1;
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", name, "--nocapture"])
            .env(ROOT, dir.path())
            .status()
            .unwrap();
        assert!(status.success());
    }
}
