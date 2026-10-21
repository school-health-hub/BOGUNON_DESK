use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_ITEMS: usize = 1000;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VideoSource {
    Mock,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibraryItem {
    pub video_id: String,
    pub title: String,
    pub channel_id: String,
    pub channel_title: String,
    pub duration_seconds: u32,
    pub url: String,
    pub source: VideoSource,
    pub education_title: String,
    pub target: String,
    pub schedule: String,
    pub instructions: String,
    pub message: String,
    pub notes: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Library {
    pub version: u8,
    pub items: Vec<LibraryItem>,
}

impl Default for Library {
    fn default() -> Self {
        Self {
            version: 1,
            items: Vec::new(),
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

impl LibraryItem {
    pub fn validate(&self) -> Result<(), LibraryError> {
        let valid_id = self.video_id.len() == 11
            && self
                .video_id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-');
        if !valid_id
            || self.url != format!("https://www.youtube.com/watch?v={}", self.video_id)
            || self.duration_seconds == 0
            || self.duration_seconds > 86400
            || self.title.trim().is_empty()
            || self.channel_id.trim().is_empty()
            || self.channel_title.trim().is_empty()
            || [
                &self.title,
                &self.channel_id,
                &self.channel_title,
                &self.education_title,
                &self.target,
                &self.schedule,
                &self.instructions,
                &self.message,
                &self.notes,
            ]
            .iter()
            .any(|text| text.len() > 20000 || text.contains('\0'))
        {
            return Err(LibraryError::Invalid);
        }
        Ok(())
    }
}

pub fn parse(json: &str) -> Result<Library, LibraryError> {
    if json.len() > MAX_BYTES {
        return Err(LibraryError::Invalid);
    }
    let library: Library = serde_json::from_str(json).map_err(|_| LibraryError::Invalid)?;
    if library.version != 1 || library.items.len() > MAX_ITEMS {
        return Err(LibraryError::Invalid);
    }
    let mut ids = HashSet::new();
    for item in &library.items {
        item.validate()?;
        if !ids.insert(&item.video_id) {
            return Err(LibraryError::Invalid);
        }
    }
    Ok(library)
}
