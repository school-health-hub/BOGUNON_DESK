#[allow(unsafe_code)]
mod limits;
use std::io::{Read, Write};
use serde::Deserialize;
use base64::Engine;
use official_document_cli::odt::{bundled_template,transform_template,ApprovedTemplateContract,OdtDocument};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {version:u8,request:Request}
#[derive(Deserialize)]
#[serde(tag="operation",rename_all="lowercase",deny_unknown_fields)]
enum Request {Import{path:String},Odt{document:Document}}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Document {title:String,body:String,attachments:String,has_table_text:bool}
fn serve()->ExitCode {
 let mut input=Vec::new();
 let result=(||->Result<serde_json::Value,()>{
  std::io::stdin().take(2*1024*1024+1).read_to_end(&mut input).map_err(|_|())?;
  if input.len()>2*1024*1024{return Err(());}
  let envelope:Envelope=serde_json::from_slice(&input).map_err(|_|())?;if envelope.version!=1{return Err(());}
  match envelope.request {
   Request::Import{path}=>serde_json::to_value(extract_document(Path::new(&path)).map_err(|_|())?).map_err(|_|()),
   Request::Odt{document:d}=>{
    if [&d.title,&d.body,&d.attachments].iter().any(|s|s.len()>500_000||s.contains('\0')){return Err(());}
    let bytes=transform_template(bundled_template(),&ApprovedTemplateContract::home_v1(),OdtDocument{title:&d.title,body:&d.body,attachments:&d.attachments,has_table_text:d.has_table_text}).map_err(|_|())?;
    if bytes.len()>25*1024*1024{return Err(());}
    Ok(serde_json::json!({"bytesBase64":base64::engine::general_purpose::STANDARD.encode(bytes)}))
   }
  }
 })();
 let (value,code)=match result {Ok(data)=>(serde_json::json!({"version":1,"ok":true,"data":data}),ExitCode::SUCCESS),Err(())=>(serde_json::json!({"version":1,"ok":false,"error":"Document processing unavailable"}),ExitCode::FAILURE)};
 let _=std::io::stdout().write_all(value.to_string().as_bytes());code
}
use std::{env, path::Path, process::ExitCode};

use official_document_cli::import::{extract_document, OfficialDocumentImportResult};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Response<'a> {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<OfficialDocumentImportResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<&'a str>,
}

fn main() -> ExitCode {
    if limits::install().is_err(){return ExitCode::from(78);}
    if env::args_os().len()==1{return serve();}
    let mut arguments = env::args_os().skip(1);
    let command = arguments.next();
    let path = arguments.next();
    if command.as_deref() != Some(std::ffi::OsStr::new("import"))
        || path.is_none()
        || arguments.next().is_some()
    {
        emit(&Response {
            ok: false,
            result: None,
            error: Some("사용법: official-document-cli import <path>"),
        });
        return ExitCode::from(2);
    }
    match extract_document(Path::new(path.as_deref().unwrap_or_default())) {
        Ok(result) => {
            emit(&Response {
                ok: true,
                result: Some(result),
                error: None,
            });
            ExitCode::SUCCESS
        }
        Err(error) => {
            emit(&Response {
                ok: false,
                result: None,
                error: Some(error.message()),
            });
            ExitCode::FAILURE
        }
    }
}

fn emit(response: &Response<'_>) {
    match serde_json::to_string(response) {
        Ok(json) => println!("{json}"),
        Err(_) => println!("{{\"ok\":false,\"error\":\"공문 결과를 직렬화하지 못했습니다.\"}}"),
    }
}
