use std::path::{Component, Path};
use thiserror::Error;

pub const SOURCE_SHA: &str = "97dd7116a0844f86414812946b446cbbfdb5a209";
pub const REPOSITORY: &str = "school-health-hub/BOGUNON_DESK";
pub const WORKFLOW_PATH: &str = ".github/workflows/desktop-surface-c2d2-runtime.yml";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Authorization<'a> {
    pub repository: &'a str,
    pub event: &'a str,
    pub workflow_ref: &'a str,
    pub git_ref: &'a str,
    pub controller_sha: &'a str,
    pub expected_controller_sha: &'a str,
    pub run_id: &'a str,
    pub attempt: &'a str,
    pub runner_os: &'a str,
    pub approval_nonce: &'a str,
    pub requested_udf: &'a Path,
    pub runner_temp: &'a Path,
    pub overrides_clear: bool,
    pub policies_readable_and_clear: bool,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum AuthorizationError {
    #[error("runtime identity is not authorized")]
    Identity,
    #[error("runtime approval is absent or malformed")]
    Approval,
    #[error("runtime attempt is not the first attempt")]
    Retry,
    #[error("runtime is not executing on the Windows runner")]
    Runner,
    #[error("WebView2 override or policy state is not trusted")]
    OverrideOrPolicy,
    #[error("UDF is not an absolute normalized child of RUNNER_TEMP")]
    UdfBoundary,
}

pub fn authorize(input: &Authorization<'_>) -> Result<(), AuthorizationError> {
    let expected_workflow = format!(
        "{}/{}@refs/heads/feature/dashboard-mint-ivory-v2",
        REPOSITORY, WORKFLOW_PATH
    );
    if input.repository != REPOSITORY
        || input.event != "workflow_dispatch"
        || input.git_ref != "refs/heads/feature/dashboard-mint-ivory-v2"
        || input.workflow_ref != expected_workflow
        || input.controller_sha != input.expected_controller_sha
        || input.controller_sha.len() != 40
        || input.run_id.is_empty()
    {
        return Err(AuthorizationError::Identity);
    }
    if input.attempt != "1" {
        return Err(AuthorizationError::Retry);
    }
    if input.runner_os != "Windows" {
        return Err(AuthorizationError::Runner);
    }
    if input.approval_nonce.len() < 32
        || !input
            .approval_nonce
            .bytes()
            .all(|value| value.is_ascii_alphanumeric() || value == b'-' || value == b'_')
    {
        return Err(AuthorizationError::Approval);
    }
    if !input.overrides_clear || !input.policies_readable_and_clear {
        return Err(AuthorizationError::OverrideOrPolicy);
    }
    if !is_normalized_child(input.runner_temp, input.requested_udf) {
        return Err(AuthorizationError::UdfBoundary);
    }
    Ok(())
}

fn is_normalized_child(parent: &Path, child: &Path) -> bool {
    if !parent.is_absolute() || !child.is_absolute() || parent == child {
        return false;
    }
    if parent
        .components()
        .chain(child.components())
        .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return false;
    }
    let parent = parent.to_string_lossy().to_lowercase();
    let child = child.to_string_lossy().to_lowercase();
    let prefix = format!(
        "{}{}",
        parent.trim_end_matches(['\\', '/']),
        std::path::MAIN_SEPARATOR
    );
    child.starts_with(&prefix)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid<'a>(udf: &'a Path, temp: &'a Path) -> Authorization<'a> {
        Authorization {
            repository: REPOSITORY,
            event: "workflow_dispatch",
            workflow_ref: "school-health-hub/BOGUNON_DESK/.github/workflows/desktop-surface-c2d2-runtime.yml@refs/heads/feature/dashboard-mint-ivory-v2",
            git_ref: "refs/heads/feature/dashboard-mint-ivory-v2",
            controller_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            expected_controller_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            run_id: "42",
            attempt: "1",
            runner_os: "Windows",
            approval_nonce: "0123456789abcdef0123456789abcdef",
            requested_udf: udf,
            runner_temp: temp,
            overrides_clear: true,
            policies_readable_and_clear: true,
        }
    }

    #[test]
    fn admits_only_first_attempt_inside_runner_temp() {
        let temp = Path::new(r"C:\runner\temp");
        let udf = Path::new(r"C:\runner\temp\surface-42-1");
        assert_eq!(authorize(&valid(udf, temp)), Ok(()));
        let mut retry = valid(udf, temp);
        retry.attempt = "2";
        assert_eq!(authorize(&retry), Err(AuthorizationError::Retry));
    }

    #[test]
    fn rejects_overrides_policy_uncertainty_and_path_escape() {
        let temp = Path::new(r"C:\runner\temp");
        let mut input = valid(Path::new(r"C:\runner\temp\surface"), temp);
        input.overrides_clear = false;
        assert_eq!(authorize(&input), Err(AuthorizationError::OverrideOrPolicy));
        let escaped = valid(Path::new(r"C:\users\profile"), temp);
        assert_eq!(authorize(&escaped), Err(AuthorizationError::UdfBoundary));
    }
}
