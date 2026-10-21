//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn fetch_bogunon_meal(
    caller: tauri::Webview,
    app: AppHandle,
    access_token: String,
    date: String,
) -> Result<MealResponse, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::fetch_bogunon_meal(app, access_token, date).await
    })
    .await
}
