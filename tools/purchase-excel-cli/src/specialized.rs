use calamine::{Data,Reader,Xlsx};
use serde_json::Value;
use crate::{engine,settlement};
fn matches_cell(actual:Option<&Data>,expected:&Value)->bool{
    match expected {Value::Null=>actual.is_none_or(|c|matches!(c,Data::Empty)),Value::Number(n)=>actual.is_some_and(|c|match c{Data::Float(v)=>Some(*v)==n.as_f64(),Data::Int(v)=>Some(*v as f64)==n.as_f64(),_=>false}),Value::String(s)=>actual.is_some_and(|c|match c{Data::String(v)=>v==s,Data::Empty=>s.is_empty(),_=>false})||actual.is_none()&&s.is_empty(),_=>false}
}
pub(crate) fn verify(bytes:&[u8],preview:&Value)->Result<(),()> {
    let mut workbook:Xlsx<_>=Xlsx::new(std::io::Cursor::new(bytes)).map_err(|_|())?;
    let table=workbook.worksheet_range_at(0).ok_or(())?.map_err(|_|())?;
    let headers=preview["headers"].as_array().ok_or(())?;let rows=preview["rows"].as_array().ok_or(())?;
    for(col,value) in headers.iter().enumerate(){if !matches_cell(table.get((0,col)),value){return Err(());}}
    for(row,values) in rows.iter().enumerate(){for(col,value) in values.as_array().ok_or(())?.iter().enumerate(){if !matches_cell(table.get((row+1,col)),value){return Err(());}}}
    if let Some(summary)=preview["summaryRows"].as_array(){for(offset,values) in summary.iter().enumerate(){if !matches_cell(table.get((rows.len()+3+offset,6)),&values[0])||!matches_cell(table.get((rows.len()+3+offset,7)),&values[1]){return Err(());}}}
    Ok(())
}
pub(crate) fn edufine(items:&[engine::PurchaseItem])->Result<(Vec<u8>,Value),()> {
    let bytes=engine::edufine_bytes(items).map_err(|_|())?;
    let preview=engine::edufine_preview(items);verify(&bytes,&preview)?;Ok((bytes,preview))
}
pub(crate) fn settlement(rows:Vec<settlement::PurchaseSettlementExportRow>,summary:settlement::PurchaseSettlementSummary)->Result<(Vec<u8>,Value),()> {
    let preview=serde_json::to_value(settlement::preview_purchase_settlement_export(rows.clone(),summary.clone()).map_err(|_|())?).map_err(|_|())?;
    let bytes=settlement::settlement_bytes(&rows,&summary).map_err(|_|())?;verify(&bytes,&preview)?;Ok((bytes,preview))
}
