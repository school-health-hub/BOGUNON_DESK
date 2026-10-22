use super::{AttemptBinding, IdentityToken};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ResourceKind {
    NativeHost,
    Window,
    WebView,
    EventToken,
    ComReference,
    BackendRegistration,
}

impl ResourceKind {
    pub(crate) const ALL: [Self; 6] = [
        Self::NativeHost,
        Self::Window,
        Self::WebView,
        Self::EventToken,
        Self::ComReference,
        Self::BackendRegistration,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LedgerState {
    Reserved,
    Creating,
    Quarantined,
    Verified,
    Active,
    Retiring,
    Retired,
    CleanupUnknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LedgerError {
    StaleAttempt,
    InvalidTransition,
    ResourceAlreadyRecorded,
    ResourceNotOwned,
    WrongResource,
    DuplicateCleanup,
    UnresolvedResource,
}

enum Slot {
    NotAttempted,
    Owned(IdentityToken),
    AttemptedUnresolved,
    Released(IdentityToken),
}

struct Slots {
    native_host: Slot,
    window: Slot,
    webview: Slot,
    event_token: Slot,
    com_reference: Slot,
    backend_registration: Slot,
}

impl Slots {
    fn new() -> Self {
        Self {
            native_host: Slot::NotAttempted,
            window: Slot::NotAttempted,
            webview: Slot::NotAttempted,
            event_token: Slot::NotAttempted,
            com_reference: Slot::NotAttempted,
            backend_registration: Slot::NotAttempted,
        }
    }

    fn get(&self, kind: ResourceKind) -> &Slot {
        match kind {
            ResourceKind::NativeHost => &self.native_host,
            ResourceKind::Window => &self.window,
            ResourceKind::WebView => &self.webview,
            ResourceKind::EventToken => &self.event_token,
            ResourceKind::ComReference => &self.com_reference,
            ResourceKind::BackendRegistration => &self.backend_registration,
        }
    }

    fn get_mut(&mut self, kind: ResourceKind) -> &mut Slot {
        match kind {
            ResourceKind::NativeHost => &mut self.native_host,
            ResourceKind::Window => &mut self.window,
            ResourceKind::WebView => &mut self.webview,
            ResourceKind::EventToken => &mut self.event_token,
            ResourceKind::ComReference => &mut self.com_reference,
            ResourceKind::BackendRegistration => &mut self.backend_registration,
        }
    }
}

pub(crate) struct Ledger {
    binding: AttemptBinding,
    state: LedgerState,
    admission_open: bool,
    slots: Slots,
}

impl Ledger {
    pub(crate) fn new(binding: AttemptBinding) -> Self {
        Self {
            binding,
            state: LedgerState::Reserved,
            admission_open: false,
            slots: Slots::new(),
        }
    }

    pub(crate) const fn state(&self) -> LedgerState {
        self.state
    }

    pub(crate) const fn admission_open(&self) -> bool {
        self.admission_open
    }

    pub(crate) fn binding_matches(&self, binding: &AttemptBinding) -> bool {
        self.binding.matches(binding)
    }

    pub(crate) fn begin_creation(&mut self, binding: &AttemptBinding) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        self.transition(LedgerState::Reserved, LedgerState::Creating)?;
        self.admission_open = true;
        Ok(())
    }

    pub(crate) fn acquire(
        &mut self,
        binding: &AttemptBinding,
        kind: ResourceKind,
        identity: IdentityToken,
    ) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        if !matches!(
            self.state,
            LedgerState::Creating | LedgerState::Quarantined | LedgerState::Verified
        ) {
            return Err(LedgerError::InvalidTransition);
        }
        let slot = self.slots.get_mut(kind);
        if !matches!(slot, Slot::NotAttempted) {
            return Err(LedgerError::ResourceAlreadyRecorded);
        }
        *slot = Slot::Owned(identity);
        Ok(())
    }

    pub(crate) fn mark_unresolved(
        &mut self,
        binding: &AttemptBinding,
        kind: ResourceKind,
    ) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        let slot = self.slots.get_mut(kind);
        if !matches!(slot, Slot::NotAttempted) {
            return Err(LedgerError::ResourceAlreadyRecorded);
        }
        *slot = Slot::AttemptedUnresolved;
        self.state = LedgerState::CleanupUnknown;
        self.admission_open = false;
        Ok(())
    }

    pub(crate) fn quarantined(&mut self, binding: &AttemptBinding) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        self.transition(LedgerState::Creating, LedgerState::Quarantined)
    }

    pub(crate) fn verified(&mut self, binding: &AttemptBinding) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        self.transition(LedgerState::Quarantined, LedgerState::Verified)
    }

    pub(crate) fn activate(&mut self, binding: &AttemptBinding) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        self.transition(LedgerState::Verified, LedgerState::Active)
    }

    pub(crate) fn begin_retirement(&mut self, binding: &AttemptBinding) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        match self.state {
            LedgerState::Creating
            | LedgerState::Quarantined
            | LedgerState::Verified
            | LedgerState::Active => {
                self.state = LedgerState::Retiring;
                self.admission_open = false;
                Ok(())
            }
            LedgerState::Reserved
            | LedgerState::Retiring
            | LedgerState::Retired
            | LedgerState::CleanupUnknown => Err(LedgerError::InvalidTransition),
        }
    }

    pub(crate) fn release(
        &mut self,
        binding: &AttemptBinding,
        kind: ResourceKind,
        identity: &IdentityToken,
    ) -> Result<(), LedgerError> {
        self.require_binding(binding)?;
        if !matches!(
            self.state,
            LedgerState::Retiring | LedgerState::CleanupUnknown
        ) {
            return Err(LedgerError::InvalidTransition);
        }
        let slot = self.slots.get_mut(kind);
        match slot {
            Slot::Owned(owned) if owned.matches(identity) => {
                *slot = Slot::Released(identity.clone());
                Ok(())
            }
            Slot::Owned(_) => Err(LedgerError::WrongResource),
            Slot::Released(released) if released.matches(identity) => {
                Err(LedgerError::DuplicateCleanup)
            }
            Slot::Released(_) => Err(LedgerError::WrongResource),
            Slot::AttemptedUnresolved => Err(LedgerError::UnresolvedResource),
            Slot::NotAttempted => Err(LedgerError::ResourceNotOwned),
        }
    }

    pub(super) fn all_resources_released(&self) -> bool {
        ResourceKind::ALL
            .iter()
            .all(|kind| matches!(self.slots.get(*kind), Slot::Released(_)))
    }

    pub(super) fn mark_retired(&mut self) {
        self.state = LedgerState::Retired;
    }

    fn require_binding(&self, binding: &AttemptBinding) -> Result<(), LedgerError> {
        if self.binding.matches(binding) {
            Ok(())
        } else {
            Err(LedgerError::StaleAttempt)
        }
    }

    fn transition(&mut self, expected: LedgerState, next: LedgerState) -> Result<(), LedgerError> {
        if self.state != expected {
            return Err(LedgerError::InvalidTransition);
        }
        self.state = next;
        Ok(())
    }
}
