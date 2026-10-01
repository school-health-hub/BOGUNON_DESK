use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
};

use calamine::{open_workbook, open_workbook_auto, Data, DataType, Reader, Xlsx, XlsxError};
use encoding_rs::EUC_KR;
use pdf_extract::{Document, MediaBox, OutputDev, OutputError, Transform};
use rust_xlsxwriter::{Format, Workbook};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use zip::ZipArchive;

const MAX_FILES: usize = 10;
const MAX_FILE_BYTES: u64 = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 30 * 1024 * 1024;
const MAX_ROWS: usize = 500;
const MAX_PDF_PAGES: usize = 50;
const MAX_PDF_TEXT_BYTES: usize = 2 * 1024 * 1024;
// XLSX is a ZIP container. These limits are deliberately much larger than a normal
// purchase workbook, while bounding Calamine's decompression work before it starts.
const MAX_XLSX_ENTRIES: usize = 4_096;
const MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES: u64 = 128 * 1024 * 1024;
const MAX_XLSX_UNCOMPRESSED_BYTES: u64 = 256 * 1024 * 1024;
const MAX_XLSX_EXPANSION_RATIO: u64 = 1_000;
const MIN_XLSX_RATIO_CHECK_BYTES: u64 = 32 * 1024 * 1024;
const ZIP_EOCD_MIN_BYTES: usize = 22;
const ZIP_MAX_COMMENT_BYTES: usize = u16::MAX as usize;
// Purchase workbooks normally contain a handful of narrow sheets. These limits
// leave ample room for explanatory/header rows while bounding Calamine's XLS
// Range and the app-owned XLSX String materialization retained for analysis.
const MAX_SPREADSHEET_SHEETS: usize = 32;
const MAX_SPREADSHEET_RAW_ROWS: usize = 10_000;
const MAX_SPREADSHEET_COLUMNS: usize = 256;
const MAX_SPREADSHEET_CELLS_PER_SHEET: usize = 250_000;
const MAX_SPREADSHEET_CELLS_TOTAL: usize = 500_000;
const SPREADSHEET_RESOURCE_LIMIT_MESSAGE: &str =
    "스프레드시트가 너무 크거나 복잡하여 가져올 수 없습니다.";
static CANDIDATE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseItem {
    id: String,
    selected: bool,
    name: String,
    specification: String,
    quantity: Option<f64>,
    unit_price: Option<f64>,
    imported_amount: Option<f64>,
    vendor: String,
    note: String,
    budget_item: String,
    source_name: Option<String>,
    #[serde(default)]
    issues: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceSummary {
    source_name: String,
    status: String,
    row_count: usize,
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    candidate_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportTemplate {
    id: String,
    name: String,
    header_signature: Vec<String>,
    mapping: HashMap<String, usize>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderOption {
    row_index: usize,
    headers: Vec<String>,
    signature: Vec<String>,
    recommended: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingCandidate {
    id: String,
    source_name: String,
    sheet_name: String,
    rows: Vec<Vec<String>>,
    header_options: Vec<HeaderOption>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    items: Vec<PurchaseItem>,
    sources: Vec<SourceSummary>,
    candidates: Vec<MappingCandidate>,
}

fn normalize_header(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .filter(|character| character.is_alphanumeric())
        .collect()
}
fn field_for(value: &str) -> Option<&'static str> {
    match normalize_header(value).as_str() {
        "품명" | "품목명" | "물품명" | "상품명" | "제품명" | "상품" | "제품" | "내역" | "name"
        | "itemname" => Some("name"),
        "규격" | "사양" | "옵션" | "모델" | "모델명" | "spec" | "specification" => {
            Some("specification")
        }
        "수량" | "주문수량" | "개수" | "qty" => Some("quantity"),
        "단가" | "가격" | "판매가" | "공급단가" | "unitprice" => Some("unitPrice"),
        "금액" | "합계금액" | "공급가액" | "소계" | "총액" | "amount" => {
            Some("amount")
        }
        "구매처" | "업체" | "업체명" | "공급업체" | "공급자" | "판매처" | "상호" => {
            Some("vendor")
        }
        "비고" | "메모" | "remark" | "remarks" => Some("note"),
        "예산항목" | "예산" | "예산과목" | "세부사업" | "비목" => {
            Some("budgetItem")
        }
        _ => None,
    }
}
const IMPORT_FIELDS: [&str; 8] = [
    "name",
    "specification",
    "quantity",
    "unitPrice",
    "amount",
    "vendor",
    "note",
    "budgetItem",
];
fn normalize_mapping(
    mapping: &HashMap<String, usize>,
) -> Result<HashMap<&'static str, usize>, String> {
    let mut normalized = HashMap::new();
    let mut used = HashSet::new();
    for field in IMPORT_FIELDS {
        if let Some(index) = mapping.get(field) {
            if !used.insert(*index) {
                return Err("같은 원본 열을 여러 항목에 연결할 수 없습니다.".to_owned());
            }
            normalized.insert(field, *index);
        }
    }
    if !normalized.contains_key("name") {
        return Err("품명에 연결할 원본 열을 선택해 주세요.".to_owned());
    }
    Ok(normalized)
}
fn signature_for(headers: &[String]) -> Vec<String> {
    let mut signature: Vec<String> = headers
        .iter()
        .map(|value| normalize_header(value))
        .collect();
    while signature.last().is_some_and(String::is_empty) {
        signature.pop();
    }
    signature
}
fn generic_header_options(rows: &[Vec<String>]) -> Vec<HeaderOption> {
    let mut scored = Vec::new();
    for (row_index, row) in rows.iter().take(30).enumerate() {
        let signature = signature_for(row);
        let non_empty = signature.iter().filter(|value| !value.is_empty()).count();
        if non_empty < 2 {
            continue;
        }
        let consistent = rows
            .iter()
            .skip(row_index + 1)
            .take(5)
            .filter(|next| {
                next.iter().filter(|value| !value.trim().is_empty()).count() >= 2
                    && next.len() >= signature.len()
            })
            .count();
        if consistent == 0 {
            continue;
        }
        let alias_bonus = row
            .iter()
            .filter(|value| field_for(value).is_some())
            .count();
        scored.push((
            row_index,
            non_empty + consistent + alias_bonus * 2,
            row.clone(),
            signature,
        ));
    }
    scored.sort_by(|left, right| right.1.cmp(&left.1).then(left.0.cmp(&right.0)));
    scored
        .into_iter()
        .take(5)
        .enumerate()
        .map(|(index, (row_index, _, headers, signature))| HeaderOption {
            row_index,
            headers,
            signature,
            recommended: index == 0,
        })
        .collect()
}
fn parse_number(value: &str) -> Option<f64> {
    let cleaned: String = value
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
        .collect();
    if cleaned.is_empty() {
        None
    } else {
        cleaned.parse().ok()
    }
}
fn is_total_row(name: &str) -> bool {
    matches!(
        normalize_header(name).as_str(),
        "합계" | "총계" | "소계" | "total" | "grandtotal"
    )
}
fn parse_rows(rows: &[Vec<String>], source: &str) -> Result<Vec<PurchaseItem>, String> {
    let mut best: Option<(usize, HashMap<&'static str, usize>, usize)> = None;
    for (index, row) in rows.iter().take(30).enumerate() {
        let map: HashMap<_, _> = row
            .iter()
            .enumerate()
            .filter_map(|(column, value)| field_for(value).map(|field| (field, column)))
            .collect();
        let numeric = map.contains_key("quantity")
            || map.contains_key("unitPrice")
            || map.contains_key("amount");
        if map.len() >= 3 || (map.contains_key("name") && numeric) {
            let score = map.len();
            if best.as_ref().is_none_or(|(_, _, current)| score > *current) {
                best = Some((index, map, score));
            }
        }
    }
    let (header, columns, _) =
        best.ok_or_else(|| "품목 표의 머리글을 찾지 못했습니다.".to_owned())?;
    parse_rows_with_columns(rows, source, header, &columns)
}
fn parse_rows_with_columns(
    rows: &[Vec<String>],
    source: &str,
    header: usize,
    columns: &HashMap<&'static str, usize>,
) -> Result<Vec<PurchaseItem>, String> {
    let header_signature = rows
        .get(header)
        .map_or_else(Vec::new, |row| signature_for(row));
    let get = |row: &Vec<String>, field: &str| {
        columns
            .get(field)
            .and_then(|index| row.get(*index))
            .map_or("", String::as_str)
            .trim()
            .to_owned()
    };
    let mut items = Vec::new();
    for (offset, row) in rows.iter().skip(header + 1).enumerate() {
        if row.iter().all(|value| value.trim().is_empty()) {
            continue;
        }
        if !header_signature.is_empty() && signature_for(row) == header_signature {
            continue;
        }
        let name = get(row, "name");
        if is_total_row(&name) {
            continue;
        }
        let quantity_raw = get(row, "quantity");
        let unit_price_raw = get(row, "unitPrice");
        let quantity = parse_number(&quantity_raw);
        let unit_price = parse_number(&unit_price_raw);
        let imported_amount = parse_number(&get(row, "amount"));
        if name.is_empty()
            && quantity.is_none()
            && unit_price.is_none()
            && imported_amount.is_none()
        {
            continue;
        }
        let mut issues = Vec::new();
        if name.is_empty() {
            issues.push("missingName".to_owned());
        }
        if (!quantity_raw.is_empty() && quantity.is_none())
            || quantity.is_some_and(|value| value <= 0.0)
        {
            issues.push("invalidQuantity".to_owned());
        }
        if (!unit_price_raw.is_empty() && unit_price.is_none())
            || unit_price.is_some_and(|value| value < 0.0)
        {
            issues.push("invalidUnitPrice".to_owned());
        }
        if let (Some(quantity), Some(unit_price), Some(amount)) =
            (quantity, unit_price, imported_amount)
        {
            if ((quantity * unit_price).round() - amount).abs() >= 1.0 {
                issues.push("amountMismatch".to_owned());
            }
        }
        items.push(PurchaseItem {
            id: format!("import-{}-{}", items.len(), offset),
            selected: true,
            name,
            specification: get(row, "specification"),
            quantity,
            unit_price,
            imported_amount,
            vendor: get(row, "vendor"),
            note: get(row, "note"),
            budget_item: get(row, "budgetItem"),
            source_name: Some(source.to_owned()),
            issues,
        });
    }
    if items.len() > MAX_ROWS {
        return Err("파일당 품목은 최대 500개까지 가져올 수 있습니다.".to_owned());
    }
    Ok(items)
}
fn csv_rows(path: &Path) -> Result<Vec<Vec<String>>, String> {
    let bytes = fs::read(path).map_err(|_| "파일을 읽지 못했습니다.".to_owned())?;
    let text = match std::str::from_utf8(bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes))
    {
        Ok(value) => value.to_owned(),
        Err(_) => EUC_KR.decode(&bytes).0.into_owned(),
    };
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(text.as_bytes());
    reader
        .records()
        .map(|record| {
            record
                .map(|values| values.iter().map(str::to_owned).collect())
                .map_err(|_| "CSV를 읽지 못했습니다.".to_owned())
        })
        .collect()
}

#[derive(Clone, Copy)]
struct XlsxEntryMetadata {
    compressed_bytes: u64,
    uncompressed_bytes: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum XlsxPreflightError {
    InvalidArchive,
    ResourceLimit,
}

impl XlsxPreflightError {
    const fn user_message(self) -> &'static str {
        match self {
            Self::InvalidArchive => "스프레드시트를 읽지 못했습니다.",
            Self::ResourceLimit => "스프레드시트가 너무 크거나 복잡하여 가져올 수 없습니다.",
        }
    }
}

fn exceeds_xlsx_expansion_limit(metadata: XlsxEntryMetadata) -> bool {
    metadata.uncompressed_bytes > MIN_XLSX_RATIO_CHECK_BYTES
        && metadata
            .compressed_bytes
            .checked_mul(MAX_XLSX_EXPANSION_RATIO)
            .is_none_or(|limit| metadata.uncompressed_bytes > limit)
}

fn validate_xlsx_metadata(
    entry_count: usize,
    entries: impl IntoIterator<Item = XlsxEntryMetadata>,
) -> Result<(), XlsxPreflightError> {
    if entry_count > MAX_XLSX_ENTRIES {
        return Err(XlsxPreflightError::ResourceLimit);
    }
    let mut total = XlsxEntryMetadata {
        compressed_bytes: 0,
        uncompressed_bytes: 0,
    };
    for entry in entries {
        if entry.uncompressed_bytes > MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES
            || exceeds_xlsx_expansion_limit(entry)
        {
            return Err(XlsxPreflightError::ResourceLimit);
        }
        total.compressed_bytes = total
            .compressed_bytes
            .checked_add(entry.compressed_bytes)
            .ok_or(XlsxPreflightError::ResourceLimit)?;
        total.uncompressed_bytes = total
            .uncompressed_bytes
            .checked_add(entry.uncompressed_bytes)
            .ok_or(XlsxPreflightError::ResourceLimit)?;
        if total.uncompressed_bytes > MAX_XLSX_UNCOMPRESSED_BYTES {
            return Err(XlsxPreflightError::ResourceLimit);
        }
    }
    if exceeds_xlsx_expansion_limit(total) {
        return Err(XlsxPreflightError::ResourceLimit);
    }
    Ok(())
}

fn requires_xlsx_preflight(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("xlsx"))
}

fn xlsx_entry_count_from_tail(tail: &[u8]) -> Result<usize, XlsxPreflightError> {
    let Some(offset) = tail
        .windows(4)
        .rposition(|window| window == [0x50, 0x4b, 0x05, 0x06])
    else {
        return Err(XlsxPreflightError::InvalidArchive);
    };
    let eocd = tail
        .get(offset..)
        .filter(|bytes| bytes.len() >= ZIP_EOCD_MIN_BYTES)
        .ok_or(XlsxPreflightError::InvalidArchive)?;
    let comment_bytes = usize::from(u16::from_le_bytes([eocd[20], eocd[21]]));
    if eocd.len() != ZIP_EOCD_MIN_BYTES + comment_bytes {
        return Err(XlsxPreflightError::InvalidArchive);
    }
    let entry_count = usize::from(u16::from_le_bytes([eocd[10], eocd[11]]));
    if entry_count == usize::from(u16::MAX) || entry_count > MAX_XLSX_ENTRIES {
        return Err(XlsxPreflightError::ResourceLimit);
    }
    Ok(entry_count)
}

fn preflight_xlsx_entry_count(file: &mut fs::File) -> Result<usize, XlsxPreflightError> {
    let file_bytes = file
        .seek(SeekFrom::End(0))
        .map_err(|_| XlsxPreflightError::InvalidArchive)?;
    let tail_bytes = file_bytes.min((ZIP_EOCD_MIN_BYTES + ZIP_MAX_COMMENT_BYTES) as u64);
    file.seek(SeekFrom::End(-(tail_bytes as i64)))
        .map_err(|_| XlsxPreflightError::InvalidArchive)?;
    let mut tail = vec![0; tail_bytes as usize];
    file.read_exact(&mut tail)
        .map_err(|_| XlsxPreflightError::InvalidArchive)?;
    xlsx_entry_count_from_tail(&tail)
}

fn preflight_xlsx(path: &Path) -> Result<(), XlsxPreflightError> {
    let mut file = fs::File::open(path).map_err(|_| XlsxPreflightError::InvalidArchive)?;
    let expected_entries = preflight_xlsx_entry_count(&mut file)?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| XlsxPreflightError::InvalidArchive)?;
    let mut archive =
        ZipArchive::new(BufReader::new(file)).map_err(|_| XlsxPreflightError::InvalidArchive)?;
    if archive.len() != expected_entries {
        return Err(XlsxPreflightError::InvalidArchive);
    }
    let mut entries = Vec::with_capacity(archive.len());
    for index in 0..archive.len() {
        let entry = archive
            .by_index_raw(index)
            .map_err(|_| XlsxPreflightError::InvalidArchive)?;
        entries.push(XlsxEntryMetadata {
            compressed_bytes: entry.compressed_size(),
            uncompressed_bytes: entry.size(),
        });
    }
    validate_xlsx_metadata(archive.len(), entries)
}

