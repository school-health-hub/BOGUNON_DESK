use crate::{
    own_approval::Paths,
    own_result::{Counters, Evidence, Report},
    own_store::Store,
};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(0);
struct Temp(PathBuf);
impl Temp {
    fn new() -> Self {
        let directory = std::env::temp_dir().join(format!(
            "bogunon-own-store-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        Self(directory)
    }
    fn paths(&self) -> Paths {
        Paths {
            output: self.0.join("own-evidence.json"),
            staging: self.0.join("own-evidence.staging.json"),
            claim: self.0.join("own-run.claim"),
        }
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn record() -> Evidence {
    let mut report = Report::new(Ok(Counters {
        created: 1,
        destroyed: 1,
        rejected: 1,
        main_unchanged: true,
    }));
    report.finish_cleanup(Ok(()), Some(0));
    Evidence::new("a".repeat(40), "b".repeat(64), &report)
}
#[test]
fn own_store_publishes_verified_identical_bytes_without_replacing() {
    let temp = Temp::new();
    let mut store = Store::open(temp.paths(), Vec::new()).unwrap();
    store.claim().unwrap();
    store.save(&record()).unwrap();
    let first = fs::read(temp.paths().output).unwrap();
    assert_eq!(first, fs::read(temp.paths().staging).unwrap());
    assert!(store.save(&record()).is_err());
    drop(store);
    assert!(Store::open(temp.paths(), Vec::new()).is_err());
    assert_eq!(first, fs::read(temp.paths().output).unwrap());
}
#[test]
fn own_store_existing_claim_prevents_a_second_attempt() {
    let temp = Temp::new();
    let mut store = Store::open(temp.paths(), Vec::new()).unwrap();
    store.claim().unwrap();
    assert!(store.claim().is_err());
    drop(store);
    assert!(Store::open(temp.paths(), Vec::new()).is_err());
}
#[test]
fn own_store_rechecks_destination_created_after_preflight() {
    let temp = Temp::new();
    let mut store = Store::open(temp.paths(), Vec::new()).unwrap();
    fs::write(temp.paths().output, b"preserved").unwrap();
    assert!(store.save(&record()).is_err());
    assert_eq!(fs::read(temp.paths().output).unwrap(), b"preserved");
}
#[test]
fn own_store_never_creates_missing_output_directory() {
    let temp = Temp::new();
    let path = temp.0.join("missing");
    assert!(Store::open(
        Paths {
            output: path.join("own-evidence.json"),
            staging: path.join("own-evidence.staging.json"),
            claim: path.join("own-run.claim")
        },
        Vec::new()
    )
    .is_err());
    assert!(!path.exists());
}
