use crate::{
    evidence_paths,
    own_approval::{self, Actual},
    own_result::Error,
    own_store::Store,
};
use sha2::{Digest, Sha256};
use std::{
    fs::{File, OpenOptions},
    io::Read,
    os::windows::fs::OpenOptionsExt,
    path::Path,
};

pub struct Permit(());
pub struct Prepared {
    pub permit: Permit,
    pub store: Store,
    pub source_sha: String,
    pub artifact_sha: String,
}
pub fn authorize() -> Result<Prepared, Error> {
    if std::env::args_os().len() != 1
        || std::env::var("BOGUNON_OWN_WINDOW_QA_OPT_IN").as_deref() != Ok("APPROVED_9B2O")
    {
        return Err(Error::Gate);
    }
    let manifest = std::env::var_os("BOGUNON_OWN_WINDOW_QA_MANIFEST").ok_or(Error::Gate)?;
    let descriptor =
        std::env::var_os("BOGUNON_OWN_WINDOW_QA_EVIDENCE_APPROVAL").ok_or(Error::Gate)?;
    let manifest = Path::new(&manifest);
    let descriptor = Path::new(&descriptor);
    let executable = std::env::current_exe().map_err(|_| Error::Gate)?;
    let mut guards = Vec::new();
    for path in [manifest, descriptor, &executable] {
        guards.extend(evidence_paths::lock_directories(path).map_err(|()| Error::Gate)?);
    }
    let (manifest_file, runtime) =
        evidence_paths::read_locked(manifest).map_err(|()| Error::Gate)?;
    let (descriptor_file, text) =
        evidence_paths::read_locked(descriptor).map_err(|()| Error::Gate)?;
    let mut file = OpenOptions::new()
        .read(true)
        .share_mode(1)
        .custom_flags(0x00200000)
        .open(&executable)
        .map_err(|_| Error::Gate)?;
    use std::os::windows::fs::MetadataExt;
    let metadata = file.metadata().map_err(|_| Error::Gate)?;
    evidence_paths::ordinary_attributes(metadata.file_attributes()).map_err(|()| Error::Gate)?;
    if !metadata.is_file() {
        return Err(Error::Gate);
    }
    let artifact_sha = digest(&mut file)?;
    let source_sha = option_env!("BOGUNON_OWN_WINDOW_SOURCE_SHA")
        .unwrap_or("UNSET")
        .to_owned();
    let paths = own_approval::parse(
        &runtime,
        &text,
        Actual {
            executable: &executable,
            artifact_sha: &artifact_sha,
            source_sha: &source_sha,
            descriptor,
        },
    )?;
    guards.extend([manifest_file, descriptor_file, file]);
    let mut store = Store::open(paths, guards)?;
    crate::live_permissions::verify_permissions().map_err(|_| Error::Gate)?;
    crate::own_permissions::input_desktop()?;
    store.claim()?;
    Ok(Prepared {
        permit: Permit(()),
        store,
        source_sha,
        artifact_sha,
    })
}
fn digest(file: &mut File) -> Result<String, Error> {
    let mut digest = Sha256::new();
    let mut buffer = [0; 8192];
    loop {
        let size = file.read(&mut buffer).map_err(|_| Error::Gate)?;
        if size == 0 {
            break;
        }
        digest.update(&buffer[..size]);
    }
    Ok(format!("{:x}", digest.finalize()))
}
