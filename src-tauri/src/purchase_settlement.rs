use std::path::Path;

use rust_xlsxwriter::{Format, Workbook};
use serde::Deserialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::purchase_helper::chrono_free_date;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseSettlementExportRow {
    number: usize,
    name: String,
    planned_quantity: Option<f64>,
    actual_quantity: Option<f64>,
    planned_unit_price: Option<f64>,
    actual_unit_price: Option<f64>,
    planned_amount: Option<f64>,
    actual_amount: Option<f64>,
    difference: Option<f64>,
    status: String,
    note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseSettlementSummary {
    planned_total: f64,
    actual_subtotal: f64,
    shipping_fee: f64,
    discount_amount: f64,
    final_actual: f64,
    difference: f64,
}

fn write_optional_number(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    row: u32,
    column: u16,
    value: Option<f64>,
    format: &Format,
) -> Result<(), String> {
    if let Some(number) = value {
        worksheet
            .write_number_with_format(row, column, number, format)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn write_purchase_settlement_workbook(
    path: &Path,
    rows: &[PurchaseSettlementExportRow],
    summary: &PurchaseSettlementSummary,
) -> Result<(), String> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet
        .set_name("구매결과")
        .map_err(|error| error.to_string())?;
    let header = Format::new().set_bold();
    let quantity_format = Format::new().set_num_format("0.##");
    let currency_format = Format::new().set_num_format("#,##0");
    let headers = [
        "번호",
        "품명",
        "품의수량",
        "실제수량",
        "품의단가",
        "실제단가",
        "품의금액",
        "실제금액",
        "차액",
        "상태",
        "비고",
    ];
    for (column, label) in headers.iter().enumerate() {
        worksheet
            .write_with_format(0, column as u16, *label, &header)
            .map_err(|error| error.to_string())?;
        worksheet
            .set_column_width(column as u16, if column == 1 { 28 } else { 14 })
            .map_err(|error| error.to_string())?;
    }
    for (index, item) in rows.iter().enumerate() {
        let row = index as u32 + 1;
        worksheet
            .write_number(row, 0, item.number as f64)
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(row, 1, &item.name)
            .map_err(|error| error.to_string())?;
        write_optional_number(worksheet, row, 2, item.planned_quantity, &quantity_format)?;
        write_optional_number(worksheet, row, 3, item.actual_quantity, &quantity_format)?;
        write_optional_number(worksheet, row, 4, item.planned_unit_price, &currency_format)?;
        write_optional_number(worksheet, row, 5, item.actual_unit_price, &currency_format)?;
        write_optional_number(worksheet, row, 6, item.planned_amount, &currency_format)?;
        write_optional_number(worksheet, row, 7, item.actual_amount, &currency_format)?;
        write_optional_number(worksheet, row, 8, item.difference, &currency_format)?;
        worksheet
            .write_string(row, 9, &item.status)
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(row, 10, &item.note)
            .map_err(|error| error.to_string())?;
    }
    let summary_start = rows.len() as u32 + 3;
    let summary_rows = [
        ("품의합계", summary.planned_total),
        ("실제상품합계", summary.actual_subtotal),
        ("배송비", summary.shipping_fee),
        ("할인", summary.discount_amount),
        ("최종결제금액", summary.final_actual),
        ("차액", summary.difference),
    ];
    for (offset, (label, value)) in summary_rows.iter().enumerate() {
        let row = summary_start + offset as u32;
        worksheet
            .write_string(row, 6, *label)
            .map_err(|error| error.to_string())?;
        worksheet
            .write_number_with_format(row, 7, *value, &currency_format)
            .map_err(|error| error.to_string())?;
    }
    workbook.save(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_purchase_settlement_export(
    app: AppHandle,
    rows: Vec<PurchaseSettlementExportRow>,
    summary: PurchaseSettlementSummary,
) -> Result<bool, String> {
    if rows.is_empty() {
        return Err("내보낼 구매결과가 없습니다.".to_owned());
    }
    let Some(file) = app
        .dialog()
        .file()
        .set_file_name(&format!("품의_구매결과_{}.xlsx", chrono_free_date()))
        .add_filter("Excel", &["xlsx"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = file.into_path().map_err(|error| error.to_string())?;
    write_purchase_settlement_workbook(&path, &rows, &summary)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use calamine::{open_workbook_auto, Reader};

    use super::*;

    #[test]
    fn settlement_xlsx_uses_numeric_cells_and_summary_rows() {
        let path =
            std::env::temp_dir().join(format!("purchase-settlement-{}.xlsx", std::process::id()));
        let rows = vec![PurchaseSettlementExportRow {
            number: 1,
            name: "Synthetic item".to_owned(),
            planned_quantity: Some(2.0),
            actual_quantity: Some(2.0),
            planned_unit_price: Some(12_000.0),
            actual_unit_price: Some(11_500.0),
            planned_amount: Some(24_000.0),
            actual_amount: Some(23_000.0),
            difference: Some(-1_000.0),
            status: "구매완료".to_owned(),
            note: String::new(),
        }];
        let summary = PurchaseSettlementSummary {
            planned_total: 24_000.0,
            actual_subtotal: 23_000.0,
            shipping_fee: 3_000.0,
            discount_amount: 1_000.0,
            final_actual: 25_000.0,
            difference: 1_000.0,
        };
        write_purchase_settlement_workbook(&path, &rows, &summary).unwrap();
        let mut workbook = open_workbook_auto(&path).unwrap();
        let range = workbook.worksheet_range("구매결과").unwrap();
        let _ = fs::remove_file(path);
        assert!(
            matches!(range.get((1, 3)), Some(calamine::Data::Float(value)) if (*value - 2.0).abs() < f64::EPSILON)
        );
        assert!(
            matches!(range.get((1, 7)), Some(calamine::Data::Float(value)) if (*value - 23_000.0).abs() < f64::EPSILON)
        );
        assert!(range
            .rows()
            .flatten()
            .any(|cell| cell.to_string() == "최종결제금액"));
    }
}
