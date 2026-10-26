use tauri::Manager;

const QA_IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.newsletterqa";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct NewsletterStorageQaInfo {
    source_sha: &'static str,
    identifier: &'static str,
    data_path_isolated: bool,
}

#[tauri::command]
fn newsletter_storage_qa_info(
    app: tauri::AppHandle,
) -> Result<NewsletterStorageQaInfo, &'static str> {
    if app.config().identifier != QA_IDENTIFIER {
        return Err("Newsletter Storage QA identifier mismatch");
    }
    let data_path_isolated = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Newsletter Storage QA data path unavailable")?
        .to_string_lossy()
        .to_ascii_lowercase()
        .contains("newsletterqa");
    if !data_path_isolated {
        return Err("Newsletter Storage QA data path is not isolated");
    }
    Ok(NewsletterStorageQaInfo {
        source_sha: env!("NEWSLETTER_QA_SOURCE_SHA"),
        identifier: QA_IDENTIFIER,
        data_path_isolated,
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            newsletter_storage_qa_info,
            crate::newsletter::output_commands::newsletter_output_pick_target,
            crate::newsletter::output_commands::newsletter_output_save,
            crate::newsletter::output_commands::newsletter_output_last_success,
            crate::newsletter::output_commands::newsletter_output_recover
        ])
        .run(tauri::generate_context!())
        .expect("error while running Newsletter Storage QA");
}
