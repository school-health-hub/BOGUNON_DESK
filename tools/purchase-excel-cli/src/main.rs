mod engine;
mod limits;
mod settlement;
mod specialized;
use base64::Engine as _;
use std::{collections::HashMap,io::{Read,Write},path::PathBuf};
use serde::Deserialize;
const MAX_IO:usize=64*1024*1024;
#[derive(Deserialize)]
#[serde(tag="operation",rename_all="camelCase",rename_all_fields="camelCase",deny_unknown_fields)]
enum Request {
    Edufine { items:Vec<engine::PurchaseItem>, preview:bool },
    Settlement { rows:Vec<settlement::PurchaseSettlementExportRow>, summary:settlement::PurchaseSettlementSummary, preview:bool },
    Export { format:String, items:Vec<engine::PurchaseItem>, columns:Vec<String> },
    Analyze { path:PathBuf },
    Map { candidate:engine::MappingCandidate, header_row:usize, mapping:HashMap<String,usize> },
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {version:u8,request:Request}
fn run()->Result<serde_json::Value,()> {
    let mut bytes=Vec::new();std::io::stdin().take((MAX_IO+1) as u64).read_to_end(&mut bytes).map_err(|_|())?;
    if bytes.len()>MAX_IO{return Err(());}
    let envelope:Envelope=serde_json::from_slice(&bytes).map_err(|_|())?;
    if envelope.version!=1{return Err(());}
    match envelope.request {
        Request::Edufine{items,preview}=>{let (bytes,table)=specialized::edufine(&items)?;special_result(bytes,table,preview)},
        Request::Settlement{rows,summary,preview}=>{let (bytes,table)=specialized::settlement(rows,summary)?;special_result(bytes,table,preview)},
        Request::Export{format,items,columns}=>{
            let bytes=engine::export_bytes(&format,&items,&columns).map_err(|_|())?;
            if bytes.len()>32*1024*1024 {return Err(());}
            engine::verify_export(&bytes,&format,&items,&columns).map_err(|_|())?;
            Ok(serde_json::json!({"format":format,"itemCount":items.len(),"columns":columns,"bytesBase64":base64::engine::general_purpose::STANDARD.encode(bytes),"validated":true}))
        },
        Request::Analyze{path}=>{
            if !matches!(path.extension().and_then(|s|s.to_str()),Some("xlsx"|"xls"|"pdf")){return Err(());}
            serde_json::to_value(engine::analyze_paths(vec![path],vec![]).map_err(|_|())?).map_err(|_|())
        },
        Request::Map{candidate,header_row,mapping}=>serde_json::to_value(engine::apply_purchase_column_mapping(candidate,header_row,mapping).map_err(|_|())?).map_err(|_|()),
    }
}
fn special_result(bytes:Vec<u8>,table:serde_json::Value,preview:bool)->Result<serde_json::Value,()>{
    if bytes.len()>32*1024*1024{return Err(());}
    if preview{return Ok(table);}
    Ok(serde_json::json!({"format":"xlsx","itemCount":table["rows"].as_array().ok_or(())?.len(),"columns":table["headers"],"bytesBase64":base64::engine::general_purpose::STANDARD.encode(bytes),"validated":true}))
}
fn main(){
    std::panic::set_hook(Box::new(|_|{}));
    if limits::install().is_err(){std::process::exit(78);}
    let result=match run(){Ok(data)=>serde_json::json!({"version":1,"ok":true,"data":data}),Err(_)=>{std::process::exit(65);}};
    let bytes=match serde_json::to_vec(&result){Ok(v) if v.len()<=MAX_IO=>v,_=>std::process::exit(74)};
    if std::io::stdout().write_all(&bytes).is_err()||std::io::stdout().flush().is_err(){std::process::exit(74);}
}
