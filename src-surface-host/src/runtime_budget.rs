use serde::{Deserialize, Serialize};
use std::{
    cell::Cell,
    path::Path,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

pub const RUN_MS: u64 = 240_000;
pub const PHASE_ONE_MS: u64 = 40_000;
pub const PHASE_TWO_MS: u64 = 160_000;
pub const FINAL_RESERVE_MS: u64 = 40_000;
pub const CASE_MS: u64 = 20_000;
pub const PARENT_EVIDENCE_MS: u64 = 2_000;
pub const CHILD_CLEANUP_MS: u64 = 6_000;
pub const CHILD_EVIDENCE_MS: u64 = 2_000;
const _: () = assert!(PHASE_ONE_MS + PHASE_TWO_MS + FINAL_RESERVE_MS <= RUN_MS);
const _: () = assert!(8 * CASE_MS <= PHASE_TWO_MS);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TerminalReason {
    Cancelled,
    Timeout,
    HarnessFailure,
}

#[derive(Debug, thiserror::Error)]
#[error("runtime budget unavailable or exhausted")]
pub struct BudgetError;

pub fn now_ms() -> Result<u64, BudgetError> {
    u64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| BudgetError)?
            .as_millis(),
    )
    .map_err(|_| BudgetError)
}

/// Both wall-clock and monotonic bounds apply; clock rollback cannot extend a lease.
pub struct Deadline {
    epoch: u64,
    monotonic: Instant,
}
impl Deadline {
    pub fn at(epoch: u64, max_ms: u64) -> Result<Self, BudgetError> {
        let remaining = epoch.checked_sub(now_ms()?).ok_or(BudgetError)?;
        if remaining == 0 || remaining > max_ms {
            return Err(BudgetError);
        }
        Ok(Self {
            epoch,
            monotonic: Instant::now() + Duration::from_millis(remaining),
        })
    }
    pub fn remaining(&self) -> Duration {
        let wall = now_ms()
            .ok()
            .and_then(|now| self.epoch.checked_sub(now))
            .unwrap_or(0);
        self.monotonic
            .saturating_duration_since(Instant::now())
            .min(Duration::from_millis(wall))
    }
    pub const fn epoch(&self) -> u64 {
        self.epoch
    }
    pub fn expired(&self) -> bool {
        self.remaining().is_zero()
    }
}

pub struct RuntimeControl<'a> {
    pub run: Deadline,
    pub work: Deadline,
    pub cleanup: Deadline,
    pub evidence: Deadline,
    pub cancellation: &'a Path,
    terminal: Cell<Option<TerminalReason>>,
}
impl<'a> RuntimeControl<'a> {
    pub fn new(
        run_end: u64,
        case_end: u64,
        cleanup_ms: u64,
        evidence_ms: u64,
        cancellation: &'a Path,
    ) -> Result<Self, BudgetError> {
        if case_end > run_end {
            return Err(BudgetError);
        }
        let cleanup_end = case_end.checked_sub(evidence_ms).ok_or(BudgetError)?;
        let work_end = cleanup_end.checked_sub(cleanup_ms).ok_or(BudgetError)?;
        Ok(Self {
            run: Deadline::at(run_end, RUN_MS)?,
            work: Deadline::at(work_end, RUN_MS)?,
            cleanup: Deadline::at(cleanup_end, RUN_MS)?,
            evidence: Deadline::at(case_end, RUN_MS)?,
            cancellation,
            terminal: Cell::new(None),
        })
    }
    pub fn reason(&self) -> Option<TerminalReason> {
        self.terminal.get()
    }
    pub fn stop(&self, reason: TerminalReason) {
        if self.reason().is_none() {
            self.terminal.set(Some(reason));
        }
    }
    pub fn observe_cancellation(&self) {
        if self.cancellation.try_exists().unwrap_or(true) {
            self.stop(TerminalReason::Cancelled);
        }
    }
    pub fn admission(&self) -> Result<(), TerminalReason> {
        self.observe_cancellation();
        if self.work.expired() || self.run.expired() {
            self.stop(TerminalReason::Timeout);
        }
        self.reason().map_or(Ok(()), Err)
    }
}

/// Polls only inside a finite budget; no blocking wait and no process kill.
pub fn observe<T>(
    mut poll: impl FnMut() -> Result<Option<T>, ()>,
    mut remaining: impl FnMut() -> Duration,
    mut pause: impl FnMut(Duration),
) -> Result<T, TerminalReason> {
    loop {
        let left = remaining();
        if left.is_zero() {
            return Err(TerminalReason::Timeout);
        }
        if let Some(value) = poll().map_err(|()| TerminalReason::HarnessFailure)? {
            return Ok(value);
        }
        pause(remaining().min(left).min(Duration::from_millis(20)));
    }
}

/// Finite message batch shared by the actual Win32 adapter and pure flood tests.
pub fn pump_messages<E>(
    limit: usize,
    mut admitted: impl FnMut() -> bool,
    mut dispatch_one: impl FnMut() -> Result<bool, E>,
) -> Result<usize, E> {
    let mut count = 0;
    while count < limit && admitted() {
        if !dispatch_one()? {
            break;
        }
        count += 1;
    }
    Ok(count)
}

pub const fn preserve_terminal_reason(
    recorded: Option<TerminalReason>,
    local: Option<TerminalReason>,
) -> TerminalReason {
    match (recorded, local) {
        (Some(reason), _) | (None, Some(reason)) => reason,
        (None, None) => TerminalReason::HarnessFailure,
    }
}
