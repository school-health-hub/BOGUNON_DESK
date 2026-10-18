use super::*;
#[derive(Debug)]
pub struct Report<P> {
    pub original: Option<Error>,
    pub admission: Option<cleanup::Error>,
    pub observation: cleanup::Observation<P>,
    pub cleanup: cleanup::Status,
}
impl<B: Backend> Host<B> {
    pub const fn original_failure(&self) -> Option<Error> {
        self.original
    }

    /// Terminal resource cleanup; normal fault and stop admission remains closed.
    pub fn failure_cleanup(&mut self) -> Result<super::Report<B::Provenance>, cleanup::Error> {
        self.completion = None;
        if self.creator != thread::current().id() {
            return Err(cleanup::Error::Thread);
        }
        if self.entered {
            return Err(cleanup::Error::Reentry);
        }
        if self.cleanup_attempted {
            return Err(cleanup::Error::Duplicate);
        }
        self.cleanup_attempted = true;
        self.stopped = true;
        self.adapter.native_unknown();
        self.entered = true;
        let capability = self.backend.cleanup_capability();
        let observation = match capability {
            Ok(capability) => self.backend.cleanup_failure(capability),
            Err(error) => {
                self.entered = false;
                let observation = cleanup::Observation::unknown();
                return Ok(Report {
                    original: self.original,
                    admission: Some(error),
                    cleanup: observation.status(),
                    observation,
                });
            }
        };
        self.entered = false;
        let status = observation.status();
        Ok(Report {
            original: self.original,
            admission: None,
            observation,
            cleanup: status,
        })
    }
}
