use super::{
    approval::{self, Binding, Descriptor, Error, Manifest, OperatorReview},
    claim::Claim,
    OPT_IN_VALUE,
};
use sha2::Digest;
use std::cell::Cell;
use std::{path::Path, rc::Rc};

/// Loaded bytes and actual locations are supplied by the separate Integrated entrypoint.
/// This contract neither authenticates an operator nor invokes Native code.
pub struct Input<'a> {
    pub executable: &'a [u8],
    pub manifest: &'a [u8],
    pub descriptor: &'a [u8],
    pub approval_record: &'a [u8],
    pub executable_path: &'a Path,
    pub manifest_path: &'a Path,
    pub descriptor_path: &'a Path,
    pub approval_path: &'a Path,
    pub source_head: &'a str,
    pub source_sha: &'a str,
    pub opt_in: Option<&'a str>,
    pub operator_review: OperatorReview<'a>,
}
pub struct Permit {
    binding: Binding,
    claim: Claim,
    _creator: Rc<()>,
}
/// One consumed Gate permit; retains the claim for the entire attempt.
/// The Integrated Native entrypoint consumes this capability before Owner creation.
pub struct Attempt {
    executed: Cell<bool>,
    binding: Binding,
    _claim: Claim,
    _creator: Rc<()>,
}
impl Permit {
    pub fn consume(self) -> Attempt {
        Attempt {
            executed: Cell::new(false),
            binding: self.binding,
            _claim: self.claim,
            _creator: self._creator,
        }
    }
}
impl Attempt {
    pub fn binding(&self) -> &Binding {
        &self.binding
    }
}
/// Validates an explicitly externally reviewed record; matching hashes are not human approval.
pub fn evaluate(input: Input<'_>) -> Result<Permit, Error> {
    let binding = validate(&input)?;
    let guards = lock_inputs(&input)?;
    let mut claim = Claim::create(&binding)?;
    claim.hold(guards);
    Ok(Permit {
        binding,
        claim,
        _creator: Rc::new(()),
    })
}
pub(super) fn validate(input: &Input<'_>) -> Result<Binding, Error> {
    if input.opt_in != Some(OPT_IN_VALUE) {
        return Err(Error::OptIn);
    }
    match input.operator_review {
        OperatorReview::NotVerified => return Err(Error::Approval),
        OperatorReview::VerifiedRecord { record_sha256 } => {
            if record_sha256 != approval::digest(input.approval_record) {
                return Err(Error::Approval);
            }
        }
    }
    let binding: Binding = approval::parse(input.approval_record)?;
    approval::validate(&binding)?;
    if binding.executable_path != input.executable_path
        || binding.manifest_path != input.manifest_path
        || binding.descriptor_path != input.descriptor_path
        || binding.approval_path != input.approval_path
    {
        return Err(Error::Path);
    }
    if binding.executable_sha256 != approval::digest(input.executable) {
        return Err(Error::Artifact);
    }
    if binding.source_head != input.source_head || binding.source_sha != input.source_sha {
        return Err(Error::Source);
    }
    if binding.manifest_sha256 != approval::digest(input.manifest) {
        return Err(Error::Manifest);
    }
    if binding.descriptor_sha256 != approval::digest(input.descriptor) {
        return Err(Error::Descriptor);
    }
    let manifest: Manifest = approval::parse(input.manifest)?;
    if manifest.runner_id != binding.runner_id
        || manifest.scope != binding.scope
        || manifest.executable_sha256 != binding.executable_sha256
        || manifest.executable_path != binding.executable_path
        || manifest.source_head != binding.source_head
        || manifest.source_sha != binding.source_sha
        || manifest.native_api_scope != binding.native_api_scope
        || manifest.window_count != 1
        || manifest.run_count != 1
    {
        return Err(Error::Manifest);
    }
    let descriptor: Descriptor = approval::parse(input.descriptor)?;
    if descriptor.runner_id != binding.runner_id
        || descriptor.evidence_namespace != binding.evidence_namespace
        || descriptor.manifest_sha256 != binding.manifest_sha256
        || descriptor.manifest_path != binding.manifest_path
        || descriptor.approval_path != binding.approval_path
        || descriptor.evidence_path != binding.evidence_path
        || descriptor.staging_path != binding.staging_path
        || descriptor.claim_path != binding.claim_path
    {
        return Err(Error::Descriptor);
    }
    Ok(binding)
}

