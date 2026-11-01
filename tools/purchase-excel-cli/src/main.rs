mod engine;
mod limits;
use std::{collections::HashMap,io::{Read,Write},path::PathBuf};
use serde::Deserialize;
const MAX_IO:usize=64*1024*1024;
#[derive(Deserialize)]
#[serde(tag="operation",rename_all="camelCase",rename_all_fields="camelCase",deny_unknown_fields)]
enum Request {
    Analyze { path:PathBuf },
    Map { candidate:engine::MappingCandidate, header_row:usize, mapping:HashMap<String,usize> },
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {version:u8,request:Request}
fn run()->Result<engine::AnalysisResult,()> {
    let mut bytes=Vec::new();std::io::stdin().take((MAX_IO+1) as u64).read_to_end(&mut bytes).map_err(|_|())?;
    if bytes.len()>MAX_IO{return Err(());}
    let envelope:Envelope=serde_json::from_slice(&bytes).map_err(|_|())?;
    if envelope.version!=1{return Err(());}
    match envelope.request {
        Request::Analyze{path}=>{
            if !matches!(path.extension().and_then(|s|s.to_str()),Some("xlsx"|"xls"|"pdf")){return Err(());}
            engine::analyze_paths(vec![path],vec![]).map_err(|_|())
        },
        Request::Map{candidate,header_row,mapping}=>engine::apply_purchase_column_mapping(candidate,header_row,mapping).map_err(|_|()),
    }
}
fn main(){
    std::panic::set_hook(Box::new(|_|{}));
    if limits::install().is_err(){std::process::exit(78);}
    let result=match run(){Ok(data)=>serde_json::json!({"version":1,"ok":true,"data":data}),Err(_)=>{std::process::exit(65);}};
    let bytes=match serde_json::to_vec(&result){Ok(v) if v.len()<=MAX_IO=>v,_=>std::process::exit(74)};
    if std::io::stdout().write_all(&bytes).is_err()||std::io::stdout().flush().is_err(){std::process::exit(74);}
}
