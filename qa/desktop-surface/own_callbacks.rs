use crate::{
    own_coordinator::{Notice, NoticeKind},
    own_result::Error,
    surface_event_types::Binding,
};

const CAPACITY: usize = 16;

pub struct Entry {
    pub handle: usize,
    pub token: u32,
    pub binding: Binding,
}

/// Bounded bookkeeping; callback writes neither allocate nor invoke native APIs.
pub struct Ledger {
    pub live: Option<Entry>,
    pending: Option<(u32, Binding)>,
    retired: [Option<usize>; 2],
    queue: [Option<Notice>; CAPACITY],
    used: usize,
    attempts: u32,
}
impl Ledger {
    pub fn new() -> Self {
        Self {
            live: None,
            pending: None,
            retired: [None; 2],
            queue: std::array::from_fn(|_| None),
            used: 0,
            attempts: 0,
        }
    }
    pub fn reserve(&mut self, binding: &Binding) -> Result<u32, Error> {
        if self.live.is_some() || self.pending.is_some() || self.attempts >= 2 {
            return Err(Error::Callback);
        }
        self.attempts += 1;
        self.pending = Some((self.attempts, binding.clone()));
        Ok(self.attempts)
    }
    pub fn register(&mut self, handle: usize, token: u32) -> Result<(), Error> {
        if handle == 0 || self.live.is_some() || self.retired.contains(&Some(handle)) {
            return Err(Error::Callback);
        }
        let Some((expected, binding)) = self.pending.take() else {
            return Err(Error::Callback);
        };
        if token != expected {
            self.pending = Some((expected, binding));
            return Err(Error::Callback);
        }
        self.live = Some(Entry {
            handle,
            token,
            binding,
        });
        Ok(())
    }
    pub fn cancel_pending(&mut self) {
        self.pending = None;
    }
    pub fn matches(&self, handle: usize, token: u32) -> bool {
        self.live
            .as_ref()
            .is_some_and(|entry| entry.handle == handle && entry.token == token)
    }
    pub fn bind_disposal(&mut self, binding: &Binding) -> Result<(), Error> {
        let entry = self.live.as_mut().ok_or(Error::Cleanup)?;
        if entry.binding.instance() != binding.instance() {
            return Err(Error::Callback);
        }
        entry.binding = binding.clone();
        Ok(())
    }
    pub fn notice(&mut self, handle: usize, kind: NoticeKind) -> Result<(), Error> {
        let entry = self
            .live
            .as_ref()
            .filter(|entry| entry.handle == handle)
            .ok_or(Error::Callback)?;
        let binding = entry.binding.clone();
        if matches!(kind, NoticeKind::Destroyed) {
            let slot = self
                .retired
                .iter_mut()
                .find(|slot| slot.is_none())
                .ok_or(Error::Callback)?;
            *slot = Some(handle);
            self.live = None;
        }
        let slot = self.queue.get_mut(self.used).ok_or(Error::Callback)?;
        *slot = Some(Notice { binding, kind });
        self.used += 1;
        Ok(())
    }
    pub fn drain(&mut self, output: &mut Vec<Notice>) -> Result<(), Error> {
        if output.capacity().saturating_sub(output.len()) < self.used {
            return Err(Error::Callback);
        }
        for slot in &mut self.queue[..self.used] {
            if let Some(notice) = slot.take() {
                output.push(notice);
            }
        }
        self.used = 0;
        Ok(())
    }
}
