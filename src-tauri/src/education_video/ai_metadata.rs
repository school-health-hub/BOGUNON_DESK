use super::{
    model::{valid_text, valid_url, LibraryError},
    timestamps,
};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiSource {
    pub url: String,
    pub title: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
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
}
impl AiMetadata {
    pub fn validate(&self, video_id: &str) -> Result<(), LibraryError> {
        let checked = timestamps::parse_iso(&self.checked_at)?;
        if self.video_id != video_id
            || !valid_url(&self.url, video_id)
            || !self.needs_review
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
