use super::state::DesktopSurfaceState;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct WorkerCandidate {
    pub(crate) is_valid: bool,
    pub(crate) is_visible: bool,
    pub(crate) belongs_to_shell_process: bool,
    pub(crate) hosts_desktop_view: bool,
    pub(crate) is_attachment_sibling: bool,
    pub(crate) has_usable_bounds: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ShellTopology {
    pub(crate) progman_found: bool,
    pub(crate) shell_process_validated: bool,
    pub(crate) desktop_view_host_found: bool,
    pub(crate) workers: Vec<WorkerCandidate>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProbeUnavailableReason {
    #[cfg(not(windows))]
    UnsupportedPlatform,
    ProgmanNotFound,
    ShellProcessNotValidated,
    DesktopViewHostNotFound,
    WorkerwCandidateNotFound,
    AttachmentCandidateNotFound,
    AttachmentCandidateStale,
    AttachmentCandidateNotVisible,
    AttachmentCandidateProcessMismatch,
    AttachmentCandidateBoundsUnavailable,
}

impl ProbeUnavailableReason {
    #[cfg(test)]
    const fn code(self) -> &'static str {
        match self {
            #[cfg(not(windows))]
            Self::UnsupportedPlatform => "unsupported_platform",
            Self::ProgmanNotFound => "progman_not_found",
            Self::ShellProcessNotValidated => "shell_process_not_validated",
            Self::DesktopViewHostNotFound => "desktop_view_host_not_found",
            Self::WorkerwCandidateNotFound => "workerw_candidate_not_found",
            Self::AttachmentCandidateNotFound => "attachment_candidate_not_found",
            Self::AttachmentCandidateStale => "attachment_candidate_stale",
            Self::AttachmentCandidateNotVisible => "attachment_candidate_not_visible",
            Self::AttachmentCandidateProcessMismatch => "attachment_candidate_process_mismatch",
            Self::AttachmentCandidateBoundsUnavailable => "attachment_candidate_bounds_unavailable",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopSurfaceProbe {
    pub(crate) supported: bool,
    pub(crate) state: DesktopSurfaceState,
    pub(crate) progman_found: bool,
    pub(crate) worker_candidate_count: usize,
    pub(crate) desktop_view_host_found: bool,
    pub(crate) attachment_candidate_found: bool,
    pub(crate) shell_process_validated: bool,
    pub(crate) candidate_still_valid: bool,
    pub(crate) reason: Option<ProbeUnavailableReason>,
}

impl DesktopSurfaceProbe {
    #[cfg(test)]
    pub(crate) fn reason_code(&self) -> Option<&'static str> {
        self.reason.map(ProbeUnavailableReason::code)
    }
}

fn select_candidate_index(candidates: &[WorkerCandidate]) -> Option<usize> {
    candidates.iter().position(|candidate| {
        candidate.is_attachment_sibling
            && !candidate.hosts_desktop_view
            && candidate.is_valid
            && candidate.is_visible
            && candidate.belongs_to_shell_process
            && candidate.has_usable_bounds
    })
}

fn unavailable(
    topology: &ShellTopology,
    reason: ProbeUnavailableReason,
    attachment_candidate_found: bool,
    candidate_still_valid: bool,
) -> DesktopSurfaceProbe {
    DesktopSurfaceProbe {
        supported: false,
        state: DesktopSurfaceState::ProbeUnavailable,
        progman_found: topology.progman_found,
        worker_candidate_count: topology.workers.len(),
        desktop_view_host_found: topology.desktop_view_host_found,
        attachment_candidate_found,
        shell_process_validated: topology.shell_process_validated,
        candidate_still_valid,
        reason: Some(reason),
    }
}

pub(crate) fn classify_topology(topology: &ShellTopology) -> DesktopSurfaceProbe {
    if !topology.progman_found {
        return unavailable(
            topology,
            ProbeUnavailableReason::ProgmanNotFound,
            false,
            false,
        );
    }
    if !topology.shell_process_validated {
        return unavailable(
            topology,
            ProbeUnavailableReason::ShellProcessNotValidated,
            false,
            false,
        );
    }
    if !topology.desktop_view_host_found {
        return unavailable(
            topology,
            ProbeUnavailableReason::DesktopViewHostNotFound,
            false,
            false,
        );
    }
    if topology.workers.is_empty() {
        return unavailable(
            topology,
            ProbeUnavailableReason::WorkerwCandidateNotFound,
            false,
            false,
        );
    }

    let siblings = topology
        .workers
        .iter()
        .filter(|candidate| candidate.is_attachment_sibling && !candidate.hosts_desktop_view)
        .collect::<Vec<_>>();
    if siblings.is_empty() {
        return unavailable(
            topology,
            ProbeUnavailableReason::AttachmentCandidateNotFound,
            false,
            false,
        );
    }
    if let Some(index) = select_candidate_index(&topology.workers) {
        let candidate = &topology.workers[index];
        return DesktopSurfaceProbe {
            supported: true,
            state: DesktopSurfaceState::ProbeAvailable,
            progman_found: true,
            worker_candidate_count: topology.workers.len(),
            desktop_view_host_found: true,
            attachment_candidate_found: true,
            shell_process_validated: true,
            candidate_still_valid: candidate.is_valid,
            reason: None,
        };
    }

    let first = siblings[0];
    let reason = if !first.is_valid {
        ProbeUnavailableReason::AttachmentCandidateStale
    } else if !first.is_visible {
        ProbeUnavailableReason::AttachmentCandidateNotVisible
    } else if !first.belongs_to_shell_process {
        ProbeUnavailableReason::AttachmentCandidateProcessMismatch
    } else {
        ProbeUnavailableReason::AttachmentCandidateBoundsUnavailable
    };
    unavailable(topology, reason, true, first.is_valid)
}

#[cfg(windows)]
pub(crate) fn probe_current_shell() -> DesktopSurfaceProbe {
    classify_topology(&super::windows::read_shell_topology())
}

#[cfg(not(windows))]
pub(crate) fn probe_current_shell() -> DesktopSurfaceProbe {
    let topology = ShellTopology {
        progman_found: false,
        shell_process_validated: false,
        desktop_view_host_found: false,
        workers: Vec::new(),
    };
    unavailable(
        &topology,
        ProbeUnavailableReason::UnsupportedPlatform,
        false,
        false,
    )
}
