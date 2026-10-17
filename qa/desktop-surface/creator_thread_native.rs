//! Source-only backend. No target invokes it and no Win32 message is dispatched here.
use super::{sealed, Backend, Envelope, Error, Source};
use crate::native_contract::{
    native_owner::Owner,
    ownership_receipt::{Native, OwnerReceipt},
    Kind, Outcome, Request, Response,
};
use std::{
    marker::PhantomData,
    rc::Rc,
    thread::{self, ThreadId},
};
#[path = "creator_thread_native_cleanup.rs"]
mod failure;
pub struct NativeBackend {
    owner: Option<Owner>,
    receipt: Option<OwnerReceipt<Native>>,
    released: bool,
    stopped: bool,
    faulted: bool,
    cleanup_issued: bool,
    cleanup_lease: Rc<()>,
    creator: ThreadId,
    _thread_bound: PhantomData<Rc<()>>,
}
impl NativeBackend {
    pub(super) fn new() -> Self {
        Self {
            owner: None,
            receipt: None,
            released: false,
            stopped: false,
            faulted: false,
            cleanup_issued: false,
            cleanup_lease: Rc::new(()),
            creator: thread::current().id(),
            _thread_bound: PhantomData,
        }
    }
    fn perform(&mut self, request: &Request) -> Result<Outcome<Native>, Error> {
        if self.stopped || self.faulted || self.cleanup_issued {
            return Err(Error::Unknown);
        }
        match request.kind() {
            Kind::CreateOwnSurface => {
                if self.owner.is_some() && !self.released {
                    return Err(Error::Protocol);
                }
                // A previous owner is replaced only after its real finalization proof was issued.
                self.owner = Some(Owner::new().map_err(|_| Error::Unknown)?);
                self.released = false;
                let receipt = self
                    .owner
                    .as_mut()
                    .ok_or(Error::Unknown)?
                    .create(request)
                    .map_err(|_| Error::Unknown)?;
                self.receipt = Some(receipt.clone());
                Ok(Outcome::CreateSucceeded(receipt))
            }
            Kind::BeginCloseOwnSurface => {
                self.owner
                    .as_mut()
                    .ok_or(Error::Unknown)?
                    .begin_close(request)
                    .map_err(|_| Error::Unknown)?;
                // CloseCompleted is emitted only after the captured WM_NCDESTROY notice is validated.
                Ok(Outcome::CloseStarted)
            }
            Kind::VerifyOwnSurfaceCleanup => {
                let proof = self
                    .owner
                    .as_mut()
                    .ok_or(Error::Unknown)?
                    .finalize(request)
                    .map_err(|_| Error::Unknown)?;
                self.released = true;
                Ok(Outcome::CleanupVerified(proof))
            }
        }
    }
}
impl sealed::Sealed for NativeBackend {}
impl Backend for NativeBackend {
    type Provenance = Native;
    type CleanupCapability = failure::Capability;
    fn cleanup_capability(
        &mut self,
    ) -> Result<Self::CleanupCapability, crate::native_contract::failure_cleanup::Error> {
        self.issue_failure_cleanup()
    }
    fn cleanup_failure(
        &mut self,
        capability: Self::CleanupCapability,
    ) -> crate::native_contract::failure_cleanup::Observation<Native> {
        self.run_failure_cleanup(capability)
    }
    fn dispatch(&mut self, request: &Request) -> Response<Native> {
        let outcome = match self.perform(request) {
            Ok(outcome) => outcome,
            Err(_) => {
                self.faulted = true;
                Outcome::NativeOutcomeUnknown
            }
        };
        Response {
            request: request.clone(),
            outcome,
        }
    }
    fn drain(&mut self) -> Result<Vec<Envelope<Native>>, Error> {
        if self.stopped || self.faulted || self.cleanup_issued {
            return Err(Error::Unknown);
        }
        if self.released {
            self.owner
                .as_ref()
                .ok_or(Error::Unknown)?
                .released_quiet()
                .map_err(|_| Error::Callback)?;
            return Ok(Vec::new());
        }
        if self.owner.is_none() && self.receipt.is_none() {
            return Ok(Vec::new());
        }
        let receipt = self.receipt.as_ref().ok_or(Error::Unknown)?;
        let notices = self
            .owner
            .as_mut()
            .ok_or(Error::Unknown)?
            .drain_captured()
            .map_err(|_| Error::Callback)?;
        let mut envelopes = Vec::new();
        envelopes
            .try_reserve_exact(notices.len())
            .map_err(|_| Error::Overflow)?;
        for notice in notices {
            if receipt.creation().token.value() != notice.token
                || receipt.creation().binding.instance() != notice.binding.instance()
                || receipt.creation().binding.operation().generation()
                    != notice.binding.operation().generation()
            {
                self.faulted = true;
                return Err(Error::Callback);
            }
            envelopes.push(Envelope {
                owner: receipt.clone(),
                binding: notice.binding,
                sequence: notice.sequence,
                source: Source::OwnWndProc,
                kind: notice.kind,
            });
        }
        Ok(envelopes)
    }
    fn stop(&mut self) -> Result<(), Error> {
        if self.stopped {
            self.faulted = true;
            return Err(Error::PumpStop);
        }
        // Logical notice delivery detachment only. Neither DestroyWindow nor proof issuance occurs.
        self.stopped = true;
        Ok(())
    }
}

impl super::Host<NativeBackend> {
    /// Constructs only bookkeeping; this source-only host has no approved execution target.
    pub(in crate::native_contract) fn native(
        main: crate::main_boundary_state::Authoritative,
    ) -> Self {
        Self::new(main, NativeBackend::new())
    }
}
