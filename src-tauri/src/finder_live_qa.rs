use crate::{
    chatgpt::{
        credential::ChatGptCredentialMutationState,
        live_qa::ReadOnlyStorage,
        model::ChatGptConnectionStateDto,
        plan::{self, ChatGptModelDto, ChatGptPlanErrorDto, GenerateTextRequest},
    },
    education_video,
};
use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
const QA_IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.finderliveqa5";
const BASE_SHA: &str = "eed15c31a27e983a36fea2434fcf26dfbbebf4d1";
fn qa_root(app: &AppHandle) -> Result<PathBuf, String> {
    if app.config().identifier != QA_IDENTIFIER {
        return Err("Finder Live QA identifier mismatch".into());
    }
    app.path()
        .app_local_data_dir()
        .map_err(|_| "Finder QA storage path unavailable".into())
}
fn storage(app: &AppHandle) -> Result<ReadOnlyStorage, String> {
    let root = qa_root(app)?;
    let parent = root
        .parent()
        .ok_or("Finder QA storage parent unavailable")?;
    Ok(ReadOnlyStorage::new(
        &parent.join("kr.sungandi.schoolhealthdesk"),
    ))
}
fn now() -> Result<u64, ChatGptPlanErrorDto> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .map_err(|_| ChatGptPlanErrorDto::clock())
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    identifier: &'static str,
    source_sha: &'static str,
    base_sha: &'static str,
    read_only_auth: bool,
    library_isolated: bool,
    prior_evidence_receipts_verified: bool,
    prepared_slot: u8,
    search_slot_five_approved: bool,
    search_slot_five_used: bool,
    search_tool_choice: &'static str,
    sse_diagnostics_version: u8,
    external_dispatch_enabled: bool,
}
#[tauri::command]
fn finder_live_qa_metadata(app: AppHandle) -> Result<Metadata, String> {
    let root = qa_root(&app)?;
    Ok(Metadata {
        identifier: QA_IDENTIFIER,
        source_sha: env!("BOGUNON_QA_SOURCE_SHA"),
        base_sha: BASE_SHA,
        read_only_auth: true,
        library_isolated: true,
        prior_evidence_receipts_verified: true,
        prepared_slot: 5,
        search_slot_five_approved: plan::live_qa::fifth_approved(&root),
        search_slot_five_used: root.join("search-attempt-5.receipt").exists(),
        search_tool_choice: "auto",
        sse_diagnostics_version: 3,
        external_dispatch_enabled: false,
    })
}
#[tauri::command]
fn chatgpt_get_connection_state(app: AppHandle) -> Result<ChatGptConnectionStateDto, String> {
    let root = qa_root(&app)?;
    if !plan::live_qa::fifth_approved(&root) {
        return Err("QA5 actual search is not approved".into());
    }
    storage(&app)?.connection_state()
}
#[tauri::command]
async fn chatgpt_list_models(
    app: AppHandle,
    state: State<'_, ChatGptCredentialMutationState>,
) -> Result<Vec<ChatGptModelDto>, ChatGptPlanErrorDto> {
    let root = qa_root(&app).map_err(|_| ChatGptPlanErrorDto::storage())?;
    if !plan::live_qa::fifth_approved(&root) {
        return Err(ChatGptPlanErrorDto {
            code: plan::ChatGptPlanErrorCode::PermissionDenied,
            message: "QA5 실제 검색은 아직 승인되지 않았습니다.",
        });
    }
    let storage = storage(&app).map_err(|_| ChatGptPlanErrorDto::storage())?;
    plan::list_models(
        &storage,
        &plan::live_qa::ReadOnlyTransport::models(&root)?,
        &state,
        now()?,
    )
    .await
}
#[tauri::command]
async fn chatgpt_search_web(
    app: AppHandle,
    state: State<'_, ChatGptCredentialMutationState>,
    model: String,
    prompt: String,
) -> Result<plan::web_search::WebSearchResult, ChatGptPlanErrorDto> {
    use sha2::{Digest, Sha256};
    let digest = format!("{:x}", Sha256::digest(prompt.as_bytes()));
    if !plan::live_qa::approved_search(&model, prompt.len(), &digest) {
        return Err(ChatGptPlanErrorDto {
            code: plan::ChatGptPlanErrorCode::PermissionDenied,
            message: "승인된 검색 조건과 일치하지 않습니다.",
        });
    }
    let root = qa_root(&app).map_err(|_| ChatGptPlanErrorDto::storage())?;
    if !plan::live_qa::fifth_approved(&root) {
        return Err(ChatGptPlanErrorDto {
            code: plan::ChatGptPlanErrorCode::PermissionDenied,
            message: "QA5 실제 검색은 아직 승인되지 않았습니다.",
        });
    }
    let storage = storage(&app).map_err(|_| ChatGptPlanErrorDto::storage())?;
    let result = plan::web_search::search_web(
        &storage,
        &plan::live_qa::ReadOnlyTransport::search(&root)?,
        &state,
        now()?,
        &GenerateTextRequest::new(model, prompt),
    )
    .await;
    let code = match &result {
        Ok(_) => serde_json::json!({"stage":"nativeSearchAccepted","code":"success"}),
        Err(error) => serde_json::json!({"stage":"nativeSearchRejected","code":error.code}),
    };
    if root.join("search-attempt-5.receipt").is_file() {
        plan::live_qa::diagnostics::write_new(&root.join("search-5-native-result.json"), &code)
            .map_err(|_| ChatGptPlanErrorDto::storage())?;
    }
    let result = result?;
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join("search-success-5.receipt"))
        .map_err(|_| ChatGptPlanErrorDto::storage())?
        .sync_all()
        .map_err(|_| ChatGptPlanErrorDto::storage())?;
    Ok(result)
}
#[tauri::command]
async fn chatgpt_generate_text(
    _app: AppHandle,
    _state: State<'_, ChatGptCredentialMutationState>,
    _model: String,
    _prompt: String,
) -> Result<String, ChatGptPlanErrorDto> {
    Err(ChatGptPlanErrorDto {
        code: plan::ChatGptPlanErrorCode::PermissionDenied,
        message: "QA5에서는 추가 AI 추천 이유 요청을 허용하지 않습니다.",
    })
}
pub fn run() {
    let result = tauri::Builder::default()
        .manage(ChatGptCredentialMutationState::default())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let root = qa_root(app.handle()).map_err(std::io::Error::other)?;
            std::fs::create_dir_all(root)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            finder_live_qa_metadata,
            chatgpt_get_connection_state,
            chatgpt_list_models,
            chatgpt_search_web,
            chatgpt_generate_text,
            education_video::education_video_library_load,
            education_video::education_video_library_save,
            education_video::education_video_library_import,
            education_video::education_video_library_export,
            education_video::education_video_library_recover,
            education_video::education_video_library_metadata_delete,
            education_video::education_video_library_metadata_refresh
        ])
        .run(tauri::generate_context!());
    if result.is_err() {
        eprintln!("Finder Live QA could not start");
    }
}
