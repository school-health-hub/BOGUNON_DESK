use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use super::{
    credential::ChatGptCredentialMutationState,
    http::ReqwestTransport,
    lifecycle::{self, BrowserOpener, ChatGptLifecycleError, SignInEnvironment},
    model::ChatGptConnectionStateDto,
    plan::{self, ChatGptModelDto, ChatGptPlanErrorDto, GenerateTextRequest},
    storage::{DefaultChatGptStorage, DpapiProtector},
};

#[derive(Default)]
pub(crate) struct ChatGptAuthState {
    active: AtomicBool,
}

#[tauri::command]
pub(crate) async fn chatgpt_list_models(
    app: AppHandle,
    state: State<'_, ChatGptCredentialMutationState>,
) -> Result<Vec<ChatGptModelDto>, ChatGptPlanErrorDto> {
    let storage = storage_for_app(&app).map_err(|_| ChatGptPlanErrorDto::storage())?;
    let client = plan::ReqwestPlanTransport::new()?;
    plan::list_models(
        &storage,
        &client,
        &state,
        unix_timestamp().map_err(|_| ChatGptPlanErrorDto::clock())?,
    )
    .await
}

#[tauri::command]
pub(crate) async fn chatgpt_generate_text(
    app: AppHandle,
    state: State<'_, ChatGptCredentialMutationState>,
    model: String,
    prompt: String,
) -> Result<String, ChatGptPlanErrorDto> {
    let storage = storage_for_app(&app).map_err(|_| ChatGptPlanErrorDto::storage())?;
    let client = plan::ReqwestPlanTransport::new()?;
    plan::generate_text(
        &storage,
        &client,
        &state,
        unix_timestamp().map_err(|_| ChatGptPlanErrorDto::clock())?,
        &GenerateTextRequest::new(model, prompt),
    )
    .await
}

impl ChatGptAuthState {
    fn begin_attempt(&self) -> Result<ActiveAttempt<'_>, ChatGptLifecycleError> {
        self.active
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| ActiveAttempt { state: self })
            .map_err(|_| ChatGptLifecycleError::Busy)
    }

    fn is_active(&self) -> bool {
        self.active.load(Ordering::SeqCst)
    }
}

struct ActiveAttempt<'a> {
    state: &'a ChatGptAuthState,
}

impl Drop for ActiveAttempt<'_> {
    fn drop(&mut self) {
        self.state.active.store(false, Ordering::SeqCst);
    }
}

struct SystemBrowserOpener {
    app: AppHandle,
}

impl BrowserOpener for SystemBrowserOpener {
    fn open(&self, authorization_url: &str) -> Result<(), ChatGptLifecycleError> {
        self.app
            .opener()
            .open_url(authorization_url, None::<&str>)
            .map_err(|_| ChatGptLifecycleError::BrowserOpen)
    }
}

#[tauri::command]
pub(crate) fn chatgpt_get_connection_state(
    app: AppHandle,
    state: State<'_, ChatGptAuthState>,
) -> Result<ChatGptConnectionStateDto, String> {
    let storage = storage_for_app(&app)?;
    lifecycle::connection_state(&storage, state.is_active(), None)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn chatgpt_start_sign_in(
    app: AppHandle,
    state: State<'_, ChatGptAuthState>,
    credential_state: State<'_, ChatGptCredentialMutationState>,
) -> Result<ChatGptConnectionStateDto, String> {
    let _attempt = state.begin_attempt().map_err(|error| error.to_string())?;
    let storage = storage_for_app(&app)?;
    let transport =
        ReqwestTransport::new().map_err(|error| ChatGptLifecycleError::from(error).to_string())?;
    let opener = SystemBrowserOpener { app };
    let environment = SignInEnvironment::new(
        &storage,
        &transport,
        &opener,
        super::loopback::DEFAULT_CALLBACK_TIMEOUT,
        unix_timestamp()?,
        &credential_state,
    );
    lifecycle::sign_in(environment)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn chatgpt_disconnect(
    app: AppHandle,
    state: State<'_, ChatGptAuthState>,
    credential_state: State<'_, ChatGptCredentialMutationState>,
) -> Result<ChatGptConnectionStateDto, String> {
    let _attempt = state.begin_attempt().map_err(|error| error.to_string())?;
    let storage = storage_for_app(&app)?;
    let transport =
        ReqwestTransport::new().map_err(|error| ChatGptLifecycleError::from(error).to_string())?;
    lifecycle::disconnect(&storage, &transport, &credential_state)
        .await
        .map_err(|error| error.to_string())
}

fn storage_for_app(app: &AppHandle) -> Result<DefaultChatGptStorage, String> {
    app.path()
        .app_local_data_dir()
        .map(|root| DefaultChatGptStorage::new(&root, DpapiProtector))
        .map_err(|_| ChatGptLifecycleError::StoragePath.to_string())
}

fn unix_timestamp() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|_| ChatGptLifecycleError::Clock.to_string())
}

#[cfg(test)]
#[path = "commands/tests.rs"]
mod tests;