fn validate_spreadsheet_sheet_count(sheet_count: usize) -> Result<(), String> {
    if sheet_count > MAX_SPREADSHEET_SHEETS {
        return Err(SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned());
    }
    Ok(())
}

fn spreadsheet_sheet_cell_count(rows: usize, columns: usize) -> Result<usize, String> {
    if rows > MAX_SPREADSHEET_RAW_ROWS || columns > MAX_SPREADSHEET_COLUMNS {
        return Err(SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned());
    }
    let cells = rows
        .checked_mul(columns)
        .ok_or_else(|| SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned())?;
    if cells > MAX_SPREADSHEET_CELLS_PER_SHEET {
        return Err(SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned());
    }
    Ok(cells)
}

fn reserve_spreadsheet_cells(total_cells: &mut usize, sheet_cells: usize) -> Result<(), String> {
    let next_total = total_cells
        .checked_add(sheet_cells)
        .ok_or_else(|| SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned())?;
    if next_total > MAX_SPREADSHEET_CELLS_TOTAL {
        return Err(SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned());
    }
    *total_cells = next_total;
    Ok(())
}

#[derive(Default)]
struct SpreadsheetBounds {
    min_row: u32,
    max_row: u32,
    min_column: u32,
    max_column: u32,
    initialized: bool,
}

impl SpreadsheetBounds {
    fn include(&mut self, row: u32, column: u32) -> Result<usize, String> {
        if self.initialized {
            self.min_row = self.min_row.min(row);
            self.max_row = self.max_row.max(row);
            self.min_column = self.min_column.min(column);
            self.max_column = self.max_column.max(column);
        } else {
            self.min_row = row;
            self.max_row = row;
            self.min_column = column;
            self.max_column = column;
            self.initialized = true;
        }
        self.cell_count()
    }

    fn include_rectangle(
        &mut self,
        first_row: u32,
        last_row: u32,
        first_column: u32,
        last_column: u32,
    ) -> Result<usize, String> {
        if last_row < first_row || last_column < first_column {
            return Err("스프레드시트를 읽지 못했습니다.".to_owned());
        }
        self.include(first_row, first_column)?;
        self.include(last_row, last_column)
    }

    fn dimensions(&self) -> Result<(usize, usize), String> {
        if !self.initialized {
            return Ok((0, 0));
        }
        let rows = self
            .max_row
            .checked_sub(self.min_row)
            .and_then(|span| span.checked_add(1))
            .and_then(|span| usize::try_from(span).ok())
            .ok_or_else(|| SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned())?;
        let columns = self
            .max_column
            .checked_sub(self.min_column)
            .and_then(|span| span.checked_add(1))
            .and_then(|span| usize::try_from(span).ok())
            .ok_or_else(|| SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned())?;
        Ok((rows, columns))
    }

    fn cell_count(&self) -> Result<usize, String> {
        let (rows, columns) = self.dimensions()?;
        spreadsheet_sheet_cell_count(rows, columns)
    }
}

