use super::{registry, timestamps};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
pub const MAX_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_ITEMS: usize = 1000;
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub enum VideoSource {
    #[serde(rename = "synthetic-mock")]
    SyntheticMock,
    #[serde(rename = "live")]
    Live,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TeacherData {
    pub education_title: String,
    pub target: String,
    pub schedule: String,
    pub instructions: String,
    pub message: String,
    pub notes: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderMetadata {
    pub title: String,
    pub channel_id: String,
    pub channel_title: String,
    pub duration_seconds: Option<u32>,
    pub url: String,
    pub source: VideoSource,
    pub official: bool,
    pub official_evidence: Option<String>,
    pub synthetic: bool,
    pub fetched_at: String,
    pub expires_at: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibraryEntry {
    pub video_id: String,
    pub teacher: TeacherData,
    pub provider: Option<ProviderMetadata>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Library {
    pub version: u8,
    pub entries: Vec<LibraryEntry>,
}
impl Default for Library {
    fn default() -> Self {
        Self {
            version: 2,
            entries: Vec::new(),
        }
    }
}
#[derive(Debug, Serialize)]
pub struct LoadResult {
    pub library: Library,
    pub recovered: bool,
}
#[derive(Debug, PartialEq, Eq)]
pub enum LibraryError {
    Invalid,
    Io,
    Corrupt,
    Busy,
}
impl std::fmt::Display for LibraryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Invalid => "영상 라이브러리 형식이나 입력값을 확인해 주세요.",
            Self::Io => "영상 라이브러리를 저장하지 못했습니다. 기존 데이터는 유지됩니다.",
            Self::Corrupt => {
                "영상 라이브러리와 백업을 읽을 수 없습니다. 원본 파일을 보존해 주세요."
            }
            Self::Busy => "영상 라이브러리가 사용 중입니다. 다시 시도해 주세요.",
        })
    }
}
impl std::error::Error for LibraryError {}
pub fn valid_text(value: &str, max: usize) -> bool {
    value.chars().count() <= max && !value.contains('\0')
}
pub fn valid_video_id(value: &str) -> bool {
    value.len() == 11
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
pub fn valid_url(value: &str, id: &str) -> bool {
    valid_video_id(id) && value == format!("https://www.youtube.com/watch?v={id}")
}
impl ProviderMetadata {
    pub fn validate(&self, video_id: &str) -> Result<(), LibraryError> {
        let fetched = timestamps::parse_iso(&self.fetched_at)?;
        let expires = timestamps::parse_iso(&self.expires_at)?;
        let now = timestamps::now_ms()?;
        if fetched > now + 300000 || expires > now + timestamps::MAX_TTL_MS + 300000 {
            return Err(LibraryError::Invalid);
        }
        let source_consistent = match self.source {
            VideoSource::SyntheticMock => self.synthetic,
            VideoSource::Live => !self.synthetic,
        };
        let official_consistent = registry::valid_claim(
            &self.channel_id,
            self.official,
            self.official_evidence.as_deref(),
            self.synthetic,
        );
        if expires <= fetched
            || expires - fetched > timestamps::MAX_TTL_MS
            || !source_consistent
            || !official_consistent
            || !valid_url(&self.url, video_id)
            || self.title.trim().is_empty()
            || !valid_text(&self.title, 300)
            || self.channel_id.trim().is_empty()
            || !valid_text(&self.channel_id, 200)
            || self.channel_title.trim().is_empty()
            || !valid_text(&self.channel_title, 200)
            || self.duration_seconds.is_some_and(|s| s == 0 || s > 86400)
        {
            return Err(LibraryError::Invalid);
        }
        Ok(())
    }
}
impl LibraryEntry {
    pub fn validate(&self) -> Result<(), LibraryError> {
        if !valid_video_id(&self.video_id)
            || [
                &self.teacher.education_title,
                &self.teacher.target,
                &self.teacher.schedule,
                &self.teacher.instructions,
                &self.teacher.message,
                &self.teacher.notes,
            ]
            .iter()
            .any(|s| !valid_text(s, 20000))
        {
            return Err(LibraryError::Invalid);
        }
        if let Some(provider) = &self.provider {
            provider.validate(&self.video_id)?;
        }
        Ok(())
    }
    pub fn expire(&mut self, now: i64) -> Result<bool, LibraryError> {
        let expired = match &self.provider {
            Some(provider) => timestamps::parse_iso(&provider.expires_at)? <= now,
            None => false,
        };
        if expired {
            self.provider = None;
        }
        Ok(expired)
    }
}
pub fn parse(json: &str) -> Result<Library, LibraryError> {
    if json.len() > MAX_BYTES {
        return Err(LibraryError::Invalid);
    }
    let library: Library = serde_json::from_str(json).map_err(|_| LibraryError::Invalid)?;
    if library.version != 2 || library.entries.len() > MAX_ITEMS {
        return Err(LibraryError::Invalid);
    }
    let mut ids = HashSet::new();
    for entry in &library.entries {
        entry.validate()?;
        if !ids.insert(&entry.video_id) {
            return Err(LibraryError::Invalid);
        }
    }
    Ok(library)
}
