use super::{
    model::{valid_text, valid_url, LibraryError},
    timestamps,
};
use serde::{de::Error as _, Deserialize, Deserializer, Serialize};
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CandidateProvenance {
    WebSearchVerified,
    TeacherSupplied,
    TeacherConfirmed,
    #[default]
    Unverified,
}
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FactVerificationStatus {
    #[default]
    Unverified,
    TeacherConfirmed,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MetadataVerification {
    pub title: FactVerificationStatus,
    pub publisher: FactVerificationStatus,
    pub duration_seconds: FactVerificationStatus,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiSource {
    pub url: String,
    pub title: String,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiMetadata {
    pub video_id: String,
    pub url: String,
    pub title: String,
    pub publisher: Option<String>,
    pub duration_seconds: Option<u32>,
    pub description: String,
    pub relevance: String,
    pub reason: String,
    pub sources: Vec<AiSource>,
    pub checked_at: String,
    pub needs_review: bool,
    pub provenance: CandidateProvenance,
    pub metadata_verification: MetadataVerification,
}
enum Presence<T> {
    Missing,
    Present(T),
}
impl<T> Default for Presence<T> {
    fn default() -> Self {
        Self::Missing
    }
}
impl<'de, T> Deserialize<'de> for Presence<T>
where
    T: Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        T::deserialize(deserializer).map(Self::Present)
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AiMetadataWire {
    video_id: String,
    url: String,
    title: String,
    publisher: Option<String>,
    duration_seconds: Option<u32>,
    description: String,
    relevance: String,
    reason: String,
    sources: Vec<AiSource>,
    checked_at: String,
    needs_review: bool,
    #[serde(default)]
    provenance: Presence<CandidateProvenance>,
    #[serde(default)]
    metadata_verification: Presence<MetadataVerification>,
}
impl<'de> Deserialize<'de> for AiMetadata {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = AiMetadataWire::deserialize(deserializer)?;
        let (provenance, metadata_verification) =
            match (wire.provenance, wire.metadata_verification) {
                (Presence::Missing, Presence::Missing) => (
                    CandidateProvenance::Unverified,
                    MetadataVerification::default(),
                ),
                (Presence::Present(provenance), Presence::Present(metadata_verification)) => {
                    (provenance, metadata_verification)
                }
                _ => {
                    return Err(D::Error::custom(
                        "provenance and metadataVerification must appear together",
                    ))
                }
            };
        Ok(Self {
            video_id: wire.video_id,
            url: wire.url,
            title: wire.title,
            publisher: wire.publisher,
            duration_seconds: wire.duration_seconds,
            description: wire.description,
            relevance: wire.relevance,
            reason: wire.reason,
            sources: wire.sources,
            checked_at: wire.checked_at,
            needs_review: wire.needs_review,
            provenance,
            metadata_verification,
        })
    }
}
impl AiMetadata {
    pub fn validate(&self, video_id: &str) -> Result<(), LibraryError> {
        let checked = timestamps::parse_iso(&self.checked_at)?;
        let confirmation_consistent = !(self.publisher.is_none()
            && self.metadata_verification.publisher == FactVerificationStatus::TeacherConfirmed)
            && !(self.duration_seconds.is_none()
                && self.metadata_verification.duration_seconds
                    == FactVerificationStatus::TeacherConfirmed);
        if self.video_id != video_id
            || !valid_url(&self.url, video_id)
            || !self.needs_review
            || !confirmation_consistent
            || checked > timestamps::now_ms()? + 300000
            || self.sources.is_empty()
            || self.sources.len() > 20
            || self.duration_seconds.is_some_and(|s| s == 0 || s > 86400)
            || self
                .publisher
                .as_ref()
                .is_some_and(|s| s.trim().is_empty() || !valid_text(s, 500))
            || [
                (&self.title, 500),
                (&self.description, 5000),
                (&self.relevance, 2000),
                (&self.reason, 2000),
            ]
            .iter()
            .any(|(s, max)| s.trim().is_empty() || !valid_text(s, *max))
            || self.sources.iter().any(|s| {
                !valid_url(&s.url, video_id)
                    || s.title.trim().is_empty()
                    || !valid_text(&s.title, 500)
            })
        {
            return Err(LibraryError::Invalid);
        }
        Ok(())
    }
    pub fn expired(&self, now: i64) -> Result<bool, LibraryError> {
        Ok(timestamps::parse_iso(&self.checked_at)? + timestamps::MAX_TTL_MS <= now)
    }
}
