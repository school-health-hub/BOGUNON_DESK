use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Component, Path},
};

use atomic_write_file::AtomicWriteFile;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};

use super::{
    output_ledger::OutputLedger,
    output_model::{
        CollisionPolicy, FileRecord, FileStatus, OperationRecord, OperationStatus,
        OutputArtifactInput, OutputSaveOutcome, OutputSaveRequest,
    },
    output_paths::{reject_existing_link, safe_target},
};

pub(super) fn save_outputs(
    ledger_root: &Path,
    target: &Path,
    target_label: &str,
    request: OutputSaveRequest,
) -> Result<OutputSaveOutcome, String> {
    validate_request(&request)?;
    let canonical_target = safe_target(target)?;
    let ledger = OutputLedger::new(ledger_root);
    let mut operations = ledger.load()?;
    if let Some(existing) = operations
        .iter()
        .find(|entry| entry.operation_id == request.operation_id)
    {
        return Ok(OutputSaveOutcome::from(existing));
    }

    let mut record = OperationRecord {
        operation_id: request.operation_id.clone(),
        project_id: request.project_id.clone(),
        project_revision: request.project_revision,
        design_revision: request.design_revision,
        profile: request.profile.clone(),
        profile_version: request.profile_version,
        created_at: request.created_at.clone(),
        target_path: canonical_target.clone(),
        target_label: target_label.to_owned(),
        status: OperationStatus::Pending,
        files: request
            .artifacts
            .iter()
            .map(|artifact| FileRecord {
                stable_id: artifact.stable_id.clone(),
                file_name: artifact.file_name.clone(),
                sha256: artifact.sha256.clone(),
                status: FileStatus::Pending,
                failure_reason: None,
            })
            .collect(),
    };
    operations.push(record.clone());
    ledger.save(operations.clone())?;

    for (index, artifact) in request.artifacts.iter().enumerate() {
        match save_artifact(
            &canonical_target,
            ledger_root,
            &request.operation_id,
            artifact,
            request.collision_policy,
        ) {
            Ok(status) => record.files[index].status = status,
            Err(reason) => {
                record.files[index].status = FileStatus::Failed;
                record.files[index].failure_reason = Some(reason);
            }
        }
        replace_record(&mut operations, &record);
        if ledger.save(operations.clone()).is_err() {
            record.status = OperationStatus::ReconciliationRequired;
            return Ok(OutputSaveOutcome::from(&record));
        }
    }

    record.status = classify(&record.files);
    replace_record(&mut operations, &record);
    if ledger.save(operations).is_err() {
        record.status = OperationStatus::ReconciliationRequired;
    }
    Ok(OutputSaveOutcome::from(&record))
}

fn save_artifact(
    target: &Path,
    ledger_root: &Path,
    operation_id: &str,
    artifact: &OutputArtifactInput,
    collision_policy: CollisionPolicy,
) -> Result<FileStatus, String> {
    let bytes = STANDARD
        .decode(&artifact.bytes_base64)
        .map_err(|_| "Newsletter 출력 바이트가 올바르지 않습니다.".to_owned())?;
    if digest(&bytes) != artifact.sha256 {
        return Err("Newsletter 출력 해시가 일치하지 않습니다.".to_owned());
    }
    let destination = target.join(&artifact.file_name);
    reject_existing_link(&destination)?;
    if destination.exists() {
        if digest_file(&destination)? == artifact.sha256 {
            return Ok(FileStatus::Preserved);
        }
        match collision_policy {
            CollisionPolicy::Deny => {
                return Err("같은 이름의 출력 파일이 이미 있습니다.".to_owned())
            }
            CollisionPolicy::Replace => {
                preserve_existing(&destination, ledger_root, operation_id, &artifact.file_name)?
            }
        }
    }
    atomic_write(&destination, &bytes)?;
    if digest_file(&destination)? != artifact.sha256 {
        return Err("저장된 Newsletter 출력 해시가 일치하지 않습니다.".to_owned());
    }
    Ok(FileStatus::Saved)
}