fn spreadsheet_tables_xlsx(path: &Path) -> Result<Vec<(String, Vec<Vec<String>>)>, String> {
    preflight_xlsx(path).map_err(|error| error.user_message().to_owned())?;
    let mut workbook: Xlsx<_> =
        open_workbook(path).map_err(|_| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    let names = workbook.sheet_names().to_vec();
    validate_spreadsheet_sheet_count(names.len())?;
    let mut tables = Vec::new();
    let mut materialized_cells = 0usize;
    for name in names {
        let mut reader = match workbook.worksheet_cells_reader(&name) {
            Ok(reader) => reader,
            Err(XlsxError::NotAWorksheet(_)) => {
                tables.push((name, Vec::new()));
                continue;
            }
            Err(_) => return Err("스프레드시트를 읽지 못했습니다.".to_owned()),
        };
        let mut bounds = SpreadsheetBounds::default();
        let mut cells = HashMap::new();
        while let Some(cell) = reader
            .next_cell()
            .map_err(|_| "스프레드시트를 읽지 못했습니다.".to_owned())?
        {
            if cell.get_value().is_empty() {
                continue;
            }
            let position = cell.get_position();
            bounds.include(position.0, position.1)?;
            cells.insert(position, Data::from(cell.get_value().clone()).to_string());
        }
        let sheet_cells = bounds.cell_count()?;
        reserve_spreadsheet_cells(&mut materialized_cells, sheet_cells)?;
        let (rows, columns) = bounds.dimensions()?;
        let mut table = vec![vec![String::new(); columns]; rows];
        for ((row, column), value) in cells {
            let relative_row = usize::try_from(row - bounds.min_row)
                .map_err(|_| SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned())?;
            let relative_column = usize::try_from(column - bounds.min_column)
                .map_err(|_| SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned())?;
            table[relative_row][relative_column] = value;
        }
        tables.push((name, table));
    }
    if tables.is_empty() {
        Err("품목 표가 있는 시트를 찾지 못했습니다.".to_owned())
    } else {
        Ok(tables)
    }
}

fn read_u16_le(bytes: &[u8]) -> Option<u16> {
    Some(u16::from_le_bytes(bytes.get(..2)?.try_into().ok()?))
}

fn read_u32_le(bytes: &[u8]) -> Option<u32> {
    Some(u32::from_le_bytes(bytes.get(..4)?.try_into().ok()?))
}

fn xls_cell_position(record: &[u8]) -> Option<(u32, u32)> {
    Some((
        u32::from(read_u16_le(record)?),
        u32::from(read_u16_le(record.get(2..)?)?),
    ))
}

fn validate_xls_sheet_stream(stream: &[u8], offset: usize) -> Result<usize, String> {
    let first_header_end = offset
        .checked_add(4)
        .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    stream
        .get(offset..first_header_end)
        .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    let mut cursor = offset;
    let mut bounds = SpreadsheetBounds::default();
    while cursor < stream.len() {
        let header = stream
            .get(cursor..cursor.saturating_add(4))
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        let record_type =
            read_u16_le(header).ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        let record_len = usize::from(
            read_u16_le(&header[2..])
                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
        );
        cursor = cursor
            .checked_add(4)
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        let record = stream
            .get(cursor..cursor.saturating_add(record_len))
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        cursor = cursor
            .checked_add(record_len)
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        match record_type {
            0x0200 => {
                let (first_row, last_row, first_column, last_column) = match record.len() {
                    10 => (
                        u32::from(
                            read_u16_le(record)
                                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        ),
                        u32::from(
                            read_u16_le(&record[2..])
                                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        ),
                        u32::from(
                            read_u16_le(&record[4..])
                                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        ),
                        u32::from(
                            read_u16_le(&record[6..])
                                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        ),
                    ),
                    14 => (
                        read_u32_le(record)
                            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        read_u32_le(&record[4..])
                            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        u32::from(
                            read_u16_le(&record[8..])
                                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        ),
                        u32::from(
                            read_u16_le(&record[10..])
                                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                        ),
                    ),
                    _ => return Err("스프레드시트를 읽지 못했습니다.".to_owned()),
                };
                let first_column = if first_column > 0xFF || last_column < first_column {
                    0
                } else {
                    first_column
                };
                let (last_row, last_column) = if last_row >= 1 && last_column >= 1 {
                    (last_row - 1, last_column - 1)
                } else {
                    (first_row, first_column)
                };
                bounds.include_rectangle(first_row, last_row, first_column, last_column)?;
            }
            0x0203 | 0x0204 | 0x00D6 | 0x0205 | 0x027E | 0x00FD | 0x0006 => {
                let (row, column) = xls_cell_position(record)
                    .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
                bounds.include(row, column)?;
            }
            0x00BD => {
                let row = u32::from(
                    read_u16_le(record)
                        .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                );
                let first_column = u32::from(
                    read_u16_le(&record[2..])
                        .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                );
                let last_column = u32::from(
                    read_u16_le(
                        record
                            .get(record.len().saturating_sub(2)..)
                            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                    )
                    .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
                );
                bounds.include_rectangle(row, row, first_column, last_column)?;
            }
            0x000A => break,
            _ => {}
        }
    }
    bounds.cell_count()
}

fn preflight_xls(path: &Path) -> Result<(), String> {
    let mut compound = cfb::open(path).map_err(|_| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    let stream_name = ["/Workbook", "/Book", "/WORKBOOK", "/BOOK"]
        .into_iter()
        .find(|name| compound.is_stream(name))
        .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    let workbook_stream = compound
        .open_stream(stream_name)
        .map_err(|_| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    let mut limited_stream = workbook_stream.take(MAX_FILE_BYTES + 1);
    let mut bytes = Vec::new();
    limited_stream
        .read_to_end(&mut bytes)
        .map_err(|_| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    if bytes.len() > MAX_FILE_BYTES as usize {
        return Err(SPREADSHEET_RESOURCE_LIMIT_MESSAGE.to_owned());
    }
    let mut offsets = Vec::new();
    let mut cursor = 0usize;
    while cursor < bytes.len() {
        let header = bytes
            .get(cursor..cursor.saturating_add(4))
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        let record_type =
            read_u16_le(header).ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        let record_len = usize::from(
            read_u16_le(&header[2..])
                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?,
        );
        cursor = cursor
            .checked_add(4)
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        let record = bytes
            .get(cursor..cursor.saturating_add(record_len))
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        cursor = cursor
            .checked_add(record_len)
            .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
        if record_type == 0x0085 {
            if record.len() < 6 {
                return Err("스프레드시트를 읽지 못했습니다.".to_owned());
            }
            let offset = read_u32_le(record)
                .and_then(|value| usize::try_from(value).ok())
                .ok_or_else(|| "스프레드시트를 읽지 못했습니다.".to_owned())?;
            offsets.push(offset);
            validate_spreadsheet_sheet_count(offsets.len())?;
        }
        if record_type == 0x000A {
            break;
        }
    }
    let mut total_cells = 0usize;
    for offset in offsets {
        let sheet_cells = validate_xls_sheet_stream(&bytes, offset)?;
        reserve_spreadsheet_cells(&mut total_cells, sheet_cells)?;
    }
    Ok(())
}

fn spreadsheet_tables(path: &Path) -> Result<Vec<(String, Vec<Vec<String>>)>, String> {
    if requires_xlsx_preflight(path) {
        return spreadsheet_tables_xlsx(path);
    }
    preflight_xls(path)?;
    let mut workbook =
        open_workbook_auto(path).map_err(|_| "스프레드시트를 읽지 못했습니다.".to_owned())?;
    let names = workbook.sheet_names().to_vec();
    validate_spreadsheet_sheet_count(names.len())?;
    let mut tables = Vec::new();
    let mut materialized_cells = 0usize;
    for name in names {
        if let Ok(range) = workbook.worksheet_range(&name) {
            let (rows, columns) = range.get_size();
            let sheet_cells = spreadsheet_sheet_cell_count(rows, columns)?;
            reserve_spreadsheet_cells(&mut materialized_cells, sheet_cells)?;
            let rows: Vec<Vec<String>> = range
                .rows()
                .map(|row| row.iter().map(ToString::to_string).collect())
                .collect();
            tables.push((name, rows));
        }
    }
    if tables.is_empty() {
        Err("품목 표가 있는 시트를 찾지 못했습니다.".to_owned())
    } else {
        Ok(tables)
    }
}

#[derive(Debug, PartialEq, Eq)]
enum PdfTableError {
    Unsupported(String),
    Error(String),
}

fn split_pdf_columns(line: &str) -> Vec<String> {
    if line.contains(['\t', '\0']) {
        return line
            .split(['\t', '\0'])
            .map(|value| value.trim().to_owned())
            .collect();
    }
    let mut columns = Vec::new();
    let mut current = String::new();
    let mut whitespace = String::new();
    for character in line.chars() {
        if character.is_whitespace() {
            whitespace.push(character);
            continue;
        }
        if whitespace.chars().count() >= 2 {
            columns.push(current.trim().to_owned());
            current.clear();
        } else if !whitespace.is_empty() && !current.is_empty() {
            current.push(' ');
        }
        whitespace.clear();
        current.push(character);
    }
    if !current.trim().is_empty() {
        columns.push(current.trim().to_owned());
    }
    columns
}

fn is_obvious_pdf_footer(line: &str) -> bool {
    let normalized = line.trim().to_lowercase().replace(' ', "");
    let page_suffix = normalized
        .strip_prefix("페이지")
        .or_else(|| normalized.strip_prefix("page"))
        .unwrap_or(&normalized);
    let Some((current, total)) = page_suffix.split_once('/') else {
        return false;
    };
    !current.is_empty()
        && !total.is_empty()
        && current.chars().all(|value| value.is_ascii_digit())
        && total.chars().all(|value| value.is_ascii_digit())
}

fn pdf_text_rows(text: &str) -> Result<Vec<Vec<String>>, PdfTableError> {
    if text.len() > MAX_PDF_TEXT_BYTES {
        return Err(PdfTableError::Error(
            "PDF에서 추출한 텍스트가 2MB를 초과합니다.".to_owned(),
        ));
    }
    let rows: Vec<Vec<String>> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !is_obvious_pdf_footer(line))
        .map(split_pdf_columns)
        .filter(|row| !row.is_empty())
        .take(MAX_ROWS + 30)
        .collect();
    let meaningful_characters = rows
        .iter()
        .flatten()
        .flat_map(|value| value.chars())
        .filter(|value| !value.is_whitespace())
        .count();
    if meaningful_characters < 8 {
        return Err(PdfTableError::Unsupported(
            "텍스트를 읽을 수 없는 PDF입니다. 스캔 문서 OCR은 현재 지원하지 않습니다.".to_owned(),
        ));
    }
    if generic_header_options(&rows).is_empty() {
        return Err(PdfTableError::Error(
            "PDF에서 표 형태의 품목 구성을 찾지 못했습니다.".to_owned(),
        ));
    }
    Ok(rows)
}

#[derive(Debug)]
struct PdfGlyph {
    page: u32,
    x: f64,
    y: f64,
    end_x: f64,
    font_size: f64,
    text: String,
}

#[derive(Default)]
struct PdfLayoutOutput {
    current_page: u32,
    extracted_bytes: usize,
    glyphs: Vec<PdfGlyph>,
}

impl OutputDev for PdfLayoutOutput {
    fn begin_page(
        &mut self,
        page_num: u32,
        _media_box: &MediaBox,
        _art_box: Option<(f64, f64, f64, f64)>,
    ) -> Result<(), OutputError> {
        self.current_page = page_num;
        Ok(())
    }

    fn end_page(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn output_character(
        &mut self,
        transform: &Transform,
        width: f64,
        _spacing: f64,
        font_size: f64,
        character: &str,
    ) -> Result<(), OutputError> {
        self.extracted_bytes = self.extracted_bytes.saturating_add(character.len());
        if self.extracted_bytes > MAX_PDF_TEXT_BYTES {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "PDF text limit exceeded",
            )
            .into());
        }
        let rendered_font_size = (transform.m11.powi(2) + transform.m12.powi(2)).sqrt() * font_size;
        let rendered_font_size = rendered_font_size.max(1.0);
        self.glyphs.push(PdfGlyph {
            page: self.current_page,
            x: transform.m31,
            y: transform.m32,
            end_x: transform.m31 + width * rendered_font_size,
            font_size: rendered_font_size,
            text: character.to_owned(),
        });
        Ok(())
    }

    fn begin_word(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn end_word(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn end_line(&mut self) -> Result<(), OutputError> {
        Ok(())
    }
}

fn pdf_layout_text(mut glyphs: Vec<PdfGlyph>) -> String {
    glyphs.sort_by(|left, right| {
        left.page
            .cmp(&right.page)
            .then_with(|| right.y.total_cmp(&left.y))
            .then_with(|| left.x.total_cmp(&right.x))
    });
    let mut output = String::new();
    let mut previous: Option<&PdfGlyph> = None;
    for glyph in &glyphs {
        if let Some(last) = previous {
            let new_page = glyph.page != last.page;
            let new_line =
                new_page || (glyph.y - last.y).abs() > glyph.font_size.max(last.font_size) * 0.5;
            if new_line {
                if !output.ends_with('\n') {
                    output.push('\n');
                }
            } else if !glyph.text.chars().all(char::is_whitespace) {
                let gap = glyph.x - last.end_x;
                if gap > glyph.font_size.max(last.font_size) * 1.25 {
                    if !output.ends_with("  ") {
                        output.push_str("  ");
                    }
                } else if gap > glyph.font_size.max(last.font_size) * 0.15
                    && !output.ends_with(char::is_whitespace)
                {
                    output.push(' ');
                }
            }
        }
        if matches!(glyph.text.as_str(), "\t" | "\0") {
            output.push_str("  ");
        } else if glyph.text.chars().all(char::is_whitespace) {
            if !output.ends_with(char::is_whitespace) {
                output.push(' ');
            }
        } else {
            output.push_str(&glyph.text);
        }
        previous = Some(glyph);
    }
    output
}

fn pdf_rows(path: &Path) -> Result<Vec<Vec<String>>, PdfTableError> {
    let document = Document::load(path)
        .map_err(|_| PdfTableError::Error("PDF 파일을 읽지 못했습니다.".to_owned()))?;
    let pages = document.get_pages();
    if pages.len() > MAX_PDF_PAGES {
        return Err(PdfTableError::Error(
            "PDF는 최대 50페이지까지 분석할 수 있습니다.".to_owned(),
        ));
    }
    let mut output = PdfLayoutOutput::default();
    if pdf_extract::output_doc(&document, &mut output).is_err() {
        if output.extracted_bytes > MAX_PDF_TEXT_BYTES {
            return Err(PdfTableError::Error(
                "PDF에서 추출한 텍스트가 2MB를 초과합니다.".to_owned(),
            ));
        }
        return Err(PdfTableError::Error(
            "PDF 텍스트를 추출하지 못했습니다.".to_owned(),
        ));
    }
    let text = pdf_layout_text(output.glyphs);
    pdf_text_rows(&text)
}
fn template_items(
    rows: &[Vec<String>],
    source: &str,
    templates: &[ImportTemplate],
) -> Option<Vec<PurchaseItem>> {
    for option in generic_header_options(rows) {
        for template in templates
            .iter()
            .filter(|template| template.header_signature == option.signature)
        {
            if template.header_signature.is_empty() {
                continue;
            }
            if let Ok(mapping) = normalize_mapping(&template.mapping) {
                if let Ok(items) = parse_rows_with_columns(rows, source, option.row_index, &mapping)
                {
                    if !items.is_empty() {
                        return Some(items);
                    }
                }
            }
        }
    }
    None
}
fn make_candidate(
    source_name: &str,
    sheet_name: &str,
    rows: &[Vec<String>],
) -> Option<MappingCandidate> {
    let header_options = generic_header_options(rows);
    if header_options.is_empty() {
        return None;
    }
    Some(MappingCandidate {
        id: format!(
            "mapping-{}",
            CANDIDATE_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ),
        source_name: source_name.to_owned(),
        sheet_name: sheet_name.to_owned(),
        rows: rows.iter().take(MAX_ROWS + 30).cloned().collect(),
        header_options,
    })
}
pub(crate) fn analyze_paths(
    paths: Vec<PathBuf>,
    templates: Vec<ImportTemplate>,
) -> Result<AnalysisResult, String> {
    if paths.len() > MAX_FILES {
        return Err("한 번에 최대 10개 파일을 가져올 수 있습니다.".to_owned());
    }
    let mut total = 0u64;
    for path in &paths {
        let size = fs::metadata(path)
            .map_err(|_| "파일 정보를 확인하지 못했습니다.".to_owned())?
            .len();
        if size > MAX_FILE_BYTES {
            return Err("파일 하나는 최대 15MB까지 사용할 수 있습니다.".to_owned());
        }
        total += size;
    }
    if total > MAX_TOTAL_BYTES {
        return Err("선택한 파일의 전체 크기는 30MB를 넘을 수 없습니다.".to_owned());
    }
    let mut all_items = Vec::new();
    let mut sources = Vec::new();
    let mut candidates = Vec::new();
    for path in paths {
        let source = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("파일")
            .to_owned();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_lowercase();
        if matches!(extension.as_str(), "png" | "jpg" | "jpeg") {
            sources.push(SourceSummary {
                source_name: source,
                status: "unsupported".to_owned(),
                row_count: 0,
                message: Some(
                    "이미지 OCR은 현재 지원하지 않습니다. 원본은 저장되거나 업로드되지 않습니다."
                        .to_owned(),
                ),
                candidate_id: None,
            });
            continue;
        }
        let tables = if extension == "pdf" {
            match pdf_rows(&path) {
                Ok(rows) => Ok(vec![("PDF".to_owned(), rows)]),
                Err(PdfTableError::Unsupported(message)) => {
                    sources.push(SourceSummary {
                        source_name: source,
                        status: "unsupported".to_owned(),
                        row_count: 0,
                        message: Some(message),
                        candidate_id: None,
                    });
                    continue;
                }
                Err(PdfTableError::Error(message)) => {
                    sources.push(SourceSummary {
                        source_name: source,
                        status: "error".to_owned(),
                        row_count: 0,
                        message: Some(message),
                        candidate_id: None,
                    });
                    continue;
                }
            }
        } else if extension == "csv" {
            csv_rows(&path).map(|rows| vec![("CSV".to_owned(), rows)])
        } else if extension == "xlsx" || extension == "xls" {
            spreadsheet_tables(&path)
        } else {
            Err("지원하지 않는 파일 형식입니다.".to_owned())
        };
        let Ok(tables) = tables else {
            sources.push(SourceSummary {
                source_name: source,
                status: "error".to_owned(),
                row_count: 0,
                message: Some("파일을 분석하지 못했습니다.".to_owned()),
                candidate_id: None,
            });
            continue;
        };
        let parsed = tables
            .iter()
            .find_map(|(_, rows)| template_items(rows, &source, &templates))
            .or_else(|| {
                tables
                    .iter()
                    .filter_map(|(_, rows)| parse_rows(rows, &source).ok())
                    .max_by_key(Vec::len)
            });
        if let Some(mut items) = parsed {
            let count = items.len();
            let base = all_items.len();
            for (index, item) in items.iter_mut().enumerate() {
                item.id = format!("purchase-{base}-{index}");
            }
            all_items.extend(items);
            sources.push(SourceSummary {
                source_name: source,
                status: "success".to_owned(),
                row_count: count,
                message: None,
                candidate_id: None,
            });
        } else if let Some(candidate) = tables
            .iter()
            .filter_map(|(sheet, rows)| make_candidate(&source, sheet, rows))
            .max_by_key(|candidate| {
                candidate
                    .header_options
                    .first()
                    .map_or(0, |option| option.signature.len())
            })
        {
            let candidate_id = candidate.id.clone();
            candidates.push(candidate);
            sources.push(SourceSummary {
                source_name: source,
                status: "needsMapping".to_owned(),
                row_count: 0,
                message: Some("열 구성을 확인해 주세요.".to_owned()),
                candidate_id: Some(candidate_id),
            });
        } else {
            sources.push(SourceSummary {
                source_name: source,
                status: "error".to_owned(),
                row_count: 0,
                message: Some("품목 표의 머리글을 찾지 못했습니다.".to_owned()),
                candidate_id: None,
            });
        }
    }
    Ok(AnalysisResult {
        items: all_items,
        sources,
        candidates,
    })
}

const ANALYSIS_WORKER_ERROR: &str = "파일 분석 중 오류가 발생했습니다.";

async fn run_analysis_worker<T, F>(worker: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(worker)
        .await
        .map_err(|_| ANALYSIS_WORKER_ERROR.to_owned())?
}

pub(crate) async fn analyze_paths_in_background(
    paths: Vec<PathBuf>,
    templates: Vec<ImportTemplate>,
) -> Result<AnalysisResult, String> {
    run_analysis_worker(move || analyze_paths(paths, templates)).await
}

#[derive(Default)]
pub struct PurchaseHelperState {
    active: AtomicBool,
    analysis_generation: AtomicU64,
    templates: Mutex<Vec<ImportTemplate>>,
}
impl PurchaseHelperState {
    pub(crate) fn is_active(&self) -> bool {
        self.active.load(Ordering::SeqCst)
    }
    pub(crate) fn templates(&self) -> Vec<ImportTemplate> {
        self.templates
            .lock()
            .map_or_else(|_| Vec::new(), |value| value.clone())
    }
    pub(crate) fn begin_analysis(&self) -> u64 {
        self.analysis_generation.fetch_add(1, Ordering::SeqCst) + 1
    }
    pub(crate) fn is_current_analysis(&self, generation: u64) -> bool {
        self.is_active() && self.analysis_generation.load(Ordering::SeqCst) == generation
    }
    fn invalidate_analysis(&self) {
        self.analysis_generation.fetch_add(1, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn set_purchase_helper_active(
    state: tauri::State<'_, PurchaseHelperState>,
    active: bool,
    templates: Vec<ImportTemplate>,
) {
    state.invalidate_analysis();
    state.active.store(active, Ordering::SeqCst);
    if let Ok(mut saved) = state.templates.lock() {
        *saved = templates;
    }
}

#[tauri::command]
pub async fn pick_and_analyze_purchase_files(
    app: AppHandle,
    templates: Vec<ImportTemplate>,
) -> Result<Option<AnalysisResult>, String> {
    let Some(files) = app
        .dialog()
        .file()
        .add_filter(
            "견적·구매 파일",
            &["xlsx", "xls", "csv", "pdf", "png", "jpg", "jpeg"],
        )
        .blocking_pick_files()
    else {
        return Ok(None);
    };
    let paths = files
        .into_iter()
        .map(|file| file.into_path().map_err(|error| error.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    analyze_paths_in_background(paths, templates)
        .await
        .map(Some)
}

#[tauri::command]
pub fn apply_purchase_column_mapping(
    candidate: MappingCandidate,
    selected_header_row: usize,
    mapping: HashMap<String, usize>,
) -> Result<AnalysisResult, String> {
    if !candidate
        .header_options
        .iter()
        .any(|option| option.row_index == selected_header_row)
    {
        return Err("선택한 머리글 행을 사용할 수 없습니다.".to_owned());
    }
    let mapping = normalize_mapping(&mapping)?;
    if mapping.values().any(|index| {
        candidate
            .rows
            .get(selected_header_row)
            .is_none_or(|row| *index >= row.len())
    }) {
        return Err("원본 열 구성을 확인해 주세요.".to_owned());
    }
    let mut items = parse_rows_with_columns(
        &candidate.rows,
        &candidate.source_name,
        selected_header_row,
        &mapping,
    )?;
    if items.is_empty() {
        return Err("가져올 품목을 찾지 못했습니다.".to_owned());
    }
    for (index, item) in items.iter_mut().enumerate() {
        item.id = format!("purchase-mapped-{}-{index}", candidate.id);
    }
    let row_count = items.len();
    Ok(AnalysisResult {
        items,
        sources: vec![SourceSummary {
            source_name: candidate.source_name,
            status: "success".to_owned(),
            row_count,
            message: None,
            candidate_id: Some(candidate.id),
        }],
        candidates: Vec::new(),
    })
}

fn output_value(item: &PurchaseItem, column: &str, index: usize) -> String {
    match column {
        "number" => (index + 1).to_string(),
        "name" => item.name.clone(),
        "specification" => item.specification.clone(),
        "quantity" => item.quantity.map(|v| v.to_string()).unwrap_or_default(),
        "unitPrice" => item.unit_price.map(|v| v.to_string()).unwrap_or_default(),
        "amount" => item
            .quantity
            .zip(item.unit_price)
            .map(|(q, p)| (q * p).round())
            .or(item.imported_amount)
            .map(|v| v.to_string())
            .unwrap_or_default(),
        "vendor" => item.vendor.clone(),
        "note" => item.note.clone(),
        "budgetItem" => item.budget_item.clone(),
        _ => String::new(),
    }
}

fn csv_output_value(value: &str, column: &str) -> String {
    let is_text_column = matches!(
        column,
        "name" | "specification" | "vendor" | "note" | "budgetItem"
    );
    let starts_with_formula_trigger = value
        .chars()
        .next()
        .is_some_and(|first| matches!(first, '=' | '+' | '-' | '@' | '\t' | '\r'));
    if is_text_column && starts_with_formula_trigger {
        format!("'{value}")
    } else {
        value.to_owned()
    }
}
fn column_label(column: &str) -> &'static str {
    match column {
        "number" => "번호",
        "name" => "품명",
        "specification" => "규격",
        "quantity" => "수량",
        "unitPrice" => "단가",
        "amount" => "금액",
        "vendor" => "구매처",
        "note" => "비고",
        "budgetItem" => "예산항목",
        _ => "",
    }
}
fn validate_columns(columns: &[String]) -> Result<(), String> {
    if columns.is_empty()
        || !columns.iter().any(|c| c == "name")
        || columns.iter().any(|c| column_label(c).is_empty())
    {
        Err("출력 열 구성을 확인해 주세요.".to_owned())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn save_purchase_export(
    app: AppHandle,
    format: String,
    items: Vec<PurchaseItem>,
    columns: Vec<String>,
) -> Result<bool, String> {
    if items.is_empty() {
        return Err("내보낼 품목을 선택해 주세요.".to_owned());
    }
    validate_columns(&columns)?;
    if format != "xlsx" && format != "csv" {
        return Err("지원하지 않는 내보내기 형식입니다.".to_owned());
    }
    let filename = format!("품의_품목내역_{}.{}", chrono_free_date(), format);
    let Some(file) = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .add_filter(
            if format == "xlsx" { "Excel" } else { "CSV" },
            &[format.as_str()],
        )
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = file.into_path().map_err(|error| error.to_string())?;
    if format == "csv" {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        let mut writer = csv::Writer::from_writer(vec![]);
        writer
            .write_record(columns.iter().map(|c| column_label(c)))
            .map_err(|error| error.to_string())?;
        for (index, item) in items.iter().enumerate() {
            writer
                .write_record(
                    columns
                        .iter()
                        .map(|column| csv_output_value(&output_value(item, column, index), column)),
                )
                .map_err(|error| error.to_string())?;
        }
        bytes.extend(writer.into_inner().map_err(|error| error.to_string())?);
        fs::write(path, bytes).map_err(|error| error.to_string())?;
    } else {
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        let header = Format::new().set_bold();
        let quantity_format = Format::new().set_num_format("0.##");
        let currency_format = Format::new().set_num_format("#,##0");
        for (column_index, column) in columns.iter().enumerate() {
            worksheet
                .write_with_format(0, column_index as u16, column_label(column), &header)
                .map_err(|e| e.to_string())?;
            worksheet
                .set_column_width(column_index as u16, if column == "name" { 28 } else { 14 })
                .map_err(|e| e.to_string())?;
        }
        for (row_index, item) in items.iter().enumerate() {
            for (column_index, column) in columns.iter().enumerate() {
                let row = row_index as u32 + 1;
                let col = column_index as u16;
                match column.as_str() {
                    "quantity" => {
                        if let Some(v) = item.quantity {
                            worksheet
                                .write_number_with_format(row, col, v, &quantity_format)
                                .map_err(|e| e.to_string())?;
                        }
                    }
                    "unitPrice" => {
                        if let Some(v) = item.unit_price {
                            worksheet
                                .write_number_with_format(row, col, v, &currency_format)
                                .map_err(|e| e.to_string())?;
                        }
                    }
                    "amount" => {
                        if let Some(v) = item
                            .quantity
                            .zip(item.unit_price)
                            .map(|(q, p)| (q * p).round())
                            .or(item.imported_amount)
                        {
                            worksheet
                                .write_number_with_format(row, col, v, &currency_format)
                                .map_err(|e| e.to_string())?;
                        }
                    }
                    _ => {
                        worksheet
                            .write_string(row, col, output_value(item, column, row_index))
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        workbook.save(path).map_err(|error| error.to_string())?;
    }
    Ok(true)
}

pub(crate) fn chrono_free_date() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let days = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs() / 86_400);
    // Filename only; local calendar differences near midnight do not affect data.
    let (year, month, day) = civil_from_days(days as i64);
    format!("{year:04}{month:02}{day:02}")
}
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + i64::from(m <= 2), m, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use pdf_extract::{dictionary, Object, Stream};
    use rust_xlsxwriter::{Chart, ChartType};
    use std::io::Write as _;
    use zip::{write::SimpleFileOptions, ZipWriter};

    fn write_synthetic_xlsx(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "품명").unwrap();
        worksheet.write_string(0, 1, "수량").unwrap();
        worksheet.write_string(0, 2, "단가").unwrap();
        worksheet.write_string(1, 0, "마스크").unwrap();
        worksheet.write_number(1, 1, 2).unwrap();
        worksheet.write_number(1, 2, 1000).unwrap();
        workbook.save(&path).unwrap();
        path
    }

    fn write_sparse_xlsx(name: &str, sheets: &[((u32, u16), (u32, u16))]) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        for (index, &(first, last)) in sheets.iter().enumerate() {
            let worksheet = workbook.add_worksheet();
            worksheet.set_name(format!("Sheet{}", index + 1)).unwrap();
            worksheet.write_string(first.0, first.1, "품명").unwrap();
            worksheet.write_string(last.0, last.1, "품목").unwrap();
        }
        workbook.save(&path).unwrap();
        path
    }

    fn write_xlsx_with_declared_dimension(name: &str, declared_dimension: &str) -> PathBuf {
        let source = write_synthetic_xlsx(&format!("{name}-source"));
        let target = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let source_file = fs::File::open(&source).unwrap();
        let mut archive = ZipArchive::new(source_file).unwrap();
        let target_file = fs::File::create(&target).unwrap();
        let mut writer = ZipWriter::new(target_file);
        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).unwrap();
            let entry_name = entry.name().to_owned();
            let options: SimpleFileOptions = entry.options();
            if entry.is_dir() {
                writer.add_directory(entry_name, options).unwrap();
                continue;
            }
            writer.start_file(&entry_name, options).unwrap();
            if entry_name == "xl/worksheets/sheet1.xml" {
                let mut xml = String::new();
                entry.read_to_string(&mut xml).unwrap();
                let start = xml.find("<dimension ").unwrap();
                let end = start + xml[start..].find("/>").unwrap() + 2;
                xml.replace_range(
                    start..end,
                    &format!(r#"<dimension ref="{declared_dimension}"/>"#),
                );
                writer.write_all(xml.as_bytes()).unwrap();
            } else {
                std::io::copy(&mut entry, &mut writer).unwrap();
            }
        }
        writer.finish().unwrap();
        let _ = fs::remove_file(source);
        target
    }

    fn write_xlsx_with_chartsheet(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "품명").unwrap();
        worksheet.write_string(1, 0, "마스크").unwrap();

        let mut chart = Chart::new(ChartType::Column);
        chart.add_series().set_values("Sheet1!$A$2:$A$2");
        workbook
            .add_chartsheet()
            .insert_chart(0, 0, &chart)
            .unwrap();
        workbook.save(&path).unwrap();
        path
    }

    fn push_biff_record(stream: &mut Vec<u8>, record_type: u16, data: &[u8]) {
        stream.extend_from_slice(&record_type.to_le_bytes());
        stream.extend_from_slice(&(data.len() as u16).to_le_bytes());
        stream.extend_from_slice(data);
    }

    fn biff_dimensions(first_row: u32, last_row: u32, first_col: u16, last_col: u16) -> Vec<u8> {
        let mut data = Vec::with_capacity(14);
        data.extend_from_slice(&first_row.to_le_bytes());
        data.extend_from_slice(&last_row.to_le_bytes());
        data.extend_from_slice(&first_col.to_le_bytes());
        data.extend_from_slice(&last_col.to_le_bytes());
        data.extend_from_slice(&[0, 0]);
        data
    }

    fn biff_number_cell(row: u16, column: u16, value: f64) -> Vec<u8> {
        let mut data = Vec::with_capacity(14);
        data.extend_from_slice(&row.to_le_bytes());
        data.extend_from_slice(&column.to_le_bytes());
        data.extend_from_slice(&0u16.to_le_bytes());
        data.extend_from_slice(&value.to_le_bytes());
        data
    }

    fn biff_label_cell(row: u16, column: u16, value: &str) -> Vec<u8> {
        let encoded = value.encode_utf16().collect::<Vec<_>>();
        let mut data = Vec::with_capacity(9 + encoded.len() * 2);
        data.extend_from_slice(&row.to_le_bytes());
        data.extend_from_slice(&column.to_le_bytes());
        data.extend_from_slice(&0u16.to_le_bytes());
        data.extend_from_slice(&(encoded.len() as u16).to_le_bytes());
        data.push(1);
        for unit in encoded {
            data.extend_from_slice(&unit.to_le_bytes());
        }
        data
    }

    fn write_synthetic_xls(
        name: &str,
        dimensions: (u32, u32, u16, u16),
        records: &[(u16, Vec<u8>)],
    ) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.xls", std::process::id()));
        let sheet_name = b"Sheet1";
        let boundsheet_data_len = 8 + sheet_name.len();
        let sheet_offset = 8 + 4 + boundsheet_data_len + 4;
        let mut workbook = Vec::new();
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x05, 0x00]);
        let mut boundsheet = Vec::with_capacity(boundsheet_data_len);
        boundsheet.extend_from_slice(&(sheet_offset as u32).to_le_bytes());
        boundsheet.extend_from_slice(&[0, 0, sheet_name.len() as u8, 0]);
        boundsheet.extend_from_slice(sheet_name);
        push_biff_record(&mut workbook, 0x0085, &boundsheet);
        push_biff_record(&mut workbook, 0x000A, &[]);
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x10, 0x00]);
        push_biff_record(
            &mut workbook,
            0x0200,
            &biff_dimensions(dimensions.0, dimensions.1, dimensions.2, dimensions.3),
        );
        for (record_type, record) in records {
            push_biff_record(&mut workbook, *record_type, record);
        }
        push_biff_record(&mut workbook, 0x000A, &[]);

        let mut compound = cfb::create(&path).unwrap();
        let mut stream = compound.create_stream("/Workbook").unwrap();
        stream.write_all(&workbook).unwrap();
        drop(stream);
        drop(compound);
        path
    }

    fn write_synthetic_xls_with_boundsheet_offset(
        name: &str,
        offset_for_len: impl FnOnce(usize) -> u32,
    ) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.xls", std::process::id()));
        let sheet_name = b"Sheet1";
        let mut workbook = Vec::new();
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x05, 0x00]);
        let boundsheet_offset_position = workbook.len() + 4;
        let mut boundsheet = Vec::with_capacity(8 + sheet_name.len());
        boundsheet.extend_from_slice(&0u32.to_le_bytes());
        boundsheet.extend_from_slice(&[0, 0, sheet_name.len() as u8, 0]);
        boundsheet.extend_from_slice(sheet_name);
        push_biff_record(&mut workbook, 0x0085, &boundsheet);
        push_biff_record(&mut workbook, 0x000A, &[]);
        let sheet_offset = offset_for_len(workbook.len());
        workbook[boundsheet_offset_position..boundsheet_offset_position + 4]
            .copy_from_slice(&sheet_offset.to_le_bytes());

        let mut compound = cfb::create(&path).unwrap();
        let mut stream = compound.create_stream("/Workbook").unwrap();
        stream.write_all(&workbook).unwrap();
        drop(stream);
        drop(compound);
        path
    }

    fn write_synthetic_xls_with_boundsheet_data(name: &str, boundsheet: &[u8]) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.xls", std::process::id()));
        let mut workbook = Vec::new();
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x05, 0x00]);
        push_biff_record(&mut workbook, 0x0085, boundsheet);
        push_biff_record(&mut workbook, 0x000A, &[]);

        let mut compound = cfb::create(&path).unwrap();
        let mut stream = compound.create_stream("/Workbook").unwrap();
        stream.write_all(&workbook).unwrap();
        drop(stream);
        drop(compound);
        path
    }

    fn zip_eocd(entry_count: u16, comment: &[u8]) -> Vec<u8> {
        let mut eocd = vec![0; ZIP_EOCD_MIN_BYTES];
        eocd[0..4].copy_from_slice(&[0x50, 0x4b, 0x05, 0x06]);
        eocd[8..10].copy_from_slice(&entry_count.to_le_bytes());
        eocd[10..12].copy_from_slice(&entry_count.to_le_bytes());
        eocd[20..22].copy_from_slice(&(comment.len() as u16).to_le_bytes());
        eocd.extend_from_slice(comment);
        eocd
    }

    fn write_synthetic_pdf(name: &str, pages: &[&str]) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.pdf", std::process::id()));
        let mut document = Document::with_version("1.7");
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
            "Encoding" => "WinAnsiEncoding",
        });
        let pages_id = document.new_object_id();
        let mut page_ids = Vec::new();
        for page_text in pages {
            let operations = page_text
                .lines()
                .map(|line| {
                    let escaped = line
                        .replace('\\', "\\\\")
                        .replace('(', "\\(")
                        .replace(')', "\\)");
                    format!("({escaped}) Tj 0 -15 Td")
                })
                .collect::<Vec<_>>()
                .join("\n");
            let content = format!("BT /F1 10 Tf 50 750 Td\n{operations}\nET");
            let content_id = document.add_object(Stream::new(dictionary! {}, content.into_bytes()));
            let page_id = document.new_object_id();
            document.objects.insert(
                page_id,
                Object::Dictionary(dictionary! {
                    "Type" => "Page",
                    "Parent" => Object::Reference(pages_id),
                    "Contents" => Object::Reference(content_id),
                    "Resources" => dictionary! {
                        "Font" => dictionary! { "F1" => Object::Reference(font_id) },
                    },
                }),
            );
            page_ids.push(page_id);
        }
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
                "Count" => page_ids.len() as i64,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        });
        document.trailer.set("Root", catalog_id);
        document.save(&path).unwrap();
        path
    }

    #[test]
    fn parses_currency_numbers() {
        assert_eq!(parse_number("₩12,500원"), Some(12500.0));
    }
    #[test]
    fn recognizes_required_header_aliases_and_punctuation() {
        assert_eq!(field_for("Q'TY"), Some("quantity"));
        assert_eq!(field_for("공급 단가"), Some("unitPrice"));
        assert_eq!(field_for("구매처"), Some("vendor"));
        assert_eq!(field_for("예산-과목"), Some("budgetItem"));
    }
    #[test]
    fn excludes_total_rows() {
        assert!(is_total_row(" 총계 "));
        assert!(is_total_row("TOTAL"));
    }
    #[test]
    fn parses_titled_table() {
        let rows = vec![
            vec!["견적서".into()],
            vec!["품명".into(), "수량".into(), "단가".into()],
            vec!["마스크".into(), "2".into(), "1,500".into()],
        ];
        let items = parse_rows(&rows, "sample.csv").unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "마스크");
        assert_eq!(items[0].unit_price, Some(1500.0));
    }

    #[test]
    fn enforces_max_purchase_items() {
        let mut rows = vec![vec!["품명".into(), "수량".into(), "단가".into()]];
        rows.extend(
            (0..MAX_ROWS).map(|index| vec![format!("품목 {index}"), "1".into(), "1000".into()]),
        );
        assert_eq!(parse_rows(&rows, "boundary.xlsx").unwrap().len(), MAX_ROWS);

        rows.push(vec!["초과 품목".into(), "1".into(), "1000".into()]);
        assert_eq!(
            parse_rows(&rows, "oversized.xlsx").unwrap_err(),
            "파일당 품목은 최대 500개까지 가져올 수 있습니다."
        );
    }
    #[test]
    fn rejects_invalid_columns() {
        assert!(validate_columns(&["amount".into()]).is_err());
    }

    #[test]
    fn neutralizes_formula_triggers_only_for_csv_text_cells() {
        for column in ["name", "specification", "vendor", "note", "budgetItem"] {
            for value in ["=1+1", "+cmd", "-danger", "@link", "\tformula", "\rformula"] {
                assert_eq!(csv_output_value(value, column), format!("'{value}"));
            }
        }
        assert_eq!(csv_output_value("일회용 장갑", "name"), "일회용 장갑");
        assert_eq!(csv_output_value("-1200", "unitPrice"), "-1200");
    }
    #[test]
    fn reads_utf8_bom_csv() {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-utf8.csv", std::process::id()));
        fs::write(&path, b"\xEF\xBB\xBF\xED\x92\x88\xEB\xAA\x85,\xEC\x88\x98\xEB\x9F\x89,\xEB\x8B\xA8\xEA\xB0\x80\n\xEB\xA7\x88\xEC\x8A\xA4\xED\x81\xAC,2,1000\n").unwrap();
        let rows = csv_rows(&path).unwrap();
        let _ = fs::remove_file(&path);
        assert_eq!(rows[0][0], "품명");
        assert_eq!(parse_rows(&rows, "sample.csv").unwrap().len(), 1);
    }
    #[test]
    fn reads_cp949_csv() {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-cp949.csv", std::process::id()));
        let encoded = EUC_KR.encode("품명,수량,단가\n마스크,2,1000\n").0;
        fs::write(&path, &encoded).unwrap();
        let rows = csv_rows(&path).unwrap();
        let _ = fs::remove_file(&path);
        assert_eq!(rows[1][0], "마스크");
    }

    #[test]
    fn accepts_small_valid_xlsx_before_existing_import() {
        let path = write_synthetic_xlsx("preflight-valid");
        assert_eq!(preflight_xlsx(&path), Ok(()));
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(result.sources[0].status, "success");
        assert_eq!(result.items.len(), 1);
    }

    #[test]
    fn preserves_small_multi_sheet_xlsx_tables() {
        let path = write_sparse_xlsx("small-multi-sheet", &[((0, 0), (1, 1)), ((0, 0), (2, 2))]);
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables.len(), 2);
        assert_eq!(tables[0].1.len(), 2);
        assert_eq!(tables[1].1.len(), 3);
    }

    #[test]
    fn rejects_sparse_xlsx_far_row_before_dense_materialization() {
        let path = write_sparse_xlsx("far-row", &[((0, 0), (MAX_SPREADSHEET_RAW_ROWS as u32, 0))]);
        assert_eq!(
            spreadsheet_tables(&path).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_sparse_xlsx_far_column_before_dense_materialization() {
        let path = write_sparse_xlsx(
            "far-column",
            &[((0, 0), (0, MAX_SPREADSHEET_COLUMNS as u16))],
        );
        assert_eq!(
            spreadsheet_tables(&path).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_sparse_xlsx_area_and_excel_maximum_corner_without_oom() {
        for (name, last) in [
            ("oversized-area", (1_000, 249)),
            ("excel-maximum-corner", (1_048_575, 16_383)),
        ] {
            let path = write_sparse_xlsx(name, &[((0, 0), last)]);
            assert_eq!(
                spreadsheet_tables(&path).unwrap_err(),
                SPREADSHEET_RESOURCE_LIMIT_MESSAGE
            );
            let _ = fs::remove_file(path);
        }
    }

    #[test]
    fn accepts_exact_xlsx_dense_cell_boundary() {
        let path = write_sparse_xlsx("exact-cell-boundary", &[((0, 0), (999, 249))]);
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables[0].1.len(), 1_000);
        assert_eq!(tables[0].1[0].len(), 250);
    }

    #[test]
    fn rejects_xlsx_workbook_total_before_materializing_over_budget_sheet() {
        let path = write_sparse_xlsx(
            "workbook-total",
            &[((0, 0), (999, 249)), ((0, 0), (999, 249)), ((0, 0), (0, 0))],
        );
        assert_eq!(
            spreadsheet_tables(&path).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn accepts_large_declared_xlsx_dimension_when_actual_cells_are_small() {
        let path = write_xlsx_with_declared_dimension("large-declared-dimension", "A1:XFD1048576");
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables[0].1.len(), 2);
        assert_eq!(tables[0].1[0].len(), 3);
        assert_eq!(tables[0].1[1][0], "마스크");
    }

    #[test]
    fn preserves_xlsx_chartsheet_compatibility_without_dense_ranges() {
        let path = write_xlsx_with_chartsheet("chartsheet");
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables.len(), 2);
        assert_eq!(tables[0].1[1][0], "마스크");
        assert!(tables[1].1.is_empty());
    }

    #[test]
    fn imports_small_valid_xls_with_korean_and_numeric_cells() {
        let records = vec![
            (0x0204, biff_label_cell(0, 0, "품명")),
            (0x0204, biff_label_cell(0, 1, "수량")),
            (0x0204, biff_label_cell(0, 2, "단가")),
            (0x0204, biff_label_cell(1, 0, "마스크")),
            (0x0203, biff_number_cell(1, 1, 2.0)),
            (0x0203, biff_number_cell(1, 2, 1_000.0)),
        ];
        let path = write_synthetic_xls("small-valid", (0, 2, 0, 3), &records);
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(result.sources[0].status, "success");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "마스크");
        assert_eq!(result.items[0].quantity, Some(2.0));
        assert_eq!(result.items[0].unit_price, Some(1_000.0));
    }

    #[test]
    fn rejects_xls_dense_ranges_before_calamine_open() {
        let oversized = write_synthetic_xls(
            "oversized-dimensions",
            (0, (MAX_SPREADSHEET_RAW_ROWS + 1) as u32, 0, 1),
            &[],
        );
        assert_eq!(
            spreadsheet_tables(&oversized).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(oversized);

        let stale = write_synthetic_xls(
            "stale-dimensions",
            (0, 1, 0, 1),
            &[(
                0x0203,
                biff_number_cell((MAX_SPREADSHEET_RAW_ROWS + 1) as u16, 0, 1.0),
            )],
        );
        assert_eq!(
            spreadsheet_tables(&stale).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(stale);

        let far_column = write_synthetic_xls(
            "far-column",
            (0, 1, 0, 1),
            &[(
                0x0203,
                biff_number_cell(0, MAX_SPREADSHEET_COLUMNS as u16, 1.0),
            )],
        );
        assert_eq!(
            spreadsheet_tables(&far_column).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(far_column);
    }

    #[test]
    fn validates_xls_boundary_and_rejects_corrupt_compound_file() {
        let boundary = write_synthetic_xls("exact-boundary", (0, 1_000, 0, 250), &[]);
        assert_eq!(preflight_xls(&boundary), Ok(()));
        let _ = fs::remove_file(boundary);

        let corrupt = std::env::temp_dir().join(format!(
            "purchase-helper-{}-corrupt.xls",
            std::process::id()
        ));
        fs::write(&corrupt, b"not a compound file").unwrap();
        assert_eq!(
            preflight_xls(&corrupt).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
        let _ = fs::remove_file(corrupt);
    }

    #[test]
    fn rejects_xls_boundsheet_offsets_without_a_complete_record_header() {
        let beyond_stream =
            write_synthetic_xls_with_boundsheet_offset("offset-beyond-stream", |_| u32::MAX);
        assert_eq!(
            preflight_xls(&beyond_stream).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
        let _ = fs::remove_file(beyond_stream);

        let final_byte =
            write_synthetic_xls_with_boundsheet_offset("offset-at-final-byte", |len| {
                (len - 1) as u32
            });
        assert_eq!(
            preflight_xls(&final_byte).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
        let _ = fs::remove_file(final_byte);
    }

    #[test]
    fn rejects_xls_boundsheet_records_shorter_than_calamine_metadata_fields() {
        for record_len in [4, 5] {
            let boundsheet = vec![0; record_len];
            let path = write_synthetic_xls_with_boundsheet_data(
                &format!("short-boundsheet-{record_len}"),
                &boundsheet,
            );
            assert_eq!(
                preflight_xls(&path).unwrap_err(),
                "스프레드시트를 읽지 못했습니다."
            );
            let _ = fs::remove_file(path);
        }
    }

    #[test]
    fn validates_xls_dimensions_and_actual_cell_coordinates_before_calamine_open() {
        let mut normal = Vec::new();
        push_biff_record(&mut normal, 0x0200, &biff_dimensions(0, 2, 0, 2));
        push_biff_record(&mut normal, 0x0203, &biff_number_cell(1, 1, 0.0));
        push_biff_record(&mut normal, 0x000A, &[]);
        assert_eq!(validate_xls_sheet_stream(&normal, 0), Ok(4));

        let mut oversized_dimensions = Vec::new();
        push_biff_record(
            &mut oversized_dimensions,
            0x0200,
            &biff_dimensions(0, (MAX_SPREADSHEET_RAW_ROWS + 1) as u32, 0, 1),
        );
        assert_eq!(
            validate_xls_sheet_stream(&oversized_dimensions, 0).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );

        let mut stale_dimensions = Vec::new();
        push_biff_record(&mut stale_dimensions, 0x0200, &biff_dimensions(0, 1, 0, 1));
        push_biff_record(
            &mut stale_dimensions,
            0x0203,
            &biff_number_cell((MAX_SPREADSHEET_RAW_ROWS + 1) as u16, 0, 0.0),
        );
        assert_eq!(
            validate_xls_sheet_stream(&stale_dimensions, 0).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );

        let mut inverted_dimensions = Vec::new();
        push_biff_record(
            &mut inverted_dimensions,
            0x0200,
            &biff_dimensions(3, 3, 0, 1),
        );
        assert_eq!(
            validate_xls_sheet_stream(&inverted_dimensions, 0).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
    }

    #[test]
    fn rejects_malformed_xls_biff_without_internal_details() {
        let error = validate_xls_sheet_stream(&[0x03, 0x02, 0xff, 0xff], 0).unwrap_err();
        assert_eq!(error, "스프레드시트를 읽지 못했습니다.");
    }

    #[test]
    fn accepts_spreadsheet_resource_boundaries_and_empty_sheets() {
        assert_eq!(
            validate_spreadsheet_sheet_count(MAX_SPREADSHEET_SHEETS),
            Ok(())
        );
        assert_eq!(spreadsheet_sheet_cell_count(0, 0), Ok(0));
        assert_eq!(
            spreadsheet_sheet_cell_count(MAX_SPREADSHEET_RAW_ROWS, 1),
            Ok(10_000)
        );
        assert_eq!(
            spreadsheet_sheet_cell_count(1, MAX_SPREADSHEET_COLUMNS),
            Ok(256)
        );
        assert_eq!(
            spreadsheet_sheet_cell_count(1_000, 250),
            Ok(MAX_SPREADSHEET_CELLS_PER_SHEET)
        );

        let mut total = 0;
        assert_eq!(
            reserve_spreadsheet_cells(&mut total, MAX_SPREADSHEET_CELLS_TOTAL),
            Ok(())
        );
        assert_eq!(total, MAX_SPREADSHEET_CELLS_TOTAL);
    }

    #[test]
    fn rejects_spreadsheet_dimensions_without_truncation() {
        for result in [
            validate_spreadsheet_sheet_count(MAX_SPREADSHEET_SHEETS + 1),
            spreadsheet_sheet_cell_count(MAX_SPREADSHEET_RAW_ROWS + 1, 1).map(|_| ()),
            spreadsheet_sheet_cell_count(1, MAX_SPREADSHEET_COLUMNS + 1).map(|_| ()),
            spreadsheet_sheet_cell_count(1_001, 250).map(|_| ()),
        ] {
            assert_eq!(result.unwrap_err(), SPREADSHEET_RESOURCE_LIMIT_MESSAGE);
        }
    }

    #[test]
    fn rejects_spreadsheet_total_cell_budget_and_overflow() {
        let mut total = MAX_SPREADSHEET_CELLS_TOTAL;
        assert_eq!(
            reserve_spreadsheet_cells(&mut total, 1).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        assert_eq!(total, MAX_SPREADSHEET_CELLS_TOTAL);

        let mut overflowing_total = usize::MAX;
        assert_eq!(
            reserve_spreadsheet_cells(&mut overflowing_total, 1).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        assert_eq!(overflowing_total, usize::MAX);
    }

    #[test]
    fn rejects_oversized_worksheet_with_friendly_error_instead_of_truncating() {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-oversized-range.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "품명").unwrap();
        worksheet
            .write_string(MAX_SPREADSHEET_RAW_ROWS as u32, 0, "범위 초과 품목")
            .unwrap();
        workbook.save(&path).unwrap();

        let error = spreadsheet_tables(&path).unwrap_err();
        let _ = fs::remove_file(path);
        assert_eq!(error, SPREADSHEET_RESOURCE_LIMIT_MESSAGE);
    }

    #[test]
    fn rejects_xlsx_entry_count_above_limit() {
        let result = validate_xlsx_metadata(
            MAX_XLSX_ENTRIES + 1,
            std::iter::empty::<XlsxEntryMetadata>(),
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

    #[test]
    fn rejects_xlsx_entry_count_before_zip_archive_allocation() {
        assert_eq!(
            xlsx_entry_count_from_tail(&zip_eocd((MAX_XLSX_ENTRIES + 1) as u16, &[])),
            Err(XlsxPreflightError::ResourceLimit)
        );
        assert_eq!(
            xlsx_entry_count_from_tail(&zip_eocd(u16::MAX, &[])),
            Err(XlsxPreflightError::ResourceLimit)
        );
        assert_eq!(
            xlsx_entry_count_from_tail(&zip_eocd(MAX_XLSX_ENTRIES as u16, b"ok")),
            Ok(MAX_XLSX_ENTRIES)
        );
    }

    #[test]
    fn rejects_single_xlsx_entry_above_uncompressed_limit() {
        let result = validate_xlsx_metadata(
            1,
            [XlsxEntryMetadata {
                compressed_bytes: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES,
                uncompressed_bytes: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES + 1,
            }],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

    #[test]
    fn rejects_xlsx_total_above_uncompressed_limit() {
        let half = MAX_XLSX_UNCOMPRESSED_BYTES / 2;
        let result = validate_xlsx_metadata(
            3,
            [
                XlsxEntryMetadata {
                    compressed_bytes: half,
                    uncompressed_bytes: half,
                },
                XlsxEntryMetadata {
                    compressed_bytes: half,
                    uncompressed_bytes: half,
                },
                XlsxEntryMetadata {
                    compressed_bytes: 1,
                    uncompressed_bytes: 1,
                },
            ],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

    #[test]
    fn rejects_extreme_xlsx_expansion_only_above_minimum_size() {
        let result = validate_xlsx_metadata(
            1,
            [XlsxEntryMetadata {
                compressed_bytes: 1,
                uncompressed_bytes: MIN_XLSX_RATIO_CHECK_BYTES + 1,
            }],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

    #[test]
    fn accepts_xlsx_resource_boundaries() {
        assert_eq!(
            validate_xlsx_metadata(
                MAX_XLSX_ENTRIES,
                std::iter::repeat_n(
                    XlsxEntryMetadata {
                        compressed_bytes: 0,
                        uncompressed_bytes: 0,
                    },
                    MAX_XLSX_ENTRIES,
                ),
            ),
            Ok(())
        );
        assert_eq!(
            validate_xlsx_metadata(
                2,
                [
                    XlsxEntryMetadata {
                        compressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                        uncompressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                    },
                    XlsxEntryMetadata {
                        compressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                        uncompressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                    },
                ],
            ),
            Ok(())
        );
        assert_eq!(
            validate_xlsx_metadata(
                1,
                [XlsxEntryMetadata {
                    compressed_bytes: 0,
                    uncompressed_bytes: MIN_XLSX_RATIO_CHECK_BYTES,
                }],
            ),
            Ok(())
        );
        let above_ratio_threshold = MIN_XLSX_RATIO_CHECK_BYTES + 1;
        assert_eq!(
            validate_xlsx_metadata(
                1,
                [XlsxEntryMetadata {
                    compressed_bytes: above_ratio_threshold.div_ceil(MAX_XLSX_EXPANSION_RATIO),
                    uncompressed_bytes: above_ratio_threshold,
                }],
            ),
            Ok(())
        );
    }

    #[test]
    fn rejects_xlsx_metadata_size_arithmetic_overflow() {
        let result = validate_xlsx_metadata(
            2,
            [
                XlsxEntryMetadata {
                    compressed_bytes: u64::MAX,
                    uncompressed_bytes: 0,
                },
                XlsxEntryMetadata {
                    compressed_bytes: 1,
                    uncompressed_bytes: 0,
                },
            ],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

    #[test]
    fn rejects_invalid_xlsx_zip_without_exposing_archive_details() {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-invalid.xlsx",
            std::process::id()
        ));
        fs::write(&path, b"not a zip archive").unwrap();
        let error = preflight_xlsx(&path).unwrap_err();
        let _ = fs::remove_file(path);
        assert_eq!(error, XlsxPreflightError::InvalidArchive);
        assert_eq!(error.user_message(), "스프레드시트를 읽지 못했습니다.");
    }

    #[test]
    fn applies_zip_preflight_only_to_xlsx() {
        assert!(requires_xlsx_preflight(Path::new("quote.XLSX")));
        assert!(!requires_xlsx_preflight(Path::new("quote.xls")));
        assert!(!requires_xlsx_preflight(Path::new("quote.csv")));
        assert!(!requires_xlsx_preflight(Path::new("quote.pdf")));
    }
    fn unknown_rows() -> Vec<Vec<String>> {
        vec![
            vec![
                "상품".into(),
                "옵션".into(),
                "주문개수".into(),
                "판매금액".into(),
            ],
            vec!["일회용 장갑".into(), "M".into(), "2".into(), "12000".into()],
            vec!["알코올솜".into(), "100매".into(), "3".into(), "3500".into()],
        ]
    }
    fn manual_mapping() -> HashMap<String, usize> {
        HashMap::from([
            ("name".into(), 0),
            ("specification".into(), 1),
            ("quantity".into(), 2),
            ("unitPrice".into(), 3),
        ])
    }
    #[test]
    fn unknown_headers_produce_mapping_candidate() {
        let options = generic_header_options(&unknown_rows());
        assert_eq!(options[0].row_index, 0);
        assert_eq!(
            options[0].signature,
            vec!["상품", "옵션", "주문개수", "판매금액"]
        );
        assert!(parse_rows(&unknown_rows(), "sample.xlsx").is_err());
    }
    #[test]
    fn applies_manual_mapping_with_existing_validation() {
        let columns = normalize_mapping(&manual_mapping()).unwrap();
        let items = parse_rows_with_columns(&unknown_rows(), "sample.xlsx", 0, &columns).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].quantity, Some(2.0));
        assert_eq!(items[0].unit_price, Some(12000.0));
    }
    #[test]
    fn rejects_missing_name_and_duplicate_mapping() {
        assert!(normalize_mapping(&HashMap::from([("quantity".into(), 2)])).is_err());
        assert!(
            normalize_mapping(&HashMap::from([("name".into(), 0), ("quantity".into(), 0)]))
                .is_err()
        );
    }
    #[test]
    fn template_exact_signature_precedes_alias_fallback() {
        let template = ImportTemplate {
            id: "one".into(),
            name: "테스트".into(),
            header_signature: signature_for(&unknown_rows()[0]),
            mapping: manual_mapping(),
        };
        assert_eq!(
            template_items(&unknown_rows(), "sample.xlsx", &[template])
                .unwrap()
                .len(),
            2
        );
    }
    #[test]
    fn reordered_signature_does_not_match_template() {
        let template = ImportTemplate {
            id: "one".into(),
            name: "테스트".into(),
            header_signature: signature_for(&unknown_rows()[0]),
            mapping: manual_mapping(),
        };
        let rows = vec![
            vec![
                "상품".into(),
                "주문개수".into(),
                "옵션".into(),
                "판매금액".into(),
            ],
            vec!["장갑".into(), "2".into(), "M".into(), "12000".into()],
        ];
        assert!(template_items(&rows, "sample.xlsx", &[template]).is_none());
    }
    #[test]
    fn malformed_template_is_ignored() {
        let template = ImportTemplate {
            id: "bad".into(),
            name: "bad".into(),
            header_signature: signature_for(&unknown_rows()[0]),
            mapping: HashMap::from([("quantity".into(), 2)]),
        };
        assert!(template_items(&unknown_rows(), "sample.xlsx", &[template]).is_none());
    }
    #[test]
    fn analyze_unknown_csv_then_reuses_exact_template() {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-mapping.csv",
            std::process::id()
        ));
        fs::write(
            &path,
            "상품,옵션,주문개수,판매금액\n일회용 장갑,M,2,12000\n",
        )
        .unwrap();
        let first = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        assert_eq!(first.sources[0].status, "needsMapping");
        assert_eq!(first.candidates.len(), 1);
        let template = ImportTemplate {
            id: "one".into(),
            name: "테스트".into(),
            header_signature: first.candidates[0].header_options[0].signature.clone(),
            mapping: manual_mapping(),
        };
        let second = analyze_paths(vec![path.clone()], vec![template]).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(second.sources[0].status, "success");
        assert_eq!(second.items.len(), 1);
        assert!(second.candidates.is_empty());
    }

    #[test]
    fn background_analysis_returns_the_same_result() {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-background.csv",
            std::process::id()
        ));
        fs::write(&path, "품명,수량,단가\n마스크,2,1000\n").unwrap();
        let expected = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let actual = tauri::async_runtime::block_on(analyze_paths_in_background(
            vec![path.clone()],
            Vec::new(),
        ))
        .unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(
            serde_json::to_value(actual).unwrap(),
            serde_json::to_value(expected).unwrap()
        );
    }

    #[test]
    fn background_analysis_preserves_parser_errors() {
        let paths = vec![PathBuf::from("missing.csv"); MAX_FILES + 1];
        let Err(expected) = analyze_paths(paths.clone(), Vec::new()) else {
            panic!("direct analysis should reject too many files");
        };
        let Err(actual) =
            tauri::async_runtime::block_on(analyze_paths_in_background(paths, Vec::new()))
        else {
            panic!("background analysis should reject too many files");
        };
        assert_eq!(actual, expected);
    }

    #[test]
    fn background_worker_hides_panics_behind_a_stable_error() {
        let result = tauri::async_runtime::block_on(run_analysis_worker::<(), _>(|| {
            panic!("sensitive worker detail")
        }));
        assert_eq!(result.unwrap_err(), ANALYSIS_WORKER_ERROR);
    }

    #[test]
    fn only_the_latest_active_analysis_can_publish() {
        let state = PurchaseHelperState::default();
        state.active.store(true, Ordering::SeqCst);
        let first = state.begin_analysis();
        let second = state.begin_analysis();
        assert!(!state.is_current_analysis(first));
        assert!(state.is_current_analysis(second));

        state.invalidate_analysis();
        assert!(!state.is_current_analysis(second));
    }
    #[test]
    fn manual_mapping_keeps_amount_issue_and_total_exclusion() {
        let rows = vec![
            unknown_rows()[0].clone(),
            vec![
                "장갑".into(),
                "M".into(),
                "2".into(),
                "1000".into(),
                "3000".into(),
            ],
            vec!["합계".into(), "".into(), "".into(), "".into(), "".into()],
        ];
        let mapping = HashMap::from([
            ("name".into(), 0),
            ("quantity".into(), 2),
            ("unitPrice".into(), 3),
            ("amount".into(), 4),
        ]);
        let columns = normalize_mapping(&mapping).unwrap();
        let items = parse_rows_with_columns(&rows, "sample", 0, &columns).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].issues.contains(&"amountMismatch".to_owned()));
    }

    #[test]
    fn reconstructs_pdf_rows_without_splitting_single_spaces() {
        let rows = pdf_text_rows(
            "견 적 서\n품명  규격  수량  단가  금액\n일회용 니트릴 장갑  M  2  ₩12,500  25,000\n페이지 1/1",
        )
        .unwrap();
        assert_eq!(rows[0], vec!["견 적 서"]);
        assert_eq!(rows[2][0], "일회용 니트릴 장갑");
        assert!(!rows.iter().flatten().any(|value| value.contains("페이지")));
        let items = parse_rows(&rows, "synthetic.pdf").unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].unit_price, Some(12500.0));
    }

    #[test]
    fn unknown_pdf_headers_produce_existing_mapping_candidate() {
        let rows =
            pdf_text_rows("상품  옵션사항  주문개수  판매금액\nDisposable gloves  M  2  12000")
                .unwrap();
        assert!(parse_rows(&rows, "unknown.pdf").is_err());
        let candidate = make_candidate("unknown.pdf", "PDF", &rows).unwrap();
        assert_eq!(candidate.sheet_name, "PDF");
        let columns = normalize_mapping(&manual_mapping()).unwrap();
        let items = parse_rows_with_columns(&rows, "unknown.pdf", 0, &columns).unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn repeats_pdf_header_without_importing_it_as_an_item() {
        let rows = pdf_text_rows(
            "Name  Qty  UnitPrice\nMasks  1  1000\nName  Qty  UnitPrice\nGloves  2  2000",
        )
        .unwrap();
        let items = parse_rows(&rows, "two-pages.pdf").unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Masks");
        assert_eq!(items[1].name, "Gloves");
    }

    #[test]
    fn extracts_a_synthetic_text_pdf_and_reuses_templates() {
        let path = write_synthetic_pdf(
            "text-table",
            &["Quotation\nName\tSpec\tQty\tUnitPrice\tAmount\nMasks\tKF94\t2\t10000\t20000\nGloves\tM\t3\t5000\t15000"],
        );
        let rows = pdf_rows(&path).unwrap();
        assert_eq!(parse_rows(&rows, "text-table.pdf").unwrap().len(), 2);
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(result.sources[0].status, "success");
        assert_eq!(result.items.len(), 2);
    }

    #[test]
    fn extracts_multi_page_pdf_and_skips_repeated_headers_and_totals() {
        let path = write_synthetic_pdf(
            "multi-page",
            &[
                "Name\tQty\tUnitPrice\nMasks\t1\t1000",
                "Name\tQty\tUnitPrice\nGloves\t2\t2000\nTotal\t\t3000\nPage 2/2",
            ],
        );
        let rows = pdf_rows(&path).unwrap();
        let items = parse_rows(&rows, "multi-page.pdf").unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Masks");
        assert_eq!(items[1].name, "Gloves");
    }

    #[test]
    fn pdf_unknown_headers_use_saved_exact_signature_template() {
        let path = write_synthetic_pdf(
            "unknown-table",
            &["Product\tOption\tOrderCount\tSalePrice\nGloves\tM\t2\t12000"],
        );
        let first = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        assert_eq!(first.sources[0].status, "needsMapping");
        let mapping = HashMap::from([
            ("name".to_owned(), 0),
            ("specification".to_owned(), 1),
            ("quantity".to_owned(), 2),
            ("unitPrice".to_owned(), 3),
        ]);
        let template = ImportTemplate {
            id: "pdf-template".to_owned(),
            name: "Synthetic PDF".to_owned(),
            header_signature: first.candidates[0].header_options[0].signature.clone(),
            mapping,
        };
        let second = analyze_paths(vec![path.clone()], vec![template]).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(second.sources[0].status, "success");
        assert_eq!(second.items.len(), 1);
        assert!(second.candidates.is_empty());
    }

    #[test]
    fn treats_an_image_only_pdf_as_unsupported() {
        let path = write_synthetic_pdf("scanned", &[""]);
        let error = pdf_rows(&path).unwrap_err();
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert!(matches!(error, PdfTableError::Unsupported(_)));
        assert_eq!(result.sources[0].status, "unsupported");
        assert!(result.sources[0]
            .message
            .as_deref()
            .is_some_and(|message| message.contains("스캔 문서 OCR")));
    }

    #[test]
    fn rejects_pdf_page_and_text_limits() {
        let pages = vec![""; MAX_PDF_PAGES + 1];
        let path = write_synthetic_pdf("too-many-pages", &pages);
        assert!(
            matches!(pdf_rows(&path), Err(PdfTableError::Error(message)) if message.contains("50페이지"))
        );
        let _ = fs::remove_file(path);
        let oversized = "A".repeat(MAX_PDF_TEXT_BYTES + 1);
        assert!(
            matches!(pdf_text_rows(&oversized), Err(PdfTableError::Error(message)) if message.contains("2MB"))
        );
    }
}
