// Selected from b006cbbc5593daa28220be75f21a7f3c2040ac67:src-tauri/src/purchase_helper.rs.
// Only host dispatch (CSV/PDF/Tauri) is removed. Parsing/security bodies remain unchanged.
use std::{collections::{HashMap,HashSet},fs,io::{BufReader,Read,Seek,SeekFrom},path::{Path,PathBuf},sync::atomic::{AtomicU64,Ordering}};
use calamine::{open_workbook,open_workbook_auto,Data,DataType,Reader,Xlsx,XlsxError};
use serde::{Deserialize,Serialize};
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
    #[serde(default)]
    amount_mismatch_reviewed: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRequestResult {
    generation: u64,
    started: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AnalysisEvent {
    pub(crate) generation: u64,
    pub(crate) result: AnalysisResult,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AnalysisErrorEvent {
    pub(crate) generation: u64,
    pub(crate) message: String,
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
        "품명" | "품목명" | "물품명" | "상품명" | "제품명" | "상품" | "제품" | "내역" | "내용" | "name"
        | "itemname" => Some("name"),
        "규격" | "사양" | "옵션" | "모델" | "모델명" | "spec" | "specification" => {
            Some("specification")
        }
        "수량" | "주문수량" | "개수" | "qty" => Some("quantity"),
        "단가" | "가격" | "판매가" | "공급단가" | "예상단가" | "unitprice" => Some("unitPrice"),
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
        let specification = get(row, "specification");
        let vendor = get(row, "vendor");
        let note = get(row, "note");
        let budget_item = get(row, "budgetItem");

        if name.is_empty()
            && quantity.is_none()
            && unit_price.is_none()
            && imported_amount.is_none()
        {
            continue;
        }

        // A trailing subtotal/total cell is frequently emitted as an amount-only row.
        // It is document metadata, not a purchasable item, so do not materialize it
        // as a blank blocking row in Purchase Helper.
        if name.is_empty()
            && specification.is_empty()
            && quantity.is_none()
            && unit_price.is_none()
            && imported_amount.is_some()
            && vendor.is_empty()
            && note.is_empty()
            && budget_item.is_empty()
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
            specification,
            quantity,
            unit_price,
            imported_amount,
            vendor,
            note,
            budget_item,
            source_name: Some(source.to_owned()),
            issues,
            amount_mismatch_reviewed: false,
        });
    }
    if items.len() > MAX_ROWS {
        return Err("파일당 품목은 최대 500개까지 가져올 수 있습니다.".to_owned());
    }
    Ok(items)
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
        let tables = if extension == "xlsx" || extension == "xls" {
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


#[cfg(test)]
#[path="engine_tests.rs"]
mod tests;
