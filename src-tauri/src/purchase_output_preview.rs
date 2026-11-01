use serde::Serialize;
use serde_json::Value;

use crate::purchase_helper::{build_purchase_preview, PurchaseItem};

#[derive(Debug, Serialize)]
pub struct PurchaseOutputPreview {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<Value>>,
}

#[tauri::command]
pub fn preview_purchase_export(
    format: String,
    items: Vec<PurchaseItem>,
    columns: Vec<String>,
) -> Result<PurchaseOutputPreview, String> {
    build_purchase_preview(&format, &items, &columns, true)
}
