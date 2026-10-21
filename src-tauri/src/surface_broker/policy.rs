use super::BrokerError;

/// The complete C-2B broker allowlist.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RequestKind {
    OpenMain,
    RefreshProjection,
}

impl RequestKind {
    pub(crate) const fn wire_name(self) -> &'static str {
        match self {
            Self::OpenMain => "OpenMain",
            Self::RefreshProjection => "RefreshProjection",
        }
    }
}

impl TryFrom<&str> for RequestKind {
    type Error = BrokerError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "OpenMain" => Ok(Self::OpenMain),
            "RefreshProjection" => Ok(Self::RefreshProjection),
            _ => Err(BrokerError::UnsupportedRequest),
        }
    }
}
