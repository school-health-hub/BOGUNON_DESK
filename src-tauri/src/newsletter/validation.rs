use super::validation_primitives::validate_clone_provenance;
pub(super) use super::validation_primitives::{
    canonical_hash, unique, valid_iso_datetime, validate_project_id,
};
use super::{error::RepositoryError, model::ProjectDocument};
use serde_json::{Map, Value};

pub(super) fn parse_document(value: Value) -> Result<ProjectDocument, RepositoryError> {
    let version = value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or(RepositoryError::InvalidProject)?;
    if version != 1 {
        return Err(RepositoryError::UnsupportedVersion);
    }
    let document: ProjectDocument =
        serde_json::from_value(value).map_err(|_| RepositoryError::InvalidProject)?;
    validate_project_id(&document.project_id)?;
    validate_schema(&document)?;
    Ok(document)
}

fn validate_schema(document: &ProjectDocument) -> Result<(), RepositoryError> {
    let topics = array(&document.fields, "topics")?;
    let canonical = object(&document.fields, "canonicalCopy")?;
    let sections = canonical
        .get("sections")
        .and_then(Value::as_array)
        .ok_or(RepositoryError::InvalidProject)?;
    if topics.len() != 6 || sections.len() != 6 {
        return Err(RepositoryError::InvalidProject);
    }
    let topic_ids = ids(topics, "id")?;
    let section_ids = ids(sections, "id")?;
    if !unique(&topic_ids) || !unique(&section_ids) || topic_ids != ids(sections, "topicId")? {
        return Err(RepositoryError::InvalidProject);
    }
    if document
        .fields
        .get("title")
        .and_then(Value::as_str)
        .is_none_or(|value| value.trim().is_empty())
        || topics.iter().any(|topic| {
            topic
                .get("title")
                .and_then(Value::as_str)
                .is_none_or(|value| value.trim().is_empty())
        })
        || topic_ids
            .iter()
            .chain(section_ids.iter())
            .any(|id| validate_project_id(id).is_err())
    {
        return Err(RepositoryError::InvalidProject);
    }
    validate_sections(sections)?;
    validate_layouts(&document.fields, &topic_ids, &section_ids)?;
    validate_history(document, &topic_ids, &section_ids)?;
    validate_outputs(&document.fields, document.project_revision)?;
    validate_clone_provenance(&document.fields)
}

fn validate_sections(sections: &[Value]) -> Result<(), RepositoryError> {
    for section in sections {
        let object = section.as_object().ok_or(RepositoryError::InvalidProject)?;
        let ai = object
            .get("aiGenerated")
            .ok_or(RepositoryError::InvalidProject)?;
        if object
            .get("revision")
            .and_then(Value::as_u64)
            .is_none_or(|value| value == 0)
            || ai.get("text").and_then(Value::as_str).is_none()
            || ai
                .get("generatedAt")
                .and_then(Value::as_str)
                .is_none_or(|value| !valid_iso_datetime(value))
        {
            return Err(RepositoryError::InvalidProject);
        }
        let input = match object.get("userEdit") {
            Some(user)
                if user.get("text").and_then(Value::as_str).is_some()
                    && user
                        .get("editedAt")
                        .and_then(Value::as_str)
                        .is_some_and(valid_iso_datetime) =>
            {
                let mut input = Map::new();
                input.insert("aiGenerated".to_owned(), ai.clone());
                input.insert("userEdit".to_owned(), user.clone());
                Value::Object(input)
            }
            Some(_) => return Err(RepositoryError::InvalidProject),
            None => ai.clone(),
        };
        if object.get("semanticHash").and_then(Value::as_str)
            != Some(canonical_hash(&input).as_str())
        {
            return Err(RepositoryError::InvalidProject);
        }
    }
    Ok(())
}

