use super::{Generation, Lifetime};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ApprovedProjection {
    revision: u64,
}
impl ApprovedProjection {
    pub(crate) const fn revision(self) -> u64 {
        self.revision
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ProjectionError {
    Unavailable,
    StalePublisher,
    StaleRevision,
    PublisherClosed,
}
impl std::fmt::Display for ProjectionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Unavailable => "Main projection unavailable",
            Self::StalePublisher => "Main publisher lease revoked",
            Self::StaleRevision => "Main projection revision must increase",
            Self::PublisherClosed => "Main publisher epoch exhausted",
        })
    }
}
impl std::error::Error for ProjectionError {}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ProjectionRevocation {
    Logout,
    PermissionChanged,
    Navigation,
    Retired,
}
#[derive(Clone)]
pub(crate) struct PublisherLease {
    generation: Generation,
    epoch: u64,
}
pub(super) struct ProjectionState {
    epoch: Option<u64>,
    watermark: Option<u64>,
    publication: Option<ApprovedProjection>,
}
impl ProjectionState {
    pub(super) const fn new() -> Self {
        Self {
            epoch: Some(0),
            watermark: None,
            publication: None,
        }
    }
}
impl Lifetime {
    pub(crate) fn publisher_lease(&self) -> Result<PublisherLease, ProjectionError> {
        let generation = self.snapshot().ok_or(ProjectionError::Unavailable)?;
        let epoch = self
            .projection
            .epoch
            .ok_or(ProjectionError::PublisherClosed)?;
        Ok(PublisherLease { generation, epoch })
    }
    pub(crate) fn publish_projection(
        &mut self,
        lease: &PublisherLease,
        revision: u64,
    ) -> Result<ApprovedProjection, ProjectionError> {
        let epoch = self
            .projection
            .epoch
            .ok_or(ProjectionError::PublisherClosed)?;
        if !self.current(&lease.generation) || lease.epoch != epoch {
            return Err(ProjectionError::StalePublisher);
        }
        if self
            .projection
            .watermark
            .is_some_and(|previous| revision <= previous)
        {
            return Err(ProjectionError::StaleRevision);
        }
        let approved = ApprovedProjection { revision };
        self.projection.watermark = Some(revision);
        self.projection.publication = Some(approved);
        Ok(approved)
    }
    pub(crate) fn projection(&self) -> Result<ApprovedProjection, ProjectionError> {
        if !self.admitted() {
            return Err(ProjectionError::Unavailable);
        }
        self.projection
            .publication
            .ok_or(ProjectionError::Unavailable)
    }
    pub(crate) fn revoke_projection(&mut self, _reason: ProjectionRevocation) {
        self.projection.publication = None;
        self.projection.epoch = self.projection.epoch.and_then(|epoch| epoch.checked_add(1));
    }
}

#[cfg(test)]
#[path = "main_projection_tests.rs"]
mod tests;
