use super::BrokerError;

/// The initial Surface schema deliberately contains no business data.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Projection {
    revision: u64,
}

impl Projection {
    pub(crate) const fn revision(self) -> u64 {
        self.revision
    }

    pub(crate) const fn schema_fields() -> &'static [&'static str] {
        &["revision"]
    }
}

pub(super) struct Publication {
    projection: Option<Projection>,
    epoch: u64,
    highest_revision: u64,
}

impl Publication {
    pub(super) const fn new() -> Self {
        Self {
            projection: None,
            epoch: 0,
            highest_revision: 0,
        }
    }

    pub(super) fn publish(&mut self, revision: u64) -> Result<(), BrokerError> {
        if revision <= self.highest_revision {
            return Err(BrokerError::StaleRevision);
        }
        self.advance_epoch()?;
        self.highest_revision = revision;
        self.projection = Some(Projection { revision });
        Ok(())
    }

    pub(super) fn invalidate(&mut self) -> Result<(), BrokerError> {
        self.projection = None;
        self.advance_epoch()
    }

    pub(super) const fn snapshot(&self) -> Option<(Projection, u64)> {
        match self.projection {
            Some(projection) => Some((projection, self.epoch)),
            None => None,
        }
    }

    pub(super) const fn is_current(&self, projection: Projection, epoch: u64) -> bool {
        self.epoch == epoch
            && matches!(self.projection, Some(value) if value.revision == projection.revision)
    }

    fn advance_epoch(&mut self) -> Result<(), BrokerError> {
        self.epoch = self
            .epoch
            .checked_add(1)
            .ok_or(BrokerError::PublicationOverflow)?;
        Ok(())
    }

    #[cfg(test)]
    pub(super) fn force_epoch(&mut self, epoch: u64) {
        self.epoch = epoch;
    }
}
