use crate::my_finance_store::FinanceStore;
#[cfg(windows)]
pub(crate) fn open_at(root: &std::path::Path) -> Result<FinanceStore, &'static str> {
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


#[cfg(not(windows))]
pub(crate) fn open_at(_root:&std::path::Path)->Result<FinanceStore,&'static str>{Err("암호화 금융 저장소는 Windows에서만 사용할 수 있습니다.")}
#[cfg(all(test,windows))]
mod tests{
 use super::*;
 #[test]fn electron_dpapi_restart_and_missing_key_preserve_original(){
  let root=tempfile::tempdir().unwrap();let first=open_at(root.path()).unwrap().load().unwrap();let encrypted=std::fs::read(root.path().join("key.dpapi")).unwrap();
  assert_eq!(open_at(root.path()).unwrap().load().unwrap(),first);assert_eq!(std::fs::read(root.path().join("key.dpapi")).unwrap(),encrypted);
  let before=std::fs::read(root.path().join("finance.db")).unwrap();assert!(!before.starts_with(b"SQLite format 3"));
  std::fs::remove_file(root.path().join("key.dpapi")).unwrap();assert!(open_at(root.path()).is_err());assert_eq!(std::fs::read(root.path().join("finance.db")).unwrap(),before);assert!(!root.path().join("key.dpapi").exists());
 }
 #[test]fn electron_corrupt_dpapi_key_never_replaces_original(){
  let root=tempfile::tempdir().unwrap();open_at(root.path()).unwrap().load().unwrap();let before=std::fs::read(root.path().join("finance.db")).unwrap();std::fs::write(root.path().join("key.dpapi"),b"SYNTHETIC INVALID KEY").unwrap();assert!(open_at(root.path()).is_err());assert_eq!(std::fs::read(root.path().join("finance.db")).unwrap(),before);assert_eq!(std::fs::read(root.path().join("key.dpapi")).unwrap(),b"SYNTHETIC INVALID KEY");
 }
}
