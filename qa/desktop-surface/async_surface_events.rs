use super::*;

impl AsyncSurface {
    pub(super) fn apply(&mut self, event: Event) -> Result<SyntheticDecision, Error> {
        match event {
            Event::CreateRequested => self.begin(false),
            Event::ReplacementRequested => self.begin(true),
            Event::CreateFailed(binding) => {
                self.exact(&binding)?;
                if !matches!(self.state(), State::Creating(_)) {
                    return Err(Error::Order);
                }

                self.complete_create(&binding, Completion::Failed)
            }
            Event::CreateCompleted(binding) => {
                self.exact(&binding)?;
                if !matches!(self.state(), State::Creating(_)) {
                    return Err(Error::Order);
                }
                self.complete_create(&binding, Completion::Succeeded)
            }
            Event::CloseRequested => self.close(),
            Event::CloseCompleted(binding) => {
                self.exact(&binding)?;
                if !matches!(self.state(), State::Disposing(_)) {
                    return Err(Error::Order);
                }
                self.boundary
                    .disposed(&binding, Completion::Succeeded)
                    .map_err(Error::Boundary)?;
                Ok(SyntheticDecision::Accepted)
            }
            Event::SurfaceLost(binding) => {
                self.exact(&binding)?;
                match self.state() {
                    State::Creating(_) | State::Available(_) => {
                        self.boundary.lost(&binding).map_err(Error::Boundary)?
                    }
                    State::Disposing(_) => {
                        self.closed = true;
                        return Ok(SyntheticDecision::Accepted);
                    }
                    State::Absent | State::Lost(_) | State::Failed(..) | State::Unsupported => {
                        return Err(Error::Order)
                    }
                }
                self.closed = true;
                self.cleanup = Cleanup::Unknown;
                Ok(SyntheticDecision::Accepted)
            }
            Event::CallbackArrived(callback) => {
                self.exact(&callback.binding)?;
                if self.closed {
                    return Err(Error::Closed);
                }
                let request = self.boundary.route(callback).map_err(Error::Boundary)?;
                self.process(&request).map(SyntheticDecision::Command)
            }
            Event::CleanupStarted(binding) => {
                self.exact(&binding)?;
                if !self.terminal()
                    || matches!(
                        self.cleanup,
                        Cleanup::Started | Cleanup::Confirmed | Cleanup::Failed
                    )
                {
                    return Err(Error::Order);
                }
                self.cleanup = Cleanup::Started;
                Ok(SyntheticDecision::Accepted)
            }
            Event::CleanupConfirmed(binding) => {
                self.exact(&binding)?;
                if self.cleanup != Cleanup::Started || !self.terminal() {
                    return Err(Error::Order);
                }
                self.boundary
                    .confirm_cleanup(&binding)
                    .map_err(Error::Boundary)?;
                self.cleanup = Cleanup::Confirmed;
                self.overflow = false;
                Ok(SyntheticDecision::Accepted)
            }
            Event::CleanupFailed(binding) => {
                self.exact(&binding)?;
                if self.cleanup != Cleanup::Started {
                    return Err(Error::Order);
                }
                self.cleanup = Cleanup::Failed;
                self.boundary.protocol_fault();
                Ok(SyntheticDecision::Accepted)
            }
        }
    }
}