fn lock_inputs(input: &Input<'_>) -> Result<Vec<std::fs::File>, Error> {
    use std::io::Read;
    use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
    let mut guards = Vec::new();
    for (path, expected) in [
        (input.manifest_path, input.manifest),
        (input.descriptor_path, input.descriptor),
        (input.approval_path, input.approval_record),
    ] {
        guards.extend(crate::evidence_paths::lock_directories(path).map_err(|()| Error::Path)?);
        let (file, bytes) = crate::evidence_paths::read_locked(path).map_err(|()| Error::Path)?;
        if bytes != expected {
            return Err(Error::Artifact);
        }
        guards.push(file);
    }
    guards.extend(
        crate::evidence_paths::lock_directories(input.executable_path).map_err(|()| Error::Path)?,
    );
    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(1)
        .custom_flags(0x00200000)
        .open(input.executable_path)
        .map_err(|_| Error::Artifact)?;
    let metadata = file.metadata().map_err(|_| Error::Artifact)?;
    crate::evidence_paths::ordinary_attributes(metadata.file_attributes())
        .map_err(|()| Error::Artifact)?;
    if !metadata.is_file() {
        return Err(Error::Artifact);
    }
    let mut digest = sha2::Sha256::new();
    let mut buffer = [0; 8192];
    loop {
        let count = file.read(&mut buffer).map_err(|_| Error::Artifact)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    if format!("{:x}", digest.finalize()) != approval::digest(input.executable) {
        return Err(Error::Artifact);
    }
    guards.push(file);
    Ok(guards)
}

/// The consumed capability precedes entry into the caller's integration operation.
/// Native execution still requires the Attempt's private one-shot execution key.
pub fn with_attempt<T>(input: Input<'_>, factory: impl FnOnce(&Attempt) -> T) -> Result<T, Error> {
    let attempt = evaluate(input)?.consume();
    Ok(factory(&attempt))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionError {
    AlreadyExecuted,
    DriverAdmission,
}
/// Only Attempt can mint this one-shot entry key; no caller report can be supplied.
pub(crate) struct ExecutionKey<'a> {
    attempt: &'a Attempt,
}
impl Attempt {
    fn begin_execution(&self) -> Result<ExecutionKey<'_>, ExecutionError> {
        if self.executed.replace(true) {
            return Err(ExecutionError::AlreadyExecuted);
        }
        Ok(ExecutionKey { attempt: self })
    }
    #[cfg(all(windows, not(test)))]
    pub fn execute_native(
        &self,
    ) -> Result<
        super::result::RunResult<crate::native_contract::ownership_receipt::Native>,
        ExecutionError,
    > {
        crate::native_contract::integrated_execution::run(self.begin_execution()?)
    }
    #[cfg(test)]
    pub(crate) fn execute_synthetic<
        B: crate::native_contract::creator_thread_host::Backend<
            Provenance = crate::native_contract::ownership_receipt::Synthetic,
        >,
    >(
        &self,
        mut driver: crate::native_contract::creator_thread_host::synchronous_driver::Driver<B>,
    ) -> Result<
        super::result::RunResult<crate::native_contract::ownership_receipt::Synthetic>,
        ExecutionError,
    > {
        let key = self.begin_execution()?;
        let report = driver.run().map_err(|_| ExecutionError::DriverAdmission)?;
        Ok(key.complete(&report))
    }
}
impl ExecutionKey<'_> {
    pub(crate) fn complete<P>(
        self,
        report: &crate::native_contract::creator_thread_host::synchronous_driver::DriverReport<P>,
    ) -> super::result::RunResult<P> {
        super::result::RunResult::from_driver(self.attempt, report)
    }
}
