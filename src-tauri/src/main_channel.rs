//! Public invoke channels are bound by Tauri to the actual invoking Webview.
use crate::{
    main_caller::CommandError,
    main_events::{MainEvents, TransportFrame},
};
use tauri::{ipc::Channel, AppHandle, Manager};

#[tauri::command]
pub(crate) fn register_main_channel(
    caller: tauri::Webview,
    app: AppHandle,
    channel: Channel<TransportFrame>,
) -> Result<u64, CommandError<String>> {
    crate::main_caller::run(&caller, || {
        app.try_state::<MainEvents>()
            .ok_or_else(|| "Main event destination unavailable".to_owned())?
            .register_channel(&app, channel)
    })
}
#[tauri::command]
pub(crate) fn unregister_main_channel(
    caller: tauri::Webview,
    app: AppHandle,
    registration: u64,
) -> Result<(), CommandError<String>> {
    crate::main_caller::run(&caller, || {
        app.try_state::<MainEvents>()
            .ok_or_else(|| "Main event destination unavailable".to_owned())?
            .unregister_channel(&app, registration)
    })
}
