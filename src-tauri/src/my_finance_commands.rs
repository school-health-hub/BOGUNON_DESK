//! Local-only IPC entry point. No finance values enter account settings or events.
use crate::my_finance_snapshot::FinanceSnapshot;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub(crate) struct FinanceState(Arc<Mutex<()>>);

#[tauri::command]
pub(crate) async fn my_finance_load_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<FinanceSnapshot, &'static str> {
    let lock = state.inner().0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "금융 저장소가 사용 중입니다.")?;
        load_local(&app)
    })
    .await
    .map_err(|_| "금융 저장소 작업을 완료하지 못했습니다.")?
}

#[cfg(not(windows))]
fn load_local(_app: &tauri::AppHandle) -> Result<FinanceSnapshot, &'static str> {
    Err("암호화 금융 저장소는 Windows에서만 사용할 수 있습니다.")
}

#[cfg(windows)]
fn load_local(app: &tauri::AppHandle) -> Result<FinanceSnapshot, &'static str> {
    use tauri::Manager;
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "금융 저장소 위치를 확인하지 못했습니다.")?
        .join("my-finance");
    load_at(&root)
}

#[cfg(windows)]
fn load_at(root: &std::path::Path) -> Result<FinanceSnapshot, &'static str> {
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
    crate::my_finance_store::FinanceStore::open(&db_path, &key)?.load()
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
