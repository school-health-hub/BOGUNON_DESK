//! Fixed-size callback metadata recorded before the callback returns.
use crate::{
    native_contract::owner_policy::Failure,
    own_coordinator::{Notice, NoticeKind},
    surface_event_types::Binding,
};
#[derive(Debug, Clone)]
pub struct Captured {
    pub(in crate::native_contract) binding: Binding,
    pub(in crate::native_contract) token: u32,
    pub(in crate::native_contract) sequence: u64,
    pub(in crate::native_contract) kind: NoticeKind,
}
pub struct Capture {
    entries: [Option<Captured>; 16],
    used: usize,
    sequence: u64,
    token: u32,
}
impl Capture {
    pub fn new() -> Self {
        Self {
            entries: std::array::from_fn(|_| None),
            used: 0,
            sequence: 0,
            token: 0,
        }
    }
    pub fn begin(&mut self, token: u32) -> Result<(), Failure> {
        if token == 0 || self.used != 0 || token == self.token {
            return Err(Failure::CallbackContext);
        }
        self.token = token;
        self.sequence = 0;
        Ok(())
    }
    pub fn record(&mut self, token: u32, notice: Notice) -> Result<(), Failure> {
        if token != self.token || token == 0 {
            return Err(Failure::CallbackIdentity);
        }
        let sequence = self
            .sequence
            .checked_add(1)
            .ok_or(Failure::CallbackOverflow)?;
        let slot = self
            .entries
            .get_mut(self.used)
            .ok_or(Failure::CallbackOverflow)?;
        *slot = Some(Captured {
            binding: notice.binding,
            token,
            sequence,
            kind: notice.kind,
        });
        self.sequence = sequence;
        self.used += 1;
        Ok(())
    }
    pub fn drain(&mut self, notices: Vec<Notice>) -> Result<Vec<Captured>, Failure> {
        if notices.len() != self.used {
            return Err(Failure::CallbackContext);
        }
        let mut result = Vec::new();
        result
            .try_reserve_exact(self.used)
            .map_err(|_| Failure::CallbackOverflow)?;
        for (slot, notice) in self.entries[..self.used].iter_mut().zip(notices) {
            let value = slot.take().ok_or(Failure::CallbackContext)?;
            if value.binding != notice.binding || value.kind != notice.kind {
                return Err(Failure::CallbackIdentity);
            }
            result.push(value);
        }
        self.used = 0;
        Ok(result)
    }
    /// Only after the owning Native class was released; token and sequence remain retired.
    pub(in crate::native_contract) fn discard_pending(&mut self) {
        for slot in &mut self.entries[..self.used] {
            *slot = None;
        }
        self.used = 0;
    }
    pub const fn empty(&self) -> bool {
        self.used == 0
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn notice() -> Notice {
        let (_, _, create) = crate::native_contract_tests::available();
        Notice {
            binding: create.binding().clone(),
            kind: NoticeKind::Created,
        }
    }
    #[test]
    fn sequence_is_recorded_before_delivery() {
        // Given callback metadata captured before any drain.
        let mut capture = Capture::new();
        let notice = notice();
        capture.begin(1).unwrap();
        capture.record(1, notice.clone()).unwrap();
        capture.record(1, notice.clone()).unwrap();
        // When one batch is drained / Then capture order survives delivery.
        let values = capture.drain(vec![notice.clone(), notice]).unwrap();
        assert!(capture.empty());
        assert!(values.iter().all(|value| value.token == 1));
        assert_eq!(
            values.iter().map(|v| v.sequence).collect::<Vec<_>>(),
            vec![1, 2]
        );
    }
    #[test]
    fn mismatched_token_is_rejected_at_capture() {
        // Given an owner token / When another token records / Then provenance fails.
        let mut capture = Capture::new();
        capture.begin(1).unwrap();
        assert!(matches!(
            capture.record(2, notice()),
            Err(Failure::CallbackIdentity)
        ));
    }
    #[test]
    fn capture_overflow_is_rejected() {
        // Given all sixteen notice slots occupied.
        let mut capture = Capture::new();
        let notice = notice();
        capture.begin(1).unwrap();
        for _ in 0..16 {
            capture.record(1, notice.clone()).unwrap();
        }
        // When the seventeenth callback arrives / Then no overwrite occurs.
        assert!(matches!(
            capture.record(1, notice),
            Err(Failure::CallbackOverflow)
        ));
    }
    #[test]
    fn undelivered_callbacks_prevent_new_owner() {
        // Given an undelivered old-owner callback.
        let mut capture = Capture::new();
        capture.begin(1).unwrap();
        capture.record(1, notice()).unwrap();
        // When a new owner attempts activation / Then stale capture cannot be rebranded.
        assert_eq!(capture.begin(2), Err(Failure::CallbackContext));
    }
    #[test]
    fn altered_notice_cannot_reuse_captured_metadata() {
        // Given exact callback metadata and an altered drain notice.
        let mut capture = Capture::new();
        let notice = notice();
        capture.begin(1).unwrap();
        capture.record(1, notice.clone()).unwrap();
        let altered = Notice {
            kind: NoticeKind::Destroyed,
            ..notice
        };
        // When correlating the batch / Then changed kind is rejected.
        assert!(matches!(
            capture.drain(vec![altered]),
            Err(Failure::CallbackIdentity)
        ));
    }
    #[test]
    fn failure_discard_clears_full_metadata_without_resetting_sequence() {
        // Given an overflowing old-owner capture queue.
        let mut capture = Capture::new();
        let notice = notice();
        capture.begin(1).unwrap();
        for _ in 0..16 {
            capture.record(1, notice.clone()).unwrap();
        }
        assert_eq!(
            capture.record(1, notice.clone()),
            Err(Failure::CallbackOverflow)
        );
        // When resource-verified failure cleanup discards metadata.
        capture.discard_pending();
        // Then no stale notice remains and the sequence cannot be reused.
        assert!(capture.empty());
        capture.record(1, notice.clone()).unwrap();
        assert_eq!(capture.drain(vec![notice]).unwrap()[0].sequence, 17);
    }
}
