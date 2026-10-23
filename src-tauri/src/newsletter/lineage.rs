use super::{error::RepositoryError, model::ProjectDocument};
use serde_json::Value;

pub(super) fn reset_clone_history(
    document: &mut ProjectDocument,
    created_at: &str,
) -> Result<(), RepositoryError> {
    let changed = section_ids(document)?;
    let history = document
        .fields
        .get_mut("revisionHistory")
        .and_then(Value::as_array_mut)
        .ok_or(RepositoryError::InvalidProject)?;
    let mut entry = history
        .last()
        .cloned()
        .ok_or(RepositoryError::InvalidProject)?;
    let object = entry
        .as_object_mut()
        .ok_or(RepositoryError::InvalidProject)?;
    object.insert("revision".to_owned(), Value::from(1));
    object.insert("createdAt".to_owned(), Value::from(created_at));
    object.insert("changedSectionIds".to_owned(), Value::Array(changed));
    object.remove("restoredFromRevision");
    history.clear();
    history.push(entry);
    Ok(())
}

pub(super) fn restored_document(
    mut current: ProjectDocument,
    source: &ProjectDocument,
    source_revision: u64,
    restored_at: &str,
) -> Result<ProjectDocument, RepositoryError> {
    let canonical = source
        .fields
        .get("canonicalCopy")
        .cloned()
        .ok_or(RepositoryError::Corrupted)?;
    current
        .fields
        .insert("canonicalCopy".to_owned(), canonical.clone());
    current.project_revision += 1;
    let changed = section_ids(&current)?;
    let history = current
        .fields
        .get_mut("revisionHistory")
        .and_then(Value::as_array_mut)
        .ok_or(RepositoryError::Corrupted)?;
    let mut entry = history.last().cloned().ok_or(RepositoryError::Corrupted)?;
    let object = entry.as_object_mut().ok_or(RepositoryError::Corrupted)?;
    object.insert("revision".to_owned(), Value::from(current.project_revision));
    object.insert("createdAt".to_owned(), Value::from(restored_at));
    object.insert("changedSectionIds".to_owned(), Value::Array(changed));
    object.insert(
        "restoredFromRevision".to_owned(),
        Value::from(source_revision),
    );
    object.insert("snapshot".to_owned(), canonical);
    history.push(entry);
    Ok(current)
}

fn section_ids(document: &ProjectDocument) -> Result<Vec<Value>, RepositoryError> {
    document
        .fields
        .get("canonicalCopy")
        .and_then(|v| v.get("sections"))
        .and_then(Value::as_array)
        .ok_or(RepositoryError::Corrupted)?
        .iter()
        .map(|section| {
            section
                .get("id")
                .and_then(Value::as_str)
                .map(Value::from)
                .ok_or(RepositoryError::Corrupted)
        })
        .collect()
}