fn validate_request(request: &OutputSaveRequest) -> Result<(), String> {
    if !safe_identifier(&request.operation_id)
        || !safe_identifier(&request.project_id)
        || request.project_revision == 0
        || request.design_revision == 0
        || request.profile_version == 0
        || request.artifacts.is_empty()
    {
        return Err("Newsletter 출력 요청이 올바르지 않습니다.".to_owned());
    }
    let mut names = HashSet::new();
    let mut ids = HashSet::new();
    for artifact in &request.artifacts {
        validate_artifact(artifact)?;
        if !names.insert(artifact.file_name.as_str()) || !ids.insert(artifact.stable_id.as_str()) {
            return Err("Newsletter 출력 파일 ID 또는 이름이 중복됩니다.".to_owned());
        }
    }
    validate_profile(request)?;
    Ok(())
}

fn validate_profile(request: &OutputSaveRequest) -> Result<(), String> {
    let valid = match request.profile.as_str() {
        "a4-png" => request.artifacts.len() == 1 && request.artifacts[0].media_type == "image/png",
        "a4-pdf" | "cards-pdf" => {
            request.artifacts.len() == 1 && request.artifacts[0].media_type == "application/pdf"
        }
        "card-pngs" => {
            request.artifacts.len() == 7
                && request
                    .artifacts
                    .iter()
                    .all(|artifact| artifact.media_type == "image/png")
        }
        _ => false,
    };
    if valid {
        Ok(())
    } else {
        Err("Newsletter 출력 묶음 구성이 올바르지 않습니다.".to_owned())
    }
}

fn validate_artifact(artifact: &OutputArtifactInput) -> Result<(), String> {
    let component_count = Path::new(&artifact.file_name).components().count();
    let normal_component = matches!(
        Path::new(&artifact.file_name).components().next(),
        Some(Component::Normal(_))
    );
    let media_type_valid = matches!(
        artifact.media_type.as_str(),
        "image/png" | "application/pdf"
    );
    if !safe_identifier(&artifact.stable_id)
        || component_count != 1
        || !normal_component
        || artifact.file_name.contains(['/', '\\'])
        || artifact.sha256.len() != 64
        || !artifact.sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
        || !media_type_valid
    {
        return Err("Newsletter 출력 파일 정보가 올바르지 않습니다.".to_owned());
    }
    Ok(())
}

fn safe_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn preserve_existing(
    source: &Path,
    ledger_root: &Path,
    operation_id: &str,
    file_name: &str,
) -> Result<(), String> {
    let backup_directory = ledger_root.join("preserved").join(operation_id);
    fs::create_dir_all(&backup_directory)
        .map_err(|_| "기존 출력 파일을 보호할 수 없습니다.".to_owned())?;
    let destination = backup_directory.join(file_name);
    let bytes = fs::read(source).map_err(|_| "기존 출력 파일을 보호할 수 없습니다.".to_owned())?;
    atomic_write(&destination, &bytes)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = AtomicWriteFile::open(path)
        .map_err(|_| "Newsletter 출력 파일을 만들 수 없습니다.".to_owned())?;
    file.write_all(bytes)
        .map_err(|_| "Newsletter 출력 파일을 기록할 수 없습니다.".to_owned())?;
    file.flush()
        .map_err(|_| "Newsletter 출력 파일을 기록할 수 없습니다.".to_owned())?;
    file.as_file()
        .sync_all()
        .map_err(|_| "Newsletter 출력 파일을 기록할 수 없습니다.".to_owned())?;
    file.commit()
        .map_err(|_| "Newsletter 출력 파일을 확정할 수 없습니다.".to_owned())
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub(super) fn digest_file(path: &Path) -> Result<String, String> {
    fs::read(path)
        .map(|bytes| digest(&bytes))
        .map_err(|_| "Newsletter 출력 파일을 검증할 수 없습니다.".to_owned())
}

fn replace_record(operations: &mut [OperationRecord], record: &OperationRecord) {
    if let Some(existing) = operations
        .iter_mut()
        .find(|entry| entry.operation_id == record.operation_id)
    {
        existing.clone_from(record);
    }
}

pub(super) fn classify(files: &[FileRecord]) -> OperationStatus {
    let successful = files
        .iter()
        .filter(|file| matches!(file.status, FileStatus::Saved | FileStatus::Preserved))
        .count();
    if successful == files.len() {
        OperationStatus::Succeeded
    } else if successful == 0 {
        OperationStatus::Failed
    } else {
        OperationStatus::Partial
    }
}
