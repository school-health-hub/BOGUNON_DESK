use super::{AttemptBinding, DirectoryIdentity, IdentityToken};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PathKey(String);

impl PathKey {
    pub(crate) fn parse(value: &str) -> Result<Self, UdfError> {
        let mut normalized = value.replace('\\', "/").to_ascii_lowercase();
        let bytes = normalized.as_bytes();
        if bytes.len() < 3
            || !bytes[0].is_ascii_alphabetic()
            || bytes[1] != b':'
            || bytes[2] != b'/'
            || normalized
                .split('/')
                .skip(1)
                .any(|part| part.is_empty() || matches!(part, "." | ".."))
        {
            return Err(UdfError::InvalidPath);
        }
        while normalized.len() > 3 && normalized.ends_with('/') {
            normalized.pop();
        }
        Ok(Self(normalized))
    }

    fn contains(&self, other: &Self) -> bool {
        self == other
            || other
                .0
                .strip_prefix(&self.0)
                .is_some_and(|suffix| suffix.starts_with('/'))
    }

    fn strictly_contains(&self, other: &Self) -> bool {
        self != other && self.contains(other)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct ObservedDirectory {
    requested: PathKey,
    canonical: PathKey,
    identity: DirectoryIdentity,
}

impl ObservedDirectory {
    pub(crate) const fn new(
        requested: PathKey,
        canonical: PathKey,
        identity: DirectoryIdentity,
    ) -> Self {
        Self {
            requested,
            canonical,
            identity,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OverrideObservation {
    Clear,
    Present,
    Unknown,
    Changed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum UdfStatus {
    NotVerified,
    Verified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum UdfError {
    InvalidPath,
    OverridePresent,
    OverrideUnknown,
    OverrideChanged,
    DirectoryOverlap,
    DirectoryIdentityConflict,
    EffectivePathMismatch,
    EffectiveIdentityMismatch,
    EnvironmentMismatch,
    ProfileOutsideSurface,
}

#[derive(Debug)]
pub(crate) struct RequestedIsolation {
    surface: ObservedDirectory,
}

impl RequestedIsolation {
    pub(crate) const fn status(&self) -> UdfStatus {
        UdfStatus::NotVerified
    }

    pub(crate) fn verify(
        &self,
        binding: &AttemptBinding,
        observation: EffectiveUdfObservation,
    ) -> Result<VerifiedIsolation, UdfError> {
        if observation.directory.path != self.surface.canonical {
            return Err(UdfError::EffectivePathMismatch);
        }
        if observation.directory.identity != self.surface.identity {
            return Err(UdfError::EffectiveIdentityMismatch);
        }
        if !observation
            .environment
            .identity
            .matches(&observation.profile.environment)
        {
            return Err(UdfError::EnvironmentMismatch);
        }
        if !self
            .surface
            .canonical
            .strictly_contains(&observation.profile.path)
        {
            return Err(UdfError::ProfileOutsideSurface);
        }
        Ok(VerifiedIsolation {
            binding: binding.clone(),
            environment: observation.environment.identity,
            browser_process: observation.environment.browser_process,
        })
    }
}

pub(crate) struct EffectiveUdfObservation {
    environment: EnvironmentObservation,
    directory: EffectiveDirectory,
    profile: ProfileObservation,
}

impl EffectiveUdfObservation {
    pub(crate) const fn new(
        environment: EnvironmentObservation,
        directory: EffectiveDirectory,
        profile: ProfileObservation,
    ) -> Self {
        Self {
            environment,
            directory,
            profile,
        }
    }
}

pub(crate) struct EnvironmentObservation {
    identity: IdentityToken,
    browser_process: IdentityToken,
}

impl EnvironmentObservation {
    pub(crate) const fn new(identity: IdentityToken, browser_process: IdentityToken) -> Self {
        Self {
            identity,
            browser_process,
        }
    }
}

pub(crate) struct EffectiveDirectory {
    path: PathKey,
    identity: DirectoryIdentity,
}

impl EffectiveDirectory {
    pub(crate) const fn new(path: PathKey, identity: DirectoryIdentity) -> Self {
        Self { path, identity }
    }
}

pub(crate) struct ProfileObservation {
    path: PathKey,
    environment: IdentityToken,
}

impl ProfileObservation {
    pub(crate) const fn new(path: PathKey, environment: IdentityToken) -> Self {
        Self { path, environment }
    }
}

#[derive(Debug)]
pub(crate) struct VerifiedIsolation {
    binding: AttemptBinding,
    environment: IdentityToken,
    browser_process: IdentityToken,
}

impl VerifiedIsolation {
    pub(crate) const fn status(&self) -> UdfStatus {
        UdfStatus::Verified
    }

    pub(crate) fn binding_matches(&self, binding: &AttemptBinding) -> bool {
        self.binding.matches(binding)
    }

    pub(crate) fn environment_matches(&self, environment: &IdentityToken) -> bool {
        self.environment.matches(environment)
    }

    pub(crate) fn browser_process_matches(&self, browser_process: &IdentityToken) -> bool {
        self.browser_process.matches(browser_process)
    }
}

pub(crate) fn preflight_udf(
    main: ObservedDirectory,
    surface: ObservedDirectory,
    overrides: OverrideObservation,
) -> Result<RequestedIsolation, UdfError> {
    match overrides {
        OverrideObservation::Clear => {}
        OverrideObservation::Present => return Err(UdfError::OverridePresent),
        OverrideObservation::Unknown => return Err(UdfError::OverrideUnknown),
        OverrideObservation::Changed => return Err(UdfError::OverrideChanged),
    }
    if main.requested.contains(&surface.requested)
        || surface.requested.contains(&main.requested)
        || main.canonical.contains(&surface.canonical)
        || surface.canonical.contains(&main.canonical)
    {
        return Err(UdfError::DirectoryOverlap);
    }
    if main.identity == surface.identity {
        return Err(UdfError::DirectoryIdentityConflict);
    }
    Ok(RequestedIsolation { surface })
}
