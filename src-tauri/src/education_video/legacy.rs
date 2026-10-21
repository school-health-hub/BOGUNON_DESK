use super::{model::*, timestamps};
use serde::Deserialize;
use std::collections::HashSet;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyItem {
    video_id: String,
    title: String,
    channel_id: String,
    channel_title: String,
    duration_seconds: u32,
    url: String,
    source: String,
    education_title: String,
    target: String,
    schedule: String,
    instructions: String,
    message: String,
    notes: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacyLibrary {
    version: u8,
    items: Vec<LegacyItem>,
}
pub fn parse_any(json: &str, now: i64) -> Result<(Library, bool), LibraryError> {
    if json.len() > MAX_BYTES {
        return Err(LibraryError::Invalid);
    }
    let value: serde_json::Value = serde_json::from_str(json).map_err(|_| LibraryError::Invalid)?;
    if value.get("version").and_then(serde_json::Value::as_u64) != Some(1) {
        return parse(json).map(|library| (library, false));
    }
    let legacy: LegacyLibrary = serde_json::from_value(value).map_err(|_| LibraryError::Invalid)?;
    if legacy.version != 1 || legacy.items.len() > MAX_ITEMS {
        return Err(LibraryError::Invalid);
    }
    let mut ids = HashSet::new();
    let mut entries = Vec::new();
    for item in legacy.items {
        if item.source != "mock" || !ids.insert(item.video_id.clone()) {
            return Err(LibraryError::Invalid);
        }
        let entry = LibraryEntry {
            video_id: item.video_id,
            teacher: TeacherData {
                education_title: item.education_title,
                target: item.target,
                schedule: item.schedule,
                instructions: item.instructions,
                message: item.message,
                notes: item.notes,
            },
            provider: Some(ProviderMetadata {
                title: item.title,
                channel_id: item.channel_id,
                channel_title: item.channel_title,
                duration_seconds: Some(item.duration_seconds),
                url: item.url,
                source: VideoSource::SyntheticMock,
                official: false,
                official_evidence: None,
                synthetic: true,
                fetched_at: timestamps::format_iso(now),
                expires_at: timestamps::format_iso(now + timestamps::MAX_TTL_MS),
            }),
        };
        entry.validate()?;
        entries.push(entry);
    }
    Ok((
        Library {
            version: 2,
            entries,
        },
        true,
    ))
}
