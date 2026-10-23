use std::collections::HashSet;

use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

use super::error::RepositoryError;

pub(super) fn valid_iso_datetime(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() < 20
        || bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
        || !value.ends_with('Z')
    {
        return false;
    }
    let Some(year) = digits(bytes, 0, 4) else {
        return false;
    };
    let Some(month) = digits(bytes, 5, 7) else {
        return false;
    };
    let Some(day) = digits(bytes, 8, 10) else {
        return false;
    };
    let Some(hour) = digits(bytes, 11, 13) else {
        return false;
    };
    let Some(minute) = digits(bytes, 14, 16) else {
        return false;
    };
    let Some(second) = digits(bytes, 17, 19) else {
        return false;
    };
    let suffix = &bytes[19..bytes.len() - 1];
    let fraction = suffix.is_empty()
        || (suffix.first() == Some(&b'.')
            && suffix.len() > 1
            && suffix[1..].iter().all(u8::is_ascii_digit));
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    fraction && day > 0 && day <= days && hour < 24 && minute < 60 && second < 60
}

fn digits(bytes: &[u8], start: usize, end: usize) -> Option<u32> {
    std::str::from_utf8(bytes.get(start..end)?)
        .ok()?
        .parse()
        .ok()
}

pub(super) fn canonical_hash(value: &Value) -> String {
    format!("{:x}", Sha256::digest(canonical_json(value).as_bytes()))
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        Value::Object(values) => {
            let mut entries = values.iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            format!(
                "{{{}}}",
                entries
                    .into_iter()
                    .map(|(key, item)| format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap_or_default(),
                        canonical_json(item)
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        primitive => serde_json::to_string(primitive).unwrap_or_default(),
    }
}

pub(super) fn validate_project_id(project_id: &str) -> Result<(), RepositoryError> {
    let bytes = project_id.as_bytes();
    let valid = !bytes.is_empty()
        && bytes.len() <= 64
        && bytes
            .first()
            .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'-'));
    if valid {
        Ok(())
    } else {
        Err(RepositoryError::InvalidProject)
    }
}

pub(super) fn validate_clone_provenance(
    fields: &Map<String, Value>,
) -> Result<(), RepositoryError> {
    let Some(value) = fields.get("cloneProvenance") else {
        return Ok(());
    };
    let object = value.as_object().ok_or(RepositoryError::InvalidProject)?;
    if object.len() != 2
        || object
            .get("sourceProjectId")
            .and_then(Value::as_str)
            .is_none_or(|id| validate_project_id(id).is_err())
        || object
            .get("sourceRevision")
            .and_then(Value::as_u64)
            .is_none_or(|revision| revision == 0)
    {
        Err(RepositoryError::InvalidProject)
    } else {
        Ok(())
    }
}

pub(super) fn unique(values: &[String]) -> bool {
    values.iter().collect::<HashSet<_>>().len() == values.len()
}
