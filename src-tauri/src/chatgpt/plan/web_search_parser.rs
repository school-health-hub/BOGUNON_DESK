use serde::Serialize;
use serde_json::Value;
#[path = "web_search_error.rs"]
mod error;
use error::ParseError;
#[path = "web_search_stream.rs"]
mod stream;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebSearchResult {
    text: String,
    sources: Vec<WebSource>,
    checked_at: String,
}
#[derive(Debug, Serialize)]
pub(crate) struct WebSource {
    url: String,
    title: String,
}

pub(crate) fn supported_model(model: &str) -> bool {
    matches!(
        model,
        "gpt-6-astra" | "gpt-6.1-sol" | "gpt-6-sol" | "gpt-5.6-luna"
    )
}

pub(crate) fn request_body(model: &str, prompt: &str) -> Value {
    serde_json::json!({
        "model":model,"input":[{"role":"user","content":prompt}],
        "store":false,"stream":true,"tools":[{"type":"web_search"}],
        "tool_choice":"required","include":["web_search_call.action.sources"]
    })
}

pub(crate) fn diagnose(body: &[u8]) -> &'static str {
    match parse(body, 0) {
        Ok(_) => "accepted",
        Err(error) => error.code(),
    }
}

pub(crate) fn parse(body: &[u8], checked_at: u64) -> Result<WebSearchResult, ParseError> {
    let output = stream::output(body)?;
    let mut searched = false;
    let mut sources = Vec::new();
    let mut text = String::new();
    for item in &output {
        match item.get("type").and_then(Value::as_str) {
            Some("web_search_call") => {
                if item.get("status").and_then(Value::as_str) != Some("completed") {
                    return Err(ParseError::IncompleteItem);
                }
                searched = true;
                if let Some(items) = item.pointer("/action/sources").and_then(Value::as_array) {
                    for source in items {
                        add_source(&mut sources, source)?;
                    }
                }
            }
            Some("message") => {
                if item
                    .get("status")
                    .is_some_and(|status| status != "completed")
                {
                    return Err(ParseError::IncompleteItem);
                }
                if let Some(content) = item.get("content").and_then(Value::as_array) {
                    for part in content {
                        if part.get("type").and_then(Value::as_str) != Some("output_text") {
                            continue;
                        }
                        text.push_str(
                            part.get("text")
                                .and_then(Value::as_str)
                                .ok_or(ParseError::MissingText)?,
                        );
                        if let Some(items) = part.get("annotations").and_then(Value::as_array) {
                            for source in items {
                                if source.get("type").and_then(Value::as_str)
                                    == Some("url_citation")
                                {
                                    add_source(&mut sources, source)?;
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
    if !searched {
        return Err(ParseError::MissingSearch);
    }
    if text.trim().is_empty() {
        return Err(ParseError::MissingText);
    }
    // An explicit empty Finder result cannot create an unverified candidate.
    if sources.is_empty() && !empty_finder_result(&text) {
        return Err(ParseError::MissingSources);
    }
    Ok(WebSearchResult {
        text,
        sources,
        checked_at: iso_time(checked_at)?,
    })
}

fn empty_finder_result(text: &str) -> bool {
    #[derive(serde::Deserialize)]
    #[serde(deny_unknown_fields)]
    struct EmptyResult {
        videos: Vec<Value>,
    }
    serde_json::from_str::<EmptyResult>(text).is_ok_and(|result| result.videos.is_empty())
}

fn add_source(sources: &mut Vec<WebSource>, value: &Value) -> Result<(), ParseError> {
    let raw = value
        .get("url")
        .and_then(Value::as_str)
        .ok_or(ParseError::UnsafeSource)?;
    let url = reqwest::Url::parse(raw).map_err(|_| ParseError::UnsafeSource)?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(ParseError::UnsafeSource);
    }
    let title = value
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if let Some(existing) = sources.iter_mut().find(|source| source.url == url.as_str()) {
        if existing.title.trim().is_empty() && !title.is_empty() {
            existing.title = title.to_owned();
        }
    } else {
        if sources.len() >= 100 {
            return Err(ParseError::UnsafeSource);
        }
        sources.push(WebSource {
            url: url.to_string(),
            title: title.to_owned(),
        });
    }
    Ok(())
}

fn iso_time(seconds: u64) -> Result<String, ParseError> {
    let seconds = i64::try_from(seconds).map_err(|_| ParseError::InvalidTimestamp)?;
    let z = seconds / 86400 + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    Ok(format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.000Z",
        seconds / 3600 % 24,
        seconds / 60 % 60,
        seconds % 60
    ))
}

#[cfg(test)]
#[path = "web_search_parser_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "web_search_stream_tests.rs"]
mod stream_tests;
