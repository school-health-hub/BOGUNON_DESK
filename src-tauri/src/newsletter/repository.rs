use std::{fs, path::Path};

use super::{
    error::RepositoryError,
    io::{atomic_write, quarantine_copy, read_document},
    lineage::{reset_clone_history, restored_document},
    model::{CloneProvenance, ProjectDocument},
    paths::{ProjectPaths, RepositoryPaths},
    recovery::reconcile_interrupted_commit,
    validation::{parse_document, valid_iso_datetime, validate_project_id},
};
use serde_json::{to_value, Value};

pub(crate) struct NewsletterRepository {
    paths: RepositoryPaths,
    #[cfg(test)]
    fail_current_write: bool,
}

impl NewsletterRepository {
    pub(crate) fn new(root: &Path) -> Self {
        Self {
            paths: RepositoryPaths::new(root),
            #[cfg(test)]
            fail_current_write: false,
        }
    }

    #[cfg(test)]
    fn with_current_write_failure(root: &Path) -> Self {
        Self {
            paths: RepositoryPaths::new(root),
            fail_current_write: true,
        }
    }

    pub(crate) fn create(&self, project: Value) -> Result<ProjectDocument, RepositoryError> {
        let document = parse_document(project)?;
        if document.project_revision != 1 {
            return Err(RepositoryError::InvalidProject);
        }
        let paths = self.paths(&document.project_id)?;
        reconcile_interrupted_commit(&paths)?;
        if paths.current.exists() {
            return Err(RepositoryError::Conflict);
        }
        self.persist(&paths, &document)?;
        Ok(document)
    }

    pub(crate) fn get(&self, project_id: &str) -> Result<ProjectDocument, RepositoryError> {
        let paths = self.paths(project_id)?;
        reconcile_interrupted_commit(&paths)?;
        match read_document(&paths.current) {
            Ok(document) => Ok(document),
            Err(RepositoryError::Corrupted) => {
                quarantine_copy(&paths.current, &paths.quarantine)?;
                read_document(&paths.last_known_good)
            }
            Err(error) => Err(error),
        }
    }

    pub(crate) fn save(&self, project: Value) -> Result<ProjectDocument, RepositoryError> {
        let document = parse_document(project)?;
        let paths = self.paths(&document.project_id)?;
        let current = self.get(&document.project_id)?;
        if document.project_revision != current.project_revision + 1 {
            return Err(RepositoryError::Conflict);
        }
        validate_history_append(&current, &document)?;
        self.persist(&paths, &document)?;
        Ok(document)
    }

    pub(crate) fn clone_project(
        &self,
        source_id: &str,
        new_id: &str,
        created_at: &str,
    ) -> Result<ProjectDocument, RepositoryError> {
        validate_project_id(new_id)?;
        if !valid_iso_datetime(created_at) {
            return Err(RepositoryError::InvalidProject);
        }
        let source = self.get(source_id)?;
        let source_revision = source.project_revision;
        let mut clone = source;
        clone.project_id = new_id.to_owned();
        clone.project_revision = 1;
        clone
            .fields
            .insert("outputHistory".to_owned(), Value::Array(Vec::new()));
        reset_clone_history(&mut clone, created_at)?;
        clone.fields.insert(
            "cloneProvenance".to_owned(),
            to_value(CloneProvenance {
                source_project_id: source_id.to_owned(),
                source_revision,
            })
            .map_err(|_| RepositoryError::Unavailable)?,
        );
        self.create(to_value(&clone).map_err(|_| RepositoryError::Unavailable)?)
    }

    pub(crate) fn history(&self, project_id: &str) -> Result<Value, RepositoryError> {
        let current = self.get(project_id)?;
        current
            .fields
            .get("revisionHistory")
            .cloned()
            .filter(Value::is_array)
            .ok_or(RepositoryError::Corrupted)
    }

