use std::time::{Duration, Instant};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Failure {
    Timeout,
    NavigationFailed,
    UnexpectedOrigin,
    IdentityMismatch,
    Duplicate,
    SubscribeFailed,
    UnsubscribeFailed,
    UrlUnavailable,
    ResourceMissing,
    NavigationChanged,
}

#[derive(Clone, Copy)]
enum State {
    Pending(Option<std::num::NonZeroU64>),
    Completed,
    Installing,
    Active,
    Failed(Failure),
}

pub(crate) struct Gate {
    state: State,
    began: Instant,
    budget: Duration,
}

impl Gate {
    pub(crate) const fn new(now: Instant, budget: Duration) -> Self {
        Self {
            state: State::Pending(None),
            began: now,
            budget,
        }
    }

    pub(crate) fn started(&mut self, id: u64, now: Instant) -> Result<(), Failure> {
        self.check_time(now)?;
        match self.state {
            State::Pending(previous) => {
                let Some(id) = std::num::NonZeroU64::new(id) else {
                    return self.reject(Failure::NavigationChanged);
                };
                if previous.is_some_and(|previous| previous != id) {
                    return self.reject(Failure::NavigationChanged);
                }
                self.state = State::Pending(Some(id));
                Ok(())
            }
            State::Failed(failure) => Err(failure),
            State::Completed | State::Installing | State::Active => self.reject(Failure::Duplicate),
        }
    }

    pub(crate) fn completed(
        &mut self,
        id: u64,
        success: bool,
        now: Instant,
    ) -> Result<(), Failure> {
        self.check_time(now)?;
        match self.state {
            State::Pending(previous) => {
                if previous.is_none() || previous != std::num::NonZeroU64::new(id) {
                    return self.reject(Failure::NavigationChanged);
                }
                if !success {
                    return self.reject(Failure::NavigationFailed);
                }
                self.state = State::Completed;
                Ok(())
            }
            State::Failed(failure) => Err(failure),
            State::Completed | State::Installing | State::Active => self.reject(Failure::Duplicate),
        }
    }

    pub(crate) fn claim(
        &mut self,
        now: Instant,
        identity_ok: bool,
        origin_ok: bool,
    ) -> Result<(), Failure> {
        self.check_time(now)?;
        match self.state {
            State::Completed => {
                if !identity_ok {
                    return self.reject(Failure::IdentityMismatch);
                }
                if !origin_ok {
                    return self.reject(Failure::UnexpectedOrigin);
                }
                self.state = State::Installing;
                Ok(())
            }
            State::Failed(failure) => Err(failure),
            State::Pending(_) | State::Installing | State::Active => {
                self.reject(Failure::Duplicate)
            }
        }
    }

    pub(crate) fn finish(&mut self) -> Result<(), Failure> {
        match self.state {
            State::Installing => {
                self.state = State::Active;
                Ok(())
            }
            State::Failed(failure) => Err(failure),
            State::Pending(_) | State::Completed | State::Active => self.reject(Failure::Duplicate),
        }
    }

    pub(crate) const fn waiting(&self) -> bool {
        match self.state {
            State::Pending(_) | State::Completed => true,
            State::Installing | State::Active | State::Failed(_) => false,
        }
    }

    pub(crate) fn expire(&mut self, now: Instant) -> bool {
        if self.waiting() && self.remaining(now).is_zero() {
            self.fail(Failure::Timeout)
        } else {
            false
        }
    }

    pub(crate) const fn fail(&mut self, failure: Failure) -> bool {
        match self.state {
            State::Failed(_) => false,
            State::Pending(_) | State::Completed | State::Installing | State::Active => {
                self.state = State::Failed(failure);
                true
            }
        }
    }

    pub(crate) fn remaining(&self, now: Instant) -> Duration {
        self.budget
            .saturating_sub(now.saturating_duration_since(self.began))
    }

    pub(crate) const fn can_start_host(&self) -> bool {
        match self.state {
            State::Active => true,
            State::Pending(_) | State::Completed | State::Installing | State::Failed(_) => false,
        }
    }

    fn check_time(&mut self, now: Instant) -> Result<(), Failure> {
        self.expire(now);
        match self.state {
            State::Failed(failure) => Err(failure),
            State::Pending(_) | State::Completed | State::Installing | State::Active => Ok(()),
        }
    }

    fn reject(&mut self, failure: Failure) -> Result<(), Failure> {
        self.fail(failure);
        Err(failure)
    }
}

#[cfg(test)]
#[path = "qa_main_navigation_state_tests.rs"]
mod tests;
