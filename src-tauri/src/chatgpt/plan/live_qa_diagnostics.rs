//! QA-only structural summaries. Never persist provider text, URLs, or credentials.
use serde_json::{json, Value};
use std::{
    fs::OpenOptions,
    io::{self, Write},
    path::Path,
};

pub(crate) fn write_new(path: &Path, value: &Value) -> io::Result<()> {
    let bytes = serde_json::to_vec(value).map_err(io::Error::other)?;
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(&bytes)?;
    file.sync_all()
}
fn allowed(value: Option<&str>, choices: &[&'static str]) -> &'static str {
    choices
        .iter()
        .copied()
        .find(|candidate| Some(*candidate) == value)
        .unwrap_or("unknown")
}
fn error_fields(error: &Value) -> (&'static str, &'static str, &'static str) {
    (
        allowed(
            error["code"].as_str(),
            &[
                "invalid_request_error",
                "unsupported_value",
                "model_not_found",
                "rate_limit_exceeded",
                "insufficient_quota",
                "server_error",
                "invalid_api_key",
            ],
        ),
        allowed(
            error["type"].as_str(),
            &[
                "invalid_request_error",
                "authentication_error",
                "permission_error",
                "rate_limit_error",
                "server_error",
            ],
        ),
        allowed(
            error["param"].as_str(),
            &[
                "model",
                "tools",
                "tool_choice",
                "include",
                "input",
                "stream",
                "store",
            ],
        ),
    )
}
pub(crate) fn summarize(status: u16, request_id_present: bool, bytes: &[u8]) -> Value {
    let utf8 = std::str::from_utf8(bytes);
    let mut counts = [0u64; 6];
    let mut output_counts = [0u64; 3];
    let mut completed_status = "unknown";
    let mut source_count = 0u64;
    let mut completed_search_count = 0u64;
    let mut missing_url = 0u64;
    let mut unsafe_url = 0u64;
    let mut text_bytes = 0u64;
    let mut malformed = 0u64;
    let mut api_code = "unknown";
    let mut api_param = "unknown";
    let mut api_type = "unknown";
    let text = utf8.as_ref().copied().unwrap_or("").replace("\r\n", "\n");
    let is_sse = text.lines().any(|line| line.starts_with("data:"));
    if !is_sse {
        if let Ok(value) = serde_json::from_slice::<Value>(bytes) {
            (api_code, api_type, api_param) = error_fields(&value["error"]);
        }
    }
    for frame in text.split("\n\n") {
        let data = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim))
            .collect::<Vec<_>>()
            .join("\n");
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let event: Value = match serde_json::from_str(&data) {
            Ok(value) => value,
            Err(_) => {
                malformed += 1;
                continue;
            }
        };
        let kind = event["type"].as_str();
        let index = match kind {
            Some("response.completed") => 0,
            Some("response.failed") => 1,
            Some("response.incomplete") => 2,
            Some("response.output_text.delta") => 3,
            Some("error") => 4,
            _ => 5,
        };
        counts[index] += 1;
        let response = &event["response"];
        if response.is_object() {
            completed_status = allowed(
                response["status"].as_str(),
                &["completed", "failed", "incomplete", "in_progress"],
            );
        }
        let error = if event["error"].is_object() {
            &event["error"]
        } else if response["error"].is_object() {
            &response["error"]
        } else {
            &event
        };
        if error.get("code").is_some() || error.get("param").is_some() {
            (api_code, api_type, api_param) = error_fields(error);
        }
        if let Some(output) = response["output"].as_array() {
            for item in output {
                match item["type"].as_str() {
                    Some("web_search_call") => {
                        output_counts[0] += 1;
                        if item["status"] == "completed" {
                            completed_search_count += 1;
                        }
                        if let Some(sources) = item["action"]["sources"].as_array() {
                            for source in sources {
                                count_source(
                                    source,
                                    &mut source_count,
                                    &mut missing_url,
                                    &mut unsafe_url,
                                );
                            }
                        }
                    }
                    Some("message") => {
                        output_counts[1] += 1;
                        if let Some(content) = item["content"].as_array() {
                            for part in content {
                                if part["type"] == "output_text" {
                                    text_bytes +=
                                        part["text"].as_str().map_or(0, |text| text.len() as u64);
                                    if let Some(annotations) = part["annotations"].as_array() {
                                        for source in annotations {
                                            if source["type"] == "url_citation" {
                                                count_source(
                                                    source,
                                                    &mut source_count,
                                                    &mut missing_url,
                                                    &mut unsafe_url,
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    _ => output_counts[2] += 1,
                }
            }
        }
    }
    json!({"httpStatus":status,"requestIdPresent":request_id_present,"bodyBytes":bytes.len(),"utf8":utf8.is_ok(),"isSse":is_sse,"eventCounts":{"completed":counts[0],"failed":counts[1],"incomplete":counts[2],"textDelta":counts[3],"error":counts[4],"other":counts[5]},"completedStatus":completed_status,"outputCounts":{"webSearch":output_counts[0],"message":output_counts[1],"other":output_counts[2]},"sourceCount":source_count,"completedSearchCount":completed_search_count,"missingUrlCount":missing_url,"unsafeUrlCount":unsafe_url,"textBytes":text_bytes,"malformedFrames":malformed,"apiErrorCode":api_code,"apiErrorType":api_type,"apiErrorParam":api_param})
}
fn count_source(source: &Value, count: &mut u64, missing: &mut u64, unsafe_count: &mut u64) {
    *count += 1;
    let Some(url) = source["url"].as_str() else {
        *missing += 1;
        return;
    };
    let safe = reqwest::Url::parse(url).is_ok_and(|url| {
        url.scheme() == "https"
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
    });
    if !safe {
        *unsafe_count += 1;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn plain_json_http_error_keeps_only_allowlisted_fields() {
        let summary = summarize(400, false, br#"{"error":{"code":"unsupported_value","type":"invalid_request_error","param":"tools","message":"SECRET"}}"#);
        assert_eq!(summary["isSse"], false);
        assert_eq!(summary["apiErrorCode"], "unsupported_value");
        assert_eq!(summary["apiErrorType"], "invalid_request_error");
        assert_eq!(summary["apiErrorParam"], "tools");
        assert!(!summary.to_string().contains("SECRET"));
    }
    #[test]
    fn diagnostic_file_cannot_overwrite_previous_evidence() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("diagnostic.json");
        write_new(&path, &json!({"stage":"reservedBeforeHttp"})).unwrap();
        let original = std::fs::read(&path).unwrap();
        assert_eq!(
            write_new(&path, &json!({"stage":"changed"}))
                .unwrap_err()
                .kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(std::fs::read(&path).unwrap(), original);
    }
    #[test]
    fn summary_redacts_all_untrusted_strings() {
        let body = b"data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"SECRET-PROMPT\",\"annotations\":[{\"type\":\"url_citation\",\"url\":\"https://private.example/SECRET-URL\"}]}]}]}}\n\n";
        let summary = summarize(200, true, body);
        let encoded = summary.to_string();
        assert!(!encoded.contains("SECRET"));
        assert!(!encoded.contains("private.example"));
        assert_eq!(summary["sourceCount"], 1);
        assert_eq!(summary["eventCounts"]["completed"], 1);
    }
    #[test]
    fn unknown_errors_and_malformed_frames_are_bounded_categories() {
        let summary = summarize(400, false, b"data: {\"type\":\"error\",\"error\":{\"code\":\"secret-code\",\"param\":\"secret-param\",\"message\":\"secret-message\"}}\n\ndata: {\n\n");
        assert_eq!(summary["apiErrorCode"], "unknown");
        assert_eq!(summary["malformedFrames"], 1);
        assert!(!summary.to_string().contains("secret"));
    }
}
