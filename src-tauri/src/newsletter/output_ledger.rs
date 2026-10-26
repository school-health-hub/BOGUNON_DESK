use std::{fs, io::Write, path::Path};

use atomic_write_file::AtomicWriteFile;

use super::output_model::OperationRecord;

const LEDGER_VERSION: u64 = 1;

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LedgerDocument {
    ledger_version: u64,
    operations: Vec<OperationRecord>,
}

pub(super) struct OutputLedger<'a> {
    root: &'a Path,
}

impl<'a> OutputLedger<'a> {
    pub(super) const fn new(root: &'a Path) -> Self {
        Self { root }
    }

    pub(super) fn load(&self) -> Result<Vec<OperationRecord>, String> {
        match self.read(&self.current_path()) {
            Ok(document) => Ok(document.operations),
            Err(error) if error == "missing" => Ok(Vec::new()),
            Err(_) => self
                .read(&self.last_known_good_path())
                .map(|document| document.operations)
                .map_err(|_| "Newsletter 출력 원장을 복구할 수 없습니다.".to_owned()),
        }
    }

    pub(super) fn save(&self, operations: Vec<OperationRecord>) -> Result<(), String> {
        fs::create_dir_all(self.root)
            .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())?;
        reject_link(self.root)?;
        let bytes = serde_json::to_vec_pretty(&LedgerDocument {
            ledger_version: LEDGER_VERSION,
            operations,
        })
        .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())?;
        atomic_write(&self.current_path(), &bytes)?;
        atomic_write(&self.last_known_good_path(), &bytes)
    }

    fn read(&self, path: &Path) -> Result<LedgerDocument, String> {
        let bytes = fs::read(path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "missing".to_owned()
            } else {
                "unavailable".to_owned()
            }
        })?;
        let document: LedgerDocument =
            serde_json::from_slice(&bytes).map_err(|_| "corrupted".to_owned())?;
        if document.ledger_version != LEDGER_VERSION {
            return Err("unsupported".to_owned());
        }
        Ok(document)
    }

    fn current_path(&self) -> std::path::PathBuf {
        self.root.join("output-ledger.json")
    }

    fn last_known_good_path(&self) -> std::path::PathBuf {
        self.root.join("output-ledger.last-known-good.json")
    }
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = AtomicWriteFile::open(path)
        .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())?;
    file.write_all(bytes)
        .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())?;
    file.flush()
        .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())?;
    file.as_file()
        .sync_all()
        .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())?;
    file.commit()
        .map_err(|_| "Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())
}

fn reject_link(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| "Newsletter 출력 원장을 사용할 수 없습니다.".to_owned())?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
        Err("Newsletter 출력 원장을 사용할 수 없습니다.".to_owned())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
const fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
