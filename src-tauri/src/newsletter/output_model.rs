use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct OutputArtifactInput {
    pub(super) stable_id: String,
    pub(super) file_name: String,
    pub(super) media_type: String,
    pub(super) sha256: String,
    pub(super) bytes_base64: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub(super) enum CollisionPolicy {
    Deny,
    Replace,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OutputSaveRequest {
    pub(super) target_token: String,
    pub(super) operation_id: String,
    pub(super) project_id: String,
    pub(super) project_revision: u64,
    pub(super) design_revision: u64,
    pub(super) profile: String,
    pub(super) profile_version: u64,
    pub(super) created_at: String,
    pub(super) collision_policy: CollisionPolicy,
    pub(super) artifacts: Vec<OutputArtifactInput>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(super) enum OperationStatus {
    Pending,
    Partial,
    Succeeded,
    Failed,
    ReconciliationRequired,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(super) enum FileStatus {
    Pending,
    Saved,
    Preserved,
    Failed,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FileRecord {
    pub(super) stable_id: String,
    pub(super) file_name: String,
    pub(super) sha256: String,
    pub(super) status: FileStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) failure_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct OperationRecord {
    pub(super) operation_id: String,
    pub(super) project_id: String,
    pub(super) project_revision: u64,
    pub(super) design_revision: u64,
    pub(super) profile: String,
    pub(super) profile_version: u64,
    pub(super) created_at: String,
    pub(super) target_path: PathBuf,
    pub(super) target_label: String,
    pub(super) status: OperationStatus,
    pub(super) files: Vec<FileRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SelectedOutputTarget {
    pub(super) token: String,
    pub(super) label: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublicFileRecord {
    pub(super) stable_id: String,
    pub(super) file_name: String,
    pub(super) sha256: String,
    pub(super) status: FileStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) failure_reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OutputSaveOutcome {
    pub(super) operation_id: String,
    pub(super) project_id: String,
    pub(super) project_revision: u64,
    pub(super) design_revision: u64,
    pub(super) profile: String,
    pub(super) profile_version: u64,
    pub(super) created_at: String,
    pub(super) target_label: String,
    pub(super) status: OperationStatus,
    pub(super) files: Vec<PublicFileRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecoveryReport {
    pub(super) inspected: usize,
    pub(super) recovered: usize,
    pub(super) reconciliation_required: usize,
}

impl From<&OperationRecord> for OutputSaveOutcome {
    fn from(record: &OperationRecord) -> Self {
        Self {
            operation_id: record.operation_id.clone(),
            project_id: record.project_id.clone(),
            project_revision: record.project_revision,
            design_revision: record.design_revision,
            profile: record.profile.clone(),
            profile_version: record.profile_version,
            created_at: record.created_at.clone(),
            target_label: record.target_label.clone(),
            status: record.status.clone(),
            files: record
                .files
                .iter()
                .map(|file| PublicFileRecord {
                    stable_id: file.stable_id.clone(),
                    file_name: file.file_name.clone(),
                    sha256: file.sha256.clone(),
                    status: file.status.clone(),
                    failure_reason: file.failure_reason.clone(),
                })
                .collect(),
        }
    }
}
