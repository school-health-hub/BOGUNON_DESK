use super::{
    error::RepositoryError,
    io::{atomic_write, quarantine_move, read_document},
    paths::ProjectPaths,
};
use std::fs;

pub(super) fn reconcile_interrupted_commit(paths: &ProjectPaths) -> Result<(), RepositoryError> {
    if !paths.current.exists() {
        return reconcile_initial_create(paths);
    }
    let Ok(current) = read_document(&paths.current) else {
        return Ok(());
    };
    let Ok(lkg) = read_document(&paths.last_known_good) else {
        return Ok(());
    };
    if lkg.project_revision == current.project_revision + 1 {
        let revision = paths
            .revisions
            .join(format!("{}.json", lkg.project_revision));
        let revision_bytes = fs::read(revision).map_err(|_| RepositoryError::Corrupted)?;
        let lkg_bytes = fs::read(&paths.last_known_good).map_err(|_| RepositoryError::Corrupted)?;
        if revision_bytes != lkg_bytes {
            return Err(RepositoryError::Corrupted);
        }
        return atomic_write(&paths.current, &lkg_bytes);
    }
    if current.project_revision == lkg.project_revision + 1 {
        let bytes = fs::read(&paths.current).map_err(|_| RepositoryError::Corrupted)?;
        return atomic_write(&paths.last_known_good, &bytes);
    }
    if current.project_revision != lkg.project_revision {
        return Err(RepositoryError::Corrupted);
    }
    let next = paths
        .revisions
        .join(format!("{}.json", current.project_revision + 1));
    if next.exists() {
        let prepared = read_document(&next)?;
        if prepared.project_revision != current.project_revision + 1 {
            return Err(RepositoryError::Corrupted);
        }
        quarantine_move(&next, &paths.quarantine)?;
    }
    Ok(())
}

fn reconcile_initial_create(paths: &ProjectPaths) -> Result<(), RepositoryError> {
    let revision = paths.revisions.join("1.json");
    match (revision.exists(), paths.last_known_good.exists()) {
        (false, false) => Ok(()),
        (true, false) => {
            let prepared = read_document(&revision)?;
            if prepared.project_revision != 1 {
                return Err(RepositoryError::Corrupted);
            }
            quarantine_move(&revision, &paths.quarantine)
        }
        (true, true) => {
            let prepared = read_document(&revision)?;
            let lkg = read_document(&paths.last_known_good)?;
            if prepared.project_revision != 1 || lkg.project_revision != 1 {
                return Err(RepositoryError::Corrupted);
            }
            let revision_bytes = fs::read(revision).map_err(|_| RepositoryError::Corrupted)?;
            let lkg_bytes =
                fs::read(&paths.last_known_good).map_err(|_| RepositoryError::Corrupted)?;
            if revision_bytes != lkg_bytes {
                return Err(RepositoryError::Corrupted);
            }
            atomic_write(&paths.current, &lkg_bytes)
        }
        (false, true) => Err(RepositoryError::Corrupted),
    }
}
