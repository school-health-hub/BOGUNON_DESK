//! Two independent stores/keys. Shared synthetic fixtures also exercise the JS
//! annual summary after native transfer and reopen; never uses real finance.
use super::*;
use crate::my_finance_snapshot::RestoreDecision;
use crate::my_finance_transfer::TransferSession;
const PASSWORD: &str = "synthetic-portable-password-123";

fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../src/my-finance/fixtures/cross-pc-synthetic.json"
    ))
    .unwrap()
}
fn entries() -> Vec<IncomeEntry> {
    serde_json::from_value(fixture()["schoolIncome"].clone()).unwrap()
}
pub(crate) fn expected_income() -> Vec<IncomeEntry> {
    let mut income = entries();
    income[1] = serde_json::from_value(fixture()["homeUpdate"].clone()).unwrap();
    income.push(serde_json::from_value(fixture()["homeCreate"].clone()).unwrap());
    income
}
fn source(store: &mut FinanceStore) -> FinanceSnapshot {
    let mut current = store.load().unwrap();
    for entry in entries() {
        current = store
            .apply(&current.identity, IncomeMutation::Create(entry))
            .unwrap();
    }
    current
}
fn stage(snapshot: &FinanceSnapshot, current: &FinanceSnapshot) -> (TransferSession, Uuid, bool) {
    let encrypted = crate::my_finance_codec::export_snapshot(snapshot, PASSWORD).unwrap();
    // An actual portable ciphertext file is the only object moved between PCs.
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("synthetic.bgfnbk");
    crate::my_finance_transfer::write_backup(&file, &encrypted).unwrap();
    let mut session = TransferSession::default();
    let token = session
        .select(crate::my_finance_transfer::read_backup(&file).unwrap())
        .unwrap();
    let preview = session.inspect(token, PASSWORD, current).unwrap();
    assert!(preview.eligible);
    assert_eq!(preview.current_dataset_id, current.identity.dataset_id);
    assert_eq!(preview.backup_dataset_id, snapshot.identity.dataset_id);
    (session, token, preview.requires_dataset_confirmation)
}

