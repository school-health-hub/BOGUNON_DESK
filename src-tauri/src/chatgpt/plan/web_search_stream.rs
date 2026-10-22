use super::ParseError;
use serde_json::Value;
use std::collections::BTreeMap;

pub(super) fn output(body: &[u8]) -> Result<Vec<Value>, ParseError> {
    let stream = std::str::from_utf8(body)
        .map_err(|_| ParseError::InvalidUtf8)?
        .replace("\r\n", "\n");
    let mut final_output = None;
    let mut items = BTreeMap::new();
    let mut terminal = false;
    for frame in stream.split("\n\n") {
        let data = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim))
            .collect::<Vec<_>>()
            .join("\n");
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let event: Value = serde_json::from_str(&data).map_err(|_| ParseError::MalformedEvent)?;
        let kind = event
            .get("type")
            .and_then(Value::as_str)
            .ok_or(ParseError::MalformedEvent)?;
        match kind {
            "error" | "response.failed" | "response.incomplete" => {
                return Err(ParseError::FailedStream)
            }
            "response.completed" => {
                if terminal {
                    return Err(ParseError::DuplicateCompletion);
                }
                terminal = true;
                let response = event.get("response").ok_or(ParseError::InvalidStatus)?;
                if response.get("status").and_then(Value::as_str) != Some("completed") {
                    return Err(ParseError::InvalidStatus);
                }
                final_output = match response.get("output") {
                    Some(Value::Array(output)) => Some(output.clone()),
                    None => None,
                    Some(_) => return Err(ParseError::InvalidOutput),
                };
            }
            "response.output_item.done" => {
                if terminal {
                    return Err(ParseError::ItemAfterCompletion);
                }
                let index = event
                    .get("output_index")
                    .and_then(Value::as_u64)
                    .filter(|index| *index < 100)
                    .ok_or(ParseError::InvalidItem)?;
                let item = event
                    .get("item")
                    .filter(|item| item.is_object())
                    .ok_or(ParseError::InvalidItem)?;
                if item
                    .get("id")
                    .and_then(Value::as_str)
                    .is_none_or(str::is_empty)
                {
                    return Err(ParseError::InvalidItem);
                }
                if matches!(
                    item.get("type").and_then(Value::as_str),
                    Some("message" | "web_search_call")
                ) && item.get("status").and_then(Value::as_str) != Some("completed")
                {
                    return Err(ParseError::IncompleteItem);
                }
                if items
                    .values()
                    .any(|existing: &Value| existing.get("id") == item.get("id"))
                    || items.insert(index, item.clone()).is_some()
                {
                    return Err(ParseError::DuplicateItem);
                }
            }
            _ => {}
        }
    }
    if !terminal {
        return Err(ParseError::MissingCompletion);
    }
    if let Some(output) = final_output {
        for (index, item) in items {
            let index = usize::try_from(index).map_err(|_| ParseError::InvalidItem)?;
            if output.get(index) != Some(&item) {
                return Err(ParseError::ConflictingOutput);
            }
        }
        if output.is_empty() {
            return Err(ParseError::MissingOutput);
        }
        return Ok(output);
    }
    if items.is_empty() {
        return Err(ParseError::MissingOutput);
    }
    Ok(items.into_values().collect())
}
