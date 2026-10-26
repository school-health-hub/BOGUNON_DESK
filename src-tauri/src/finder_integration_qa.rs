use crate::education_video;
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

const QA_IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.finderintegrationqa";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QaInfo {
    identifier: String,
    source_sha: &'static str,
    local_data: PathBuf,
    integrations_disabled: bool,
}

fn local_data(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if app.config().identifier != QA_IDENTIFIER {
        return Err("F-10 identity mismatch".to_owned());
    }
    app.path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn finder_integration_qa_info(app: tauri::AppHandle) -> Result<QaInfo, String> {
    Ok(QaInfo {
        identifier: app.config().identifier.clone(),
        source_sha: env!("BOGUNON_FINDER_INTEGRATION_QA_SOURCE_SHA"),
        local_data: local_data(&app)?,
        integrations_disabled: true,
    })
}

pub fn run() {
    let context = tauri::generate_context!();
    assert_eq!(context.config().identifier, QA_IDENTIFIER);
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            finder_integration_qa_info,
            education_video::education_video_library_load,
            education_video::education_video_library_save,
            education_video::education_video_library_import,
            education_video::education_video_library_export,
            education_video::education_video_library_recover,
            education_video::education_video_library_metadata_delete,
            education_video::education_video_library_metadata_refresh,
        ])
        .run(context)
        .expect("Finder integration F-10 startup failed");
}
