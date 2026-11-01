// Selected from fec6deb78502b6101a7efd328ab4b0bb57fe77be:src-tauri/src/purchase_settlement.rs; host path write becomes a buffer return.

use rust_xlsxwriter::{Format, Workbook};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};


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

const HEADERS: [&str; 11] = [
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

fn row_cells(row: &PurchaseSettlementExportRow) -> Vec<Value> {
    vec![
        json!(row.number as f64),
        json!(row.name),
        json!(row.planned_quantity),
        json!(row.actual_quantity),
        json!(row.planned_unit_price),
        json!(row.actual_unit_price),
        json!(row.planned_amount),
        json!(row.actual_amount),
        json!(row.difference),
        json!(row.status),
        json!(row.note),
    ]
}

fn summary_cells(summary: &PurchaseSettlementSummary) -> Vec<(String, f64)> {
    [
        ("품의합계", summary.planned_total),
        ("실제상품합계", summary.actual_subtotal),
        ("배송비", summary.shipping_fee),
        ("할인", summary.discount_amount),
        ("최종결제금액", summary.final_actual),
        ("차액", summary.difference),
    ]
    .into_iter()
    .map(|(label, value)| (label.to_owned(), value))
    .collect()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseSettlementPreview {
    headers: Vec<String>,
    rows: Vec<Vec<Value>>,
    summary_rows: Vec<(String, f64)>,
}

pub fn preview_purchase_settlement_export(
    rows: Vec<PurchaseSettlementExportRow>,
    summary: PurchaseSettlementSummary,
) -> Result<PurchaseSettlementPreview, String> {
    if rows.is_empty() {
        return Err("내보낼 구매결과가 없습니다.".to_owned());
    }
    Ok(PurchaseSettlementPreview {
        headers: HEADERS.map(str::to_owned).to_vec(),
        rows: rows.iter().map(row_cells).collect(),
        summary_rows: summary_cells(&summary),
    })
}

pub(crate) fn settlement_bytes(
    rows: &[PurchaseSettlementExportRow],
    summary: &PurchaseSettlementSummary,
) -> Result<Vec<u8>, String> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet
        .set_name("구매결과")
        .map_err(|error| error.to_string())?;
    let header = Format::new().set_bold();
    let quantity_format = Format::new().set_num_format("0.##");
    let currency_format = Format::new().set_num_format("#,##0");
    for (column, label) in HEADERS.iter().enumerate() {
        worksheet
            .write_with_format(0, column as u16, *label, &header)
            .map_err(|error| error.to_string())?;
        worksheet
            .set_column_width(column as u16, if column == 1 { 28 } else { 14 })
            .map_err(|error| error.to_string())?;
    }
    for (index, item) in rows.iter().enumerate() {
        let row = index as u32 + 1;
        for (column, cell) in row_cells(item).iter().enumerate() {
            if let Some(number) = cell.as_f64() {
                if column == 0 {
                    worksheet
                        .write_number(row, column as u16, number)
                        .map_err(|error| error.to_string())?;
                } else {
                    let format = if column == 2 || column == 3 {
                        &quantity_format
                    } else {
                        &currency_format
                    };
                    worksheet
                        .write_number_with_format(row, column as u16, number, format)
                        .map_err(|error| error.to_string())?;
                }
            } else if let Some(text) = cell.as_str() {
                worksheet
                    .write_string(row, column as u16, text)
                    .map_err(|error| error.to_string())?;
            }
        }
    }
    let summary_start = rows.len() as u32 + 3;
    let summary_rows = summary_cells(summary);
    for (offset, (label, value)) in summary_rows.iter().enumerate() {
        let row = summary_start + offset as u32;
        worksheet
            .write_string(row, 6, label)
            .map_err(|error| error.to_string())?;
        worksheet
            .write_number_with_format(row, 7, *value, &currency_format)
            .map_err(|error| error.to_string())?;
    }
    workbook.save_to_buffer().map_err(|error| error.to_string())
}


#[cfg(test)]
mod tests {
 use super::*;
 #[test]
 fn original_settlement_cells_summary_and_literal_strings(){
  let rows:Vec<PurchaseSettlementExportRow>=serde_json::from_value(json!([{"number":1,"name":"=SUM(1,2)","plannedQuantity":2,"actualQuantity":1.5,"plannedUnitPrice":12000,"actualUnitPrice":11500,"plannedAmount":24000,"actualAmount":17250,"difference":-6750,"status":"일부구매","note":"합성 비고"},{"number":2,"name":"합성 취소","plannedQuantity":1,"actualQuantity":null,"plannedUnitPrice":1000,"actualUnitPrice":null,"plannedAmount":1000,"actualAmount":null,"difference":null,"status":"취소","note":""}])).unwrap();
  let summary:PurchaseSettlementSummary=serde_json::from_value(json!({"plannedTotal":25000,"actualSubtotal":17250,"shippingFee":3000,"discountAmount":1000,"finalActual":19250,"difference":-5750})).unwrap();
  let bytes=settlement_bytes(&rows,&summary).unwrap();let preview=serde_json::to_value(preview_purchase_settlement_export(rows,summary).unwrap()).unwrap();crate::specialized::verify(&bytes,&preview).unwrap();
  use calamine::Reader;let mut workbook:calamine::Xlsx<_>=calamine::Xlsx::new(std::io::Cursor::new(&bytes)).unwrap();assert_eq!(workbook.sheet_names(),&["구매결과"]);let table=workbook.worksheet_range("구매결과").unwrap();assert!(matches!(table.get((1,3)),Some(calamine::Data::Float(v)) if *v==1.5));assert_eq!(table.get((1,1)).unwrap().to_string(),"=SUM(1,2)");assert!(matches!(table.get((1,1)),Some(calamine::Data::String(_))));
  let mut zip=zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();use std::io::Read;let mut styles=String::new();zip.by_name("xl/styles.xml").unwrap().read_to_string(&mut styles).unwrap();assert!(styles.contains("0.##"));assert!(styles.contains("#,##0"));
 }
}
