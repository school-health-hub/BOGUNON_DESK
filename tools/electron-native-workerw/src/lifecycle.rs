use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Attempt {
    pub generation: u64,
    pub nonce: u64,
}

impl Attempt {
    pub const fn new(generation: u64, nonce: u64) -> Option<Self> {
        if generation == 0 || nonce == 0 {
            None
        } else {
            Some(Self { generation, nonce })
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Reserved,
    CreatingWindow,
    CreatingEnvironment,
    EnvironmentObserved,
    CreatingController,
    Quarantined,
    Verified,
    Active,
    Retiring,
    Retired,
    CleanupUnknown,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum TransitionError {
    #[error("callback belongs to a stale attempt")]
    StaleAttempt,
    #[error("invalid lifecycle transition")]
    InvalidTransition,
}

pub struct Lifecycle {
    attempt: Attempt,
    phase: Phase,
}

impl Lifecycle {
    pub const fn new(attempt: Attempt) -> Self {
        Self {
            attempt,
            phase: Phase::Reserved,
        }
    }

    pub const fn phase(&self) -> Phase {
        self.phase
    }

    pub fn transition(&mut self, attempt: Attempt, next: Phase) -> Result<(), TransitionError> {
        if attempt != self.attempt {
            return Err(TransitionError::StaleAttempt);
        }
        let allowed = matches!(
            (self.phase, next),
            (Phase::Reserved, Phase::CreatingWindow)
                | (Phase::CreatingWindow, Phase::CreatingEnvironment)
                | (Phase::CreatingEnvironment, Phase::EnvironmentObserved)
                | (Phase::EnvironmentObserved, Phase::CreatingController)
                | (Phase::CreatingController, Phase::Quarantined)
                | (Phase::Quarantined, Phase::Verified)
                | (Phase::Verified, Phase::Active)
                | (Phase::CreatingWindow, Phase::Retiring)
                | (Phase::CreatingEnvironment, Phase::Retiring)
                | (Phase::EnvironmentObserved, Phase::Retiring)
                | (Phase::CreatingController, Phase::Retiring)
                | (Phase::Quarantined, Phase::Retiring)
                | (Phase::Verified, Phase::Retiring)
                | (Phase::Active, Phase::Retiring)
                | (Phase::Retiring, Phase::Retired)
        );
        if !allowed {
            return Err(TransitionError::InvalidTransition);
        }
        self.phase = next;
        Ok(())
    }

    pub fn fail_unknown(&mut self, attempt: Attempt) -> Result<(), TransitionError> {
        if attempt != self.attempt {
            return Err(TransitionError::StaleAttempt);
        }
        self.phase = Phase::CleanupUnknown;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follows_the_only_success_path_and_rejects_reactivation() {
        let attempt = Attempt::new(1, 9).unwrap();
        let mut lifecycle = Lifecycle::new(attempt);
        for phase in [
            Phase::CreatingWindow,
            Phase::CreatingEnvironment,
            Phase::EnvironmentObserved,
            Phase::CreatingController,
            Phase::Quarantined,
            Phase::Verified,
            Phase::Active,
            Phase::Retiring,
            Phase::Retired,
        ] {
            assert_eq!(lifecycle.transition(attempt, phase), Ok(()));
        }
        assert_eq!(
            lifecycle.transition(attempt, Phase::Active),
            Err(TransitionError::InvalidTransition)
        );
    }

    #[test]
    fn stale_callback_cannot_change_state() {
        let attempt = Attempt::new(3, 4).unwrap();
        let stale = Attempt::new(2, 4).unwrap();
        let mut lifecycle = Lifecycle::new(attempt);
        assert_eq!(
            lifecycle.transition(stale, Phase::CreatingWindow),
            Err(TransitionError::StaleAttempt)
        );
        assert_eq!(lifecycle.phase(), Phase::Reserved);
    }
}
