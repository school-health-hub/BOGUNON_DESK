use std::path::Path;

use super::{
    output_ledger::OutputLedger,
    output_model::{FileStatus, OperationStatus, OutputSaveOutcome, RecoveryReport},
    output_storage::{classify, digest_file},
};

pub(super) fn recover(ledger_root: &Path) -> Result<RecoveryReport, String> {
    let ledger = OutputLedger::new(ledger_root);
    let mut operations = ledger.load()?;
    let mut inspected = 0;
    let mut recovered = 0;
    let mut reconciliation_required = 0;
    for operation in &mut operations {
        if !matches!(
            operation.status,
            OperationStatus::Pending | OperationStatus::ReconciliationRequired
        ) {
            continue;
        }
        inspected += 1;
        for file in &mut operation.files {
            let path = operation.target_path.join(&file.file_name);
            file.status = if path.is_file()
                && digest_file(&path)
                    .map(|hash| hash == file.sha256)
                    .unwrap_or(false)
            {
                file.failure_reason = None;
                FileStatus::Preserved
            } else {
                file.failure_reason =
                    Some("저장 파일이 없거나 해시가 일치하지 않습니다.".to_owned());
                FileStatus::Failed
            };
        }
        operation.status = classify(&operation.files);
        if matches!(operation.status, OperationStatus::Succeeded) {
            recovered += 1;
        } else {
            reconciliation_required += 1;
        }
    }
    ledger.save(operations)?;
    Ok(RecoveryReport {
        inspected,
        recovered,
        reconciliation_required,
    })
}

pub(super) fn last_success(
    ledger_root: &Path,
    project_id: &str,
) -> Result<Option<OutputSaveOutcome>, String> {
    let operations = OutputLedger::new(ledger_root).load()?;
    Ok(operations
        .iter()
        .rev()
        .find(|entry| {
            entry.project_id == project_id && matches!(entry.status, OperationStatus::Succeeded)
        })
        .map(OutputSaveOutcome::from))
}
