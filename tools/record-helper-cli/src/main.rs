#[path="../../official-document-cli/src/limits.rs"] mod limits;
mod engine { include!(concat!(env!("OUT_DIR"),"/engine/mod.rs")); }
use std::{io::{Read,Write},path::PathBuf,process::ExitCode};
use serde::Deserialize;
#[derive(Deserialize)] #[serde(deny_unknown_fields)] struct Request{version:u8,path:PathBuf}
fn serve()->Result<serde_json::Value,()>{
 let mut input=Vec::new();std::io::stdin().take(65537).read_to_end(&mut input).map_err(|_|())?;if input.len()>65536{return Err(());}
 let r:Request=serde_json::from_slice(&input).map_err(|_|())?;if r.version!=1||!r.path.is_absolute(){return Err(());}
 let m=std::fs::symlink_metadata(&r.path).map_err(|_|())?;if !m.is_file()||m.file_type().is_symlink(){return Err(());}
 serde_json::to_value(engine::extract_reports(vec![r.path])).map_err(|_|())
}
fn main()->ExitCode{
 std::panic::set_hook(Box::new(|_|{}));
 if std::env::args_os().len()!=1||limits::install().is_err(){return ExitCode::from(78);}
 // Request paths are stdin-only; no document path/content is logged or put in process arguments.
 let (value,code)=match std::panic::catch_unwind(serve){Ok(Ok(data))=>(serde_json::json!({"ok":true,"data":data}),ExitCode::SUCCESS),_=>(serde_json::json!({"ok":false,"error":"Record processing unavailable"}),ExitCode::FAILURE)};
 let _=std::io::stdout().write_all(value.to_string().as_bytes());code
}