/// Shared by the core test (distinct raw keys) and Windows test (distinct DPAPI
/// protected installation keys). Close/reopen each store at every boundary.
pub(crate) fn round_trip_with(open: impl Fn(&str) -> FinanceStore) -> FinanceSnapshot {
    let school = source(&mut open("school"));
    let initial_home = open("home").load().unwrap();
    assert_ne!(school.identity.dataset_id, initial_home.identity.dataset_id);
    let (mut session, token, adoption) = stage(&school, &initial_home);
    assert!(adoption);
    assert_eq!(
        session
            .commit_confirmed(token, &mut open("home"), true)
            .unwrap(),
        school
    );
    assert_eq!(open("home").load().unwrap(), open("school").load().unwrap());
    let update: IncomeEntry = serde_json::from_value(fixture()["homeUpdate"].clone()).unwrap();
    let home = open("home")
        .apply(&school.identity, IncomeMutation::Update(update))
        .unwrap();
    let create: IncomeEntry = serde_json::from_value(fixture()["homeCreate"].clone()).unwrap();
    let home = open("home")
        .apply(&home.identity, IncomeMutation::Create(create))
        .unwrap();
    assert_eq!(open("home").load().unwrap(), home);
    let (mut session, token, adoption) = stage(&home, &school);
    assert!(!adoption);
    assert_eq!(
        session
            .commit_confirmed(token, &mut open("school"), false)
            .unwrap(),
        home
    );
    let school = open("school").load().unwrap();
    let home = open("home").load().unwrap();
    assert_eq!(school, home);
    assert_eq!(school.income, expected_income());
    assert_eq!(school.identity.revision, 6);
    assert_eq!(school.identity.history.len(), 6);
    school
}
#[test]
fn my_finance_cross_pc_round_trip_and_fork_rejection() {
    let dir = tempfile::tempdir().unwrap();
    let open = |name: &str| {
        FinanceStore::open(
            &dir.path().join(format!("{name}.db")),
            if name == "school" {
                &[41; 32]
            } else {
                &[42; 32]
            },
        )
        .unwrap()
    };
    let common = round_trip_with(open);
    let mut a = common.income[0].clone();
    a.notes = "synthetic school fork".into();
    let school = open("school")
        .apply(&common.identity, IncomeMutation::Update(a))
        .unwrap();
    let mut b = common.income[1].clone();
    b.notes = "synthetic home fork".into();
    let home = open("home")
        .apply(&common.identity, IncomeMutation::Update(b))
        .unwrap();
    assert_eq!(school.identity.revision, home.identity.revision);
    for (name, local, incoming) in [("school", &school, &home), ("home", &home, &school)] {
        assert_eq!(
            restore_decision(local, incoming),
            RestoreDecision::RejectDiverged
        );
        let encrypted = crate::my_finance_codec::export_snapshot(incoming, PASSWORD).unwrap();
        let mut session = TransferSession::default();
        let token = session.select(encrypted).unwrap();
        assert!(!session.inspect(token, PASSWORD, local).unwrap().eligible);
        assert!(session
            .commit_confirmed(token, &mut open(name), true)
            .is_err());
        assert_eq!(open(name).load().unwrap(), *local);
    }
    assert!(FinanceStore::open(&dir.path().join("school.db"), &[42; 32]).is_err());
    assert!(FinanceStore::open(&dir.path().join("home.db"), &[41; 32]).is_err());
}
#[test]
fn my_finance_initial_adoption_requires_confirmation_and_pristine_history() {
    let dir = tempfile::tempdir().unwrap();
    let key = [42; 32];
    let mut local = FinanceStore::open(&dir.path().join("home.db"), &key).unwrap();
    let initial = local.load().unwrap();
    let incoming =
        source(&mut FinanceStore::open(&dir.path().join("school.db"), &[41; 32]).unwrap());
    assert_eq!(
        restore_decision(&initial, &incoming),
        RestoreDecision::AllowNewDataset
    );
    let (mut session, token, _) = stage(&incoming, &initial);
    assert!(session.commit(token, &mut local).is_err());
    assert_eq!(local.load().unwrap(), initial);
    let (mut session, token, _) = stage(&incoming, &initial);
    let created = local
        .apply(
            &initial.identity,
            IncomeMutation::Create(entries()[0].clone()),
        )
        .unwrap();
    assert!(session.commit_confirmed(token, &mut local, true).is_err());
    assert_eq!(local.load().unwrap(), created);
    assert_eq!(
        restore_decision(&created, &incoming),
        RestoreDecision::RejectDifferentDataset
    );
    assert!(local
        .restore_confirmed(&created, incoming.clone(), true)
        .is_err());
    let deleted = local
        .apply(
            &created.identity,
            IncomeMutation::Delete(created.income[0].id),
        )
        .unwrap();
    assert!(deleted.income.is_empty());
    assert_eq!(deleted.identity.revision, 3);
    assert_eq!(
        restore_decision(&deleted, &incoming),
        RestoreDecision::RejectDifferentDataset
    );
    assert!(local.restore_confirmed(&deleted, incoming, true).is_err());
    assert_eq!(local.load().unwrap(), deleted);
}
#[test]
fn my_finance_initial_adoption_authentication_and_transaction_failures() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("home.db");
    let mut local = FinanceStore::open(&path, &[42; 32]).unwrap();
    let current = local.load().unwrap();
    let incoming =
        source(&mut FinanceStore::open(&dir.path().join("school.db"), &[41; 32]).unwrap());
    let encrypted = crate::my_finance_codec::export_snapshot(&incoming, PASSWORD).unwrap();
    let mut session = TransferSession::default();
    let token = session.select(encrypted.clone()).unwrap();
    assert!(session
        .inspect(token, "synthetic-wrong-password", &current)
        .is_err());
    assert!(session.commit_confirmed(token, &mut local, true).is_err());
    let mut corrupt = encrypted;
    *corrupt.last_mut().unwrap() ^= 1;
    let token = session.select(corrupt).unwrap();
    assert!(session.inspect(token, PASSWORD, &current).is_err());
    assert!(session.commit_confirmed(token, &mut local, true).is_err());
    assert_eq!(local.load().unwrap(), current);
    assert!(local
        .restore_confirmed_with_hook(&current, incoming.clone(), true, || Err(
            "synthetic adoption interruption"
        ))
        .is_err());
    assert_eq!(local.load().unwrap(), current);
    let safety: Vec<u8> = local
        .0
        .query_row("SELECT payload FROM finance_restore_safety", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(
        serde_json::from_slice::<FinanceSnapshot>(&safety).unwrap(),
        current
    );
    local.0.execute_batch("CREATE TRIGGER fail_adoption BEFORE UPDATE ON finance_snapshot BEGIN SELECT RAISE(ABORT,'synthetic'); END;").unwrap();
    assert!(local.restore_confirmed(&current, incoming, true).is_err());
    drop(local);
    assert_eq!(
        FinanceStore::open(&path, &[42; 32])
            .unwrap()
            .load()
            .unwrap(),
        current
    );
}
#[test]
fn my_finance_initial_adoption_process_interruption() {
    const ROOT: &str = "BOGUNON_SYNTHETIC_ADOPTION_ROOT";
    if let Some(root) = std::env::var_os(ROOT) {
        let root = std::path::PathBuf::from(root);
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("bogunon-synthetic-adoption-"));
        let mut local = FinanceStore::open(&root.join("home.db"), &[42; 32]).unwrap();
        let initial = local.load().unwrap();
        let bytes =
            crate::my_finance_transfer::read_backup(&root.join("synthetic.bgfnbk")).unwrap();
        let (incoming, _) =
            crate::my_finance_codec::inspect_restore(&bytes, PASSWORD, Some(&initial.identity))
                .unwrap();
        let _ =
            local.restore_confirmed_with_hook(&initial, incoming, true, || std::process::exit(74));
        panic!("synthetic exit did not run");
    }
    let dir = tempfile::Builder::new()
        .prefix("bogunon-synthetic-adoption-")
        .tempdir()
        .unwrap();
    let path = dir.path().join("home.db");
    let initial = FinanceStore::open(&path, &[42; 32])
        .unwrap()
        .load()
        .unwrap();
    let incoming =
        source(&mut FinanceStore::open(&dir.path().join("school.db"), &[41; 32]).unwrap());
    let bytes = crate::my_finance_codec::export_snapshot(&incoming, PASSWORD).unwrap();
    crate::my_finance_transfer::write_backup(&dir.path().join("synthetic.bgfnbk"), &bytes).unwrap();
    let full = concat!(
        module_path!(),
        "::my_finance_initial_adoption_process_interruption"
    );
    let name = full.split_once("::").unwrap().1;
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", name, "--nocapture"])
        .env(ROOT, dir.path())
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(74));
    let mut local = FinanceStore::open(&path, &[42; 32]).unwrap();
    assert_eq!(local.load().unwrap(), initial);
    let safety: Vec<u8> = local
        .0
        .query_row("SELECT payload FROM finance_restore_safety", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(
        serde_json::from_slice::<FinanceSnapshot>(&safety).unwrap(),
        initial
    );
    let (mut session, token, _) = stage(&incoming, &initial);
    assert_eq!(
        session.commit_confirmed(token, &mut local, true).unwrap(),
        incoming
    );
    drop(local);
    assert_eq!(
        FinanceStore::open(&path, &[42; 32])
            .unwrap()
            .load()
            .unwrap(),
        incoming
    );
}
