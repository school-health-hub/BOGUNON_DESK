//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn fetch_bogunon_weather(
    caller: tauri::Webview,
    app: AppHandle,
    access_token: String,
) -> Result<WeatherResponse, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::fetch_bogunon_weather(app, access_token).await
    })
    .await
}
