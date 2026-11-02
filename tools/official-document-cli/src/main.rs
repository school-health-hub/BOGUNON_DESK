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
