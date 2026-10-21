use super::{
    model::{valid_text, valid_url, VideoSource},
    registry, timestamps,
};
use serde::{Deserialize, Serialize};
pub const MAX_RESPONSE_BYTES: usize = 256 * 1024;
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SearchRequest {
    pub topic: String,
    pub audience: String,
    pub desired_minutes: u16,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SearchVideo {
    pub video_id: String,
    pub title: String,
    pub channel_id: String,
    pub channel_title: String,
    pub duration_seconds: Option<u32>,
    pub url: String,
    pub official: bool,
    pub official_evidence: Option<String>,
    pub synthetic: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fetched_at: Option<String>,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SearchResponse {
    pub source: VideoSource,
    pub notice: String,
    pub results: Vec<SearchVideo>,
}
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SearchError {
    InvalidRequest,
    Unauthorized,
    QuotaExceeded,
    UpstreamUnavailable,
    InvalidResponse,
    ResponseTooLarge,
    Timeout,
    RedirectBlocked,
    RealDispatchDisabled,
}
impl SearchRequest {
    pub fn validate(&self) -> Result<(), SearchError> {
        if self.topic.trim().is_empty()
            || !valid_text(&self.topic, 100)
            || self.audience.trim().is_empty()
            || !valid_text(&self.audience, 100)
            || !(1..=180).contains(&self.desired_minutes)
        {
            return Err(SearchError::InvalidRequest);
        }
        Ok(())
    }
}
pub fn parse_response(bytes: &[u8]) -> Result<SearchResponse, SearchError> {
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err(SearchError::ResponseTooLarge);
    }
    let result: SearchResponse =
        serde_json::from_slice(bytes).map_err(|_| SearchError::InvalidResponse)?;
    if result.results.len() > 12 || !valid_text(&result.notice, 500) {
        return Err(SearchError::InvalidResponse);
    }
    let mut ids = std::collections::HashSet::new();
    for video in &result.results {
        let synthetic = match result.source {
            VideoSource::SyntheticMock => video.synthetic,
            VideoSource::Live => !video.synthetic,
        };
        let official = registry::valid_claim(
            &video.channel_id,
            video.official,
            video.official_evidence.as_deref(),
            video.synthetic,
        );
        if matches!(result.source, VideoSource::Live) && video.fetched_at.is_none() {
            return Err(SearchError::InvalidResponse);
        }
        if !synthetic
            || !official
            || !ids.insert(&video.video_id)
            || !valid_url(&video.url, &video.video_id)
            || video.title.trim().is_empty()
            || !valid_text(&video.title, 300)
            || video.channel_id.trim().is_empty()
            || !valid_text(&video.channel_id, 200)
            || video.channel_title.trim().is_empty()
            || !valid_text(&video.channel_title, 200)
            || video.duration_seconds.is_some_and(|s| s == 0 || s > 86400)
            || video.fetched_at.as_deref().is_some_and(|t| {
                timestamps::parse_iso(t).map_or(true, |time| {
                    timestamps::now_ms().map_or(true, |now| time > now + 300000)
                })
            })
        {
            return Err(SearchError::InvalidResponse);
        }
    }
    Ok(result)
}