    pub(crate) fn restore(
        &self,
        project_id: &str,
        revision: u64,
        restored_at: &str,
    ) -> Result<ProjectDocument, RepositoryError> {
        if !valid_iso_datetime(restored_at) {
            return Err(RepositoryError::InvalidProject);
        }
        let paths = self.paths(project_id)?;
        let current = self.get(project_id)?;
        if revision == 0 || revision >= current.project_revision {
            return Err(RepositoryError::InvalidProject);
        }
        let source = read_document(&paths.revisions.join(format!("{revision}.json")))?;
        let restored = restored_document(current, &source, revision, restored_at)?;
        self.persist(&paths, &restored)?;
        Ok(restored)
    }

    fn persist(
        &self,
        paths: &ProjectPaths,
        document: &ProjectDocument,
    ) -> Result<(), RepositoryError> {
        self.paths.ensure_safe_directory(&paths.directory)?;
        let bytes =
            serde_json::to_vec_pretty(document).map_err(|_| RepositoryError::InvalidProject)?;
        parse_bytes(&bytes)?;
        fs::create_dir_all(&paths.revisions).map_err(|_| RepositoryError::Unavailable)?;
        let revision = paths
            .revisions
            .join(format!("{}.json", document.project_revision));
        if revision.exists() {
            return Err(RepositoryError::Conflict);
        }
        let previous_lkg = fs::read(&paths.last_known_good).ok();
        atomic_write(&revision, &bytes)?;
        if let Err(error) = atomic_write(&paths.last_known_good, &bytes) {
            return if fs::remove_file(&revision).is_ok() {
                Err(error)
            } else {
                Err(RepositoryError::Corrupted)
            };
        }
        if let Err(error) = self.write_current(&paths.current, &bytes) {
            let revision_rolled_back = fs::remove_file(&revision).is_ok();
            let lkg_rolled_back = if let Some(previous) = previous_lkg {
                atomic_write(&paths.last_known_good, &previous).is_ok()
            } else {
                fs::remove_file(&paths.last_known_good).is_ok()
            };
            return if revision_rolled_back && lkg_rolled_back {
                Err(error)
            } else {
                Err(RepositoryError::Corrupted)
            };
        }
        Ok(())
    }

    fn write_current(&self, path: &Path, bytes: &[u8]) -> Result<(), RepositoryError> {
        #[cfg(test)]
        if self.fail_current_write {
            return Err(RepositoryError::Unavailable);
        }
        atomic_write(path, bytes)
    }

    fn paths(&self, project_id: &str) -> Result<ProjectPaths, RepositoryError> {
        validate_project_id(project_id)?;
        self.paths.project(project_id)
    }
}

fn parse_bytes(bytes: &[u8]) -> Result<ProjectDocument, RepositoryError> {
    let value = serde_json::from_slice(bytes).map_err(|_| RepositoryError::Corrupted)?;
    parse_document(value).map_err(|error| match error {
        RepositoryError::UnsupportedVersion => RepositoryError::UnsupportedVersion,
        RepositoryError::InvalidProject
        | RepositoryError::NotFound
        | RepositoryError::Conflict
        | RepositoryError::Corrupted
        | RepositoryError::Unavailable => RepositoryError::Corrupted,
    })
}

fn validate_history_append(
    current: &ProjectDocument,
    submitted: &ProjectDocument,
) -> Result<(), RepositoryError> {
    let stored = current
        .fields
        .get("revisionHistory")
        .and_then(Value::as_array)
        .ok_or(RepositoryError::Corrupted)?;
    let incoming = submitted
        .fields
        .get("revisionHistory")
        .and_then(Value::as_array)
        .ok_or(RepositoryError::InvalidProject)?;
    if incoming.len() != stored.len() + 1 || incoming.get(..stored.len()) != Some(stored.as_slice())
    {
        return Err(RepositoryError::Conflict);
    }
    Ok(())
}

#[cfg(test)]
#[path = "repository/tests.rs"]
mod tests;
