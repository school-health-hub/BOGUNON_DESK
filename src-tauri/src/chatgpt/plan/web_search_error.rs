#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ParseError {
    InvalidUtf8,
    MalformedEvent,
    FailedStream,
    DuplicateCompletion,
    InvalidStatus,
    InvalidOutput,
    ItemAfterCompletion,
    InvalidItem,
    IncompleteItem,
    DuplicateItem,
    MissingCompletion,
    ConflictingOutput,
    MissingOutput,
    MissingSearch,
    MissingSources,
    MissingText,
    UnsafeSource,
    InvalidTimestamp,
}
impl ParseError {
    pub(crate) const fn code(&self) -> &'static str {
        match self {
            Self::InvalidUtf8 => "invalidUtf8",
            Self::MalformedEvent => "malformedEvent",
            Self::FailedStream => "failedStream",
            Self::DuplicateCompletion => "duplicateCompletion",
            Self::InvalidStatus => "invalidCompletionStatus",
            Self::InvalidOutput => "invalidOutputShape",
            Self::ItemAfterCompletion => "itemAfterCompletion",
            Self::InvalidItem => "invalidCompletedItem",
            Self::IncompleteItem => "incompleteItem",
            Self::DuplicateItem => "duplicateItem",
            Self::MissingCompletion => "missingCompletion",
            Self::ConflictingOutput => "conflictingOutput",
            Self::MissingOutput => "missingOutput",
            Self::MissingSearch => "missingCompletedSearch",
            Self::MissingSources => "missingSources",
            Self::MissingText => "missingText",
            Self::UnsafeSource => "unsafeOrMissingSourceUrl",
            Self::InvalidTimestamp => "invalidTimestamp",
        }
    }
}
