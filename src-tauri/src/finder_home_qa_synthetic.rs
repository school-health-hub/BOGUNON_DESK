use crate::education_video::model::{LibraryError, MAX_BYTES};
use serde_json::Value;

pub const VIDEO_ID: &str = "QAoffline01";
const VIDEO_URL: &str = "https://www.youtube.com/watch?v=QAoffline01";

fn provenance(value: &Value) -> Result<(), LibraryError> {
    match value.as_str() {
        Some("unverified" | "teacher-supplied") => Ok(()),
        _ => Err(LibraryError::Invalid),
    }
}

pub fn provider(value: &Value) -> Result<(), LibraryError> {
    if !value.is_object()
        || value["source"] != "synthetic-mock"
        || value["synthetic"] != true
        || value["official"] != false
        || !value["officialEvidence"].is_null()
        || value["url"] != VIDEO_URL
    {
        return Err(LibraryError::Invalid);
    }
    Ok(())
}

pub fn entry(value: &Value) -> Result<(), LibraryError> {
    if !value.is_object() || value["videoId"] != VIDEO_ID {
        return Err(LibraryError::Invalid);
    }
    if let Some(metadata) = value.get("provider").filter(|item| !item.is_null()) {
        provider(metadata)?;
    }
    if let Some(ai) = value.get("ai").filter(|item| !item.is_null()) {
        provenance(&ai["provenance"])?;
        if ai["videoId"] != VIDEO_ID || ai["url"] != VIDEO_URL {
            return Err(LibraryError::Invalid);
        }
        let sources = ai["sources"].as_array().ok_or(LibraryError::Invalid)?;
        if sources.is_empty() || sources.iter().any(|source| source["url"] != VIDEO_URL) {
            return Err(LibraryError::Invalid);
        }
    }
    if let Some(record) = value.get("candidateRecord").filter(|item| !item.is_null()) {
        provenance(&record["provenance"])?;
    }
    Ok(())
}

pub fn library(value: &Value) -> Result<(), LibraryError> {
    if !value.is_object() || value["version"] != 2 {
        return Err(LibraryError::Invalid);
    }
    let entries = value["entries"].as_array().ok_or(LibraryError::Invalid)?;
    if entries.len() > 1 {
        return Err(LibraryError::Invalid);
    }
    entries.iter().try_for_each(entry)
}

pub fn import_json(json: &str) -> Result<(), LibraryError> {
    if json.len() > MAX_BYTES {
        return Err(LibraryError::Invalid);
    }
    library(&serde_json::from_str::<Value>(json).map_err(|_| LibraryError::Corrupt)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_live_provider_when_payload_claims_real_search() {
        // Given: a provider marked as live despite the QA-only identifier.
        let provider_json = serde_json::json!({"source":"live","synthetic":false,
            "official":false,"officialEvidence":null,"url":VIDEO_URL});
        // When: it crosses the QA boundary.
        let result = provider(&provider_json);
        // Then: no store operation may accept it.
        assert_eq!(result, Err(LibraryError::Invalid));
    }

    #[test]
    fn rejects_search_provenance_when_fixture_id_is_reused() {
        // Given: a fixed fixture ID cannot turn a claimed web result into synthetic metadata.
        let entry_json = serde_json::json!({"videoId":VIDEO_ID,"ai":{
            "videoId":VIDEO_ID,"url":VIDEO_URL,"provenance":"web-search-verified",
            "sources":[{"url":VIDEO_URL}]}});
        // When: it crosses the QA boundary.
        let result = entry(&entry_json);
        // Then: claimed live provenance is refused.
        assert_eq!(result, Err(LibraryError::Invalid));
    }

    #[test]
    fn accepts_empty_version_two_library_when_imported() {
        // Given: an empty synthetic library export.
        let json = r#"{"version":2,"entries":[]}"#;
        // When: it crosses the import boundary.
        let result = import_json(json);
        // Then: an empty library remains valid.
        assert_eq!(result, Ok(()));
    }

    #[test]
    fn rejects_non_fixture_video_when_imported() {
        // Given: a version-two library with a non-fixture video.
        let json = r#"{"version":2,"entries":[{"videoId":"dQw4w9WgXcQ"}]}"#;
        // When: it crosses the import boundary.
        let result = import_json(json);
        // Then: the import is refused before persistence.
        assert_eq!(result, Err(LibraryError::Invalid));
    }
}
