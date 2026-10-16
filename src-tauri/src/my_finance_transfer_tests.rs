use super::*;
#[test]
fn my_finance_backup_file_atomic_and_noclobber() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("synthetic.bgfnbk");
    let ciphertext =
        crate::my_finance_backup::seal(b"synthetic plaintext", "synthetic-password-123").unwrap();
    write_backup(&path, &ciphertext).unwrap();
    assert_eq!(read_backup(&path).unwrap(), ciphertext);
    assert!(write_backup(&path, b"never replace").is_err());
    assert_eq!(read_backup(&path).unwrap(), ciphertext);
    assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    let oversized = dir.path().join("oversized");
    std::fs::File::create(&oversized)
        .unwrap()
        .set_len(crate::my_finance_backup::MAX_BACKUP as u64 + 1)
        .unwrap();
    assert!(read_backup(&oversized).is_err());
    assert!(read_backup(dir.path()).is_err());
}
#[test]
fn my_finance_restore_tickets_password_cancel_expiry_and_replay() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = FinanceStore::open(&dir.path().join("finance.db"), &[42; 32]).unwrap();
    let current = store.load().unwrap();
    let mut incoming = current.clone();
    incoming.identity.revision += 1;
    incoming.identity.history.push(Uuid::new_v4());
    let encrypted =
        crate::my_finance_codec::export_snapshot(&incoming, "synthetic-password-123").unwrap();
    let mut session = TransferSession::default();
    let token = session.select(encrypted.clone()).unwrap();
    assert!(session
        .inspect(token, "wrong-password-123", &current)
        .is_err());
    assert!(session.commit(token, &mut store).is_err());
    assert_eq!(store.load().unwrap(), current);
    let token = session.select(encrypted.clone()).unwrap();
    assert!(
        session
            .inspect(token, "synthetic-password-123", &current)
            .unwrap()
            .eligible
    );
    assert_eq!(session.commit(token, &mut store).unwrap(), incoming);
    assert!(session.commit(token, &mut store).is_err());
    let token = session.select(encrypted.clone()).unwrap();
    assert!(
        !session
            .inspect(token, "synthetic-password-123", &incoming)
            .unwrap()
            .eligible
    );
    assert!(session.commit(token, &mut store).is_err());
    let token = session.select(encrypted.clone()).unwrap();
    session.cancel();
    assert!(session
        .inspect(token, "synthetic-password-123", &incoming)
        .is_err());
    let token = session.select(encrypted).unwrap();
    session.0.as_mut().unwrap().expires = Instant::now() - Duration::from_secs(1);
    assert!(session.commit(token, &mut store).is_err());
    assert!(session.0.is_none());
}
#[test]
fn my_finance_restore_tickets_bind_bytes_and_full_current_state() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = FinanceStore::open(&dir.path().join("finance.db"), &[42; 32]).unwrap();
    let current = store.load().unwrap();
    let mut incoming = current.clone();
    incoming.identity.revision += 2;
    incoming
        .identity
        .history
        .extend([Uuid::new_v4(), Uuid::new_v4()]);
    let mut session = TransferSession::default();
    let encrypted =
        crate::my_finance_codec::export_snapshot(&incoming, "synthetic-password-123").unwrap();
    let token = session.select(encrypted.clone()).unwrap();
    session
        .inspect(token, "synthetic-password-123", &current)
        .unwrap();
    let mut intermediate = current.clone();
    intermediate.identity.revision += 1;
    intermediate
        .identity
        .history
        .push(incoming.identity.history[1]);
    store.restore(&current, intermediate.clone()).unwrap();
    assert!(session.commit(token, &mut store).is_err());
    assert_eq!(store.load().unwrap(), intermediate);
    let old = session.select(encrypted.clone()).unwrap();
    let new = session.select(encrypted.clone()).unwrap();
    assert_ne!(old, new);
    session.cancel_ticket(old);
    assert!(
        session
            .inspect(new, "synthetic-password-123", &intermediate)
            .unwrap()
            .eligible
    );
    assert!(session
        .inspect(old, "synthetic-password-123", &intermediate)
        .is_err());
    assert!(
        session
            .inspect(new, "synthetic-password-123", &intermediate)
            .unwrap()
            .eligible
    );
    let mut corrupt = encrypted.clone();
    *corrupt.last_mut().unwrap() ^= 1;
    let token = session.select(corrupt).unwrap();
    assert!(session
        .inspect(token, "synthetic-password-123", &intermediate)
        .is_err());
    let mut legacy = incoming.clone();
    legacy.identity.schema_version = 1;
    let invalid = crate::my_finance_backup::seal(
        &serde_json::to_vec(&legacy).unwrap(),
        "synthetic-password-123",
    )
    .unwrap();
    let token = session.select(invalid).unwrap();
    assert!(
        !session
            .inspect(token, "synthetic-password-123", &intermediate)
            .unwrap()
            .eligible
    );
    assert!(session.commit(token, &mut store).is_err());
    assert_eq!(store.load().unwrap(), intermediate);
}
