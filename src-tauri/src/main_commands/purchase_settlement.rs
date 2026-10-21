//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn save_purchase_settlement_export(
    caller: tauri::Webview,
    app: AppHandle,
    rows: Vec<PurchaseSettlementExportRow>,
    summary: PurchaseSettlementSummary,
) -> Result<bool, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::save_purchase_settlement_export(app, rows, summary)
    })
}
