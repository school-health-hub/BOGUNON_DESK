use serde_json::Value;
use tauri::{AppHandle, Manager};

use super::{model::ProjectDocument, repository::NewsletterRepository};

fn repository(app: &AppHandle) -> Result<NewsletterRepository, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Newsletter 프로젝트 저장소를 사용할 수 없습니다.".to_owned())?;
    Ok(NewsletterRepository::new(&root.join("newsletter-studio")))
}

#[tauri::command]
pub(crate) fn newsletter_project_create(
    app: AppHandle,
    project: Value,
) -> Result<ProjectDocument, String> {
    repository(&app)?
        .create(project)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn newsletter_project_get(
    app: AppHandle,
    project_id: String,
) -> Result<ProjectDocument, String> {
    repository(&app)?
        .get(&project_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn newsletter_project_save(
    app: AppHandle,
    project: Value,
) -> Result<ProjectDocument, String> {
    repository(&app)?
        .save(project)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn newsletter_project_update(
    app: AppHandle,
    project: Value,
) -> Result<ProjectDocument, String> {
    repository(&app)?
        .save(project)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn newsletter_project_clone(
    app: AppHandle,
    source_project_id: String,
    new_project_id: String,
    created_at: String,
) -> Result<ProjectDocument, String> {
    repository(&app)?
        .clone_project(&source_project_id, &new_project_id, &created_at)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn newsletter_project_list_revisions(
    app: AppHandle,
    project_id: String,
) -> Result<Value, String> {
    repository(&app)?
        .history(&project_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn newsletter_project_restore(
    app: AppHandle,
    project_id: String,
    revision: u64,
    restored_at: String,
) -> Result<ProjectDocument, String> {
    repository(&app)?
        .restore(&project_id, revision, &restored_at)
        .map_err(|error| error.to_string())
}