fn validate_layouts(
    fields: &Map<String, Value>,
    topics: &[String],
    sections: &[String],
) -> Result<(), RepositoryError> {
    let a4 = fields
        .get("a4Layout")
        .and_then(|value| value.get("sectionRefs"))
        .and_then(Value::as_array)
        .ok_or(RepositoryError::InvalidProject)?;
    if strings(a4)? != sections {
        return Err(RepositoryError::InvalidProject);
    }
    let cards = array(fields, "cardLayouts")?;
    if cards.len() != 7
        || cards[0].get("kind").and_then(Value::as_str) != Some("cover")
        || cards[0]
            .get("title")
            .and_then(Value::as_str)
            .is_none_or(|value| value.trim().is_empty())
    {
        return Err(RepositoryError::InvalidProject);
    }
    for (index, card) in cards[1..].iter().enumerate() {
        if card.get("kind").and_then(Value::as_str) != Some("topic")
            || card.get("topicId").and_then(Value::as_str) != Some(topics[index].as_str())
            || card.get("sectionRef").and_then(Value::as_str) != Some(sections[index].as_str())
        {
            return Err(RepositoryError::InvalidProject);
        }
    }
    Ok(())
}

fn validate_history(
    document: &ProjectDocument,
    topics: &[String],
    sections: &[String],
) -> Result<(), RepositoryError> {
    let history = array(&document.fields, "revisionHistory")?;
    if history.is_empty() || history.len() as u64 != document.project_revision {
        return Err(RepositoryError::InvalidProject);
    }
    for (index, entry) in history.iter().enumerate() {
        if entry.get("revision").and_then(Value::as_u64) != u64::try_from(index + 1).ok()
            || entry
                .get("createdAt")
                .and_then(Value::as_str)
                .is_none_or(|value| !valid_iso_datetime(value))
            || entry
                .get("changedSectionIds")
                .and_then(Value::as_array)
                .is_none()
        {
            return Err(RepositoryError::InvalidProject);
        }
        let changed = entry
            .get("changedSectionIds")
            .and_then(Value::as_array)
            .ok_or(RepositoryError::InvalidProject)?;
        let invalid_restore_source = match entry.get("restoredFromRevision") {
            None => false,
            Some(value) => value
                .as_u64()
                .is_none_or(|source| source == 0 || source >= index as u64 + 1),
        };
        if strings(changed)?.iter().any(|id| !sections.contains(id)) || invalid_restore_source {
            return Err(RepositoryError::InvalidProject);
        }
        let snapshot = entry
            .get("snapshot")
            .and_then(|value| value.get("sections"))
            .and_then(Value::as_array)
            .ok_or(RepositoryError::InvalidProject)?;
        if ids(snapshot, "topicId")? != topics || ids(snapshot, "id")? != sections {
            return Err(RepositoryError::InvalidProject);
        }
        validate_sections(snapshot)?;
    }
    if history.last().and_then(|entry| entry.get("snapshot"))
        != document.fields.get("canonicalCopy")
    {
        return Err(RepositoryError::InvalidProject);
    }
    Ok(())
}

fn validate_outputs(fields: &Map<String, Value>, revision: u64) -> Result<(), RepositoryError> {
    if array(fields, "outputHistory")?.iter().any(|output| {
        output
            .get("projectRevision")
            .and_then(Value::as_u64)
            .is_none_or(|value| value == 0 || value > revision)
            || output
                .get("id")
                .and_then(Value::as_str)
                .is_none_or(|id| validate_project_id(id).is_err())
            || output
                .get("format")
                .and_then(Value::as_str)
                .is_none_or(|format| !matches!(format, "a4" | "cards"))
            || output
                .get("createdAt")
                .and_then(Value::as_str)
                .is_none_or(|value| !valid_iso_datetime(value))
    }) {
        Err(RepositoryError::InvalidProject)
    } else {
        Ok(())
    }
}

fn array<'a>(fields: &'a Map<String, Value>, key: &str) -> Result<&'a Vec<Value>, RepositoryError> {
    fields
        .get(key)
        .and_then(Value::as_array)
        .ok_or(RepositoryError::InvalidProject)
}
fn object<'a>(
    fields: &'a Map<String, Value>,
    key: &str,
) -> Result<&'a Map<String, Value>, RepositoryError> {
    fields
        .get(key)
        .and_then(Value::as_object)
        .ok_or(RepositoryError::InvalidProject)
}
fn ids(values: &[Value], key: &str) -> Result<Vec<String>, RepositoryError> {
    values
        .iter()
        .map(|value| {
            value
                .get(key)
                .and_then(Value::as_str)
                .map(str::to_owned)
                .ok_or(RepositoryError::InvalidProject)
        })
        .collect()
}
fn strings(values: &[Value]) -> Result<Vec<String>, RepositoryError> {
    values
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or(RepositoryError::InvalidProject)
        })
        .collect()
}
