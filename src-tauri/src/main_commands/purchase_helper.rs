//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn pick_and_analyze_purchase_files(
    caller: tauri::Webview,
    app: AppHandle,
    state: tauri::State<'_, PurchaseHelperState>,
    templates: Vec<ImportTemplate>,
) -> Result<AnalysisRequestResult, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::pick_and_analyze_purchase_files(app, state, templates).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn analyze_purchase_paths(
    caller: tauri::Webview,
    paths: Vec<String>,
    templates: Vec<ImportTemplate>,
) -> Result<AnalysisResult, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::analyze_purchase_paths(paths, templates).await
    })
    .await
}

#[tauri::command]
pub(crate) fn apply_purchase_column_mapping(
    caller: tauri::Webview,
    candidate: MappingCandidate,
    selected_header_row: usize,
    mapping: HashMap<String, usize>,
) -> Result<AnalysisResult, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::apply_purchase_column_mapping(candidate, selected_header_row, mapping)
    })
}

#[tauri::command]
pub(crate) fn save_purchase_export(
    caller: tauri::Webview,
    app: AppHandle,
    format: String,
    items: Vec<PurchaseItem>,
    columns: Vec<String>,
) -> Result<bool, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::save_purchase_export(app, format, items, columns)
    })
}

#[tauri::command]
pub(crate) fn save_purchase_edufine_export(
    caller: tauri::Webview,
    app: AppHandle,
    items: Vec<PurchaseItem>,
) -> Result<bool, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::save_purchase_edufine_export(app, items))
}

#[tauri::command]
pub(crate) fn set_purchase_helper_active(
    caller: tauri::Webview,
    state: tauri::State<'_, PurchaseHelperState>,
    active: bool,
    templates: Vec<ImportTemplate>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        Ok::<(), String>(super::set_purchase_helper_active(state, active, templates))
    })
}

#[tauri::command]
pub(crate) fn invalidate_purchase_helper_analysis(
    caller: tauri::Webview,
    state: tauri::State<'_, PurchaseHelperState>,
) -> Result<u64, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        Ok::<u64, String>(super::invalidate_purchase_helper_analysis(state))
    })
}
