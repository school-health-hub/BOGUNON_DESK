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
                require_before_terminal(terminal)?;
                let (index, item) = indexed_item(&event)?;
                validate_completed_item(item)?;
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
    reconcile(terminal, final_output, items)
}

fn reconcile(
    terminal: bool,
    final_output: Option<Vec<Value>>,
    items: BTreeMap<u64, Value>,
) -> Result<Vec<Value>, ParseError> {
    if !terminal {
        return Err(ParseError::MissingCompletion);
    }
    if let Some(output) = final_output {
        for (index, item) in &items {
            let index = usize::try_from(*index).map_err(|_| ParseError::InvalidItem)?;
            if output.get(index) != Some(item) {
                return Err(ParseError::ConflictingOutput);
            }
        }
        if output.is_empty() {
            return Err(ParseError::MissingOutput);
        }
        for item in &output {
            validate_final_item(item)?;
        }
        return Ok(output);
    }
    if items.is_empty() {
        return Err(ParseError::MissingOutput);
    }
    require_contiguous(&items)?;
    Ok(items.into_values().collect())
}

fn require_before_terminal(terminal: bool) -> Result<(), ParseError> {
    if terminal {
        Err(ParseError::ItemAfterCompletion)
    } else {
        Ok(())
    }
}

fn indexed_item(event: &Value) -> Result<(u64, &Value), ParseError> {
    let index = event
        .get("output_index")
        .and_then(Value::as_u64)
        .filter(|index| *index < 100)
        .ok_or(ParseError::InvalidItem)?;
    let item = event
        .get("item")
        .filter(|item| item.is_object())
        .ok_or(ParseError::InvalidItem)?;
    Ok((index, item))
}

fn validate_completed_item(item: &Value) -> Result<(), ParseError> {
    item.get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty() && id.len() <= 256)
        .ok_or(ParseError::InvalidItem)?;
    validate_item_shape(item, true)
}

fn validate_final_item(item: &Value) -> Result<(), ParseError> {
    validate_item_shape(item, true)
}

fn validate_item_shape(item: &Value, require_completed_status: bool) -> Result<(), ParseError> {
    let kind = item
        .get("type")
        .and_then(Value::as_str)
        .filter(|kind| !kind.is_empty() && kind.len() <= 64)
        .ok_or(ParseError::InvalidItem)?;
    if matches!(kind, "message" | "web_search_call") {
        match item.get("status") {
            Some(Value::String(status)) if status == "completed" => {}
            None if !require_completed_status => {}
            _ => return Err(ParseError::IncompleteItem),
        }
    }
    if kind == "message" {
        match item.get("role") {
            Some(Value::String(role)) if role == "assistant" => {}
            None if !require_completed_status => {}
            _ => return Err(ParseError::InvalidItem),
        }
        let content = item
            .get("content")
            .and_then(Value::as_array)
            .ok_or(ParseError::InvalidItem)?;
        if content.iter().any(|part| {
            !matches!(
                part.get("type").and_then(Value::as_str),
                Some("output_text" | "refusal")
            )
        }) {
            return Err(ParseError::InvalidItem);
        }
    }
    Ok(())
}

fn require_contiguous(items: &BTreeMap<u64, Value>) -> Result<(), ParseError> {
    if items.keys().copied().eq(0..items.len() as u64) {
        Ok(())
    } else {
        Err(ParseError::InvalidItem)
    }
}
