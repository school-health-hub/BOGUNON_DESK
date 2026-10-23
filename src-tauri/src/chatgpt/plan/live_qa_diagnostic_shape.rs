//! Fixed-key structural counters; all untrusted strings remain in memory only.
use serde_json::{json, Value};
use std::collections::BTreeMap;
const EVENT_TYPES: &[(&str, &str)] = &[
    ("response.created", "created"),
    ("response.in_progress", "inProgress"),
    ("response.completed", "completed"),
    ("response.failed", "failed"),
    ("response.incomplete", "incomplete"),
    ("response.output_item.added", "outputItemAdded"),
    ("response.output_item.done", "outputItemDone"),
    ("response.content_part.added", "contentPartAdded"),
    ("response.content_part.done", "contentPartDone"),
    ("response.output_text.delta", "textDelta"),
    ("response.output_text.done", "textDone"),
    ("response.output_text.annotation.added", "annotationAdded"),
    (
        "response.web_search_call.in_progress",
        "webSearchInProgress",
    ),
    ("response.web_search_call.searching", "webSearchSearching"),
    ("response.web_search_call.completed", "webSearchCompleted"),
    (
        "response.reasoning_summary_part.added",
        "reasoningSummaryPartAdded",
    ),
    (
        "response.reasoning_summary_part.done",
        "reasoningSummaryPartDone",
    ),
    (
        "response.reasoning_summary_text.delta",
        "reasoningSummaryTextDelta",
    ),
    (
        "response.reasoning_summary_text.done",
        "reasoningSummaryTextDone",
    ),
    ("response.reasoning_text.delta", "reasoningTextDelta"),
    ("response.reasoning_text.done", "reasoningTextDone"),
    ("error", "error"),
];
#[derive(Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ItemEvidence {
    completed_search_count: u64,
    source_count: u64,
    text_bytes: u64,
    missing_url_count: u64,
    unsafe_url_count: u64,
}
impl ItemEvidence {
    fn source(&mut self, source: &Value) {
        super::count_source(
            source,
            &mut self.source_count,
            &mut self.missing_url_count,
            &mut self.unsafe_url_count,
        );
    }
    fn item(&mut self, item: &Value) {
        if item["type"] == "web_search_call" {
            if item["status"] == "completed" {
                self.completed_search_count += 1;
            }
            if let Some(sources) = item["action"]["sources"].as_array() {
                for source in sources {
                    self.source(source);
                }
            }
        }
        if item["type"] == "message" {
            if let Some(content) = item["content"].as_array() {
                for part in content {
                    if part["type"] != "output_text" {
                        continue;
                    }
                    self.text_bytes += part["text"].as_str().map_or(0, |text| text.len() as u64);
                    if let Some(annotations) = part["annotations"].as_array() {
                        for source in annotations {
                            if source["type"] == "url_citation" {
                                self.source(source);
                            }
                        }
                    }
                }
            }
        }
    }
}
pub(super) struct Shape {
    pub(super) events: Value,
    pub(super) lifecycle: Value,
    pub(super) completed_items: Value,
    pub(super) final_output: Value,
    pub(super) completed_item_evidence: ItemEvidence,
    pub(super) completed_item_shapes: Vec<Value>,
    pub(super) linked_content_events: Vec<Value>,
    pub(super) response_meta: Value,
    item_refs: BTreeMap<String, u64>,
}
impl Shape {
    pub(super) fn new() -> Self {
        let mut events = json!({"unknown":0});
        for (_, key) in EVENT_TYPES {
            events[*key] = json!(0);
        }
        Self {
            events,
            completed_item_evidence: ItemEvidence::default(),
            lifecycle: json!({"inProgress":0,"searching":0,"completed":0}),
            completed_items: json!({"webSearch":0,"message":0,"reasoning":0,"other":0}),
            final_output: json!({"present":false,"kind":"missing","count":0,"messagePresent":false,"sourcePresent":false}),
            completed_item_shapes: Vec::new(),
            linked_content_events: Vec::new(),
            response_meta: json!({"idPresent":false,"status":"unknown","incompleteDetailsPresent":false,"usagePresent":false}),
            item_refs: BTreeMap::new(),
        }
    }
    pub(super) fn event(&mut self, event: &Value) {
        let kind = event["type"].as_str().unwrap_or("");
        let key = EVENT_TYPES
            .iter()
            .find(|(known, _)| *known == kind)
            .map_or("unknown", |(_, key)| *key);
        increment(&mut self.events, key);
        match kind {
            "response.web_search_call.in_progress" => increment(&mut self.lifecycle, "inProgress"),
            "response.web_search_call.searching" => increment(&mut self.lifecycle, "searching"),
            "response.web_search_call.completed" => increment(&mut self.lifecycle, "completed"),
            "response.output_item.added" => {
                self.remember_item(&event["item"]);
            }
            "response.output_item.done" => {
                increment(&mut self.completed_items, item_kind(&event["item"]));
                self.completed_item_evidence.item(&event["item"]);
                self.completed_item(event);
            }
            "response.content_part.added"
            | "response.content_part.done"
            | "response.output_text.delta"
            | "response.output_text.done" => {
                self.content_event(kind, event);
            }
            "response.completed" => {
                self.response(&event["response"]);
            }
            _ => {}
        }
    }

    pub(super) fn response(&mut self, response: &Value) {
        self.response_meta = json!({
            "idPresent": nonempty(response["id"].as_str()),
            "status": allowed_status(response["status"].as_str()),
            "incompleteDetailsPresent": response.get("incomplete_details").is_some_and(|value| !value.is_null()),
            "usagePresent": response.get("usage").is_some_and(Value::is_object),
        });
        let output = response.get("output");
        let kind = match output {
            None => "missing",
            Some(Value::Null) => "null",
            Some(Value::Array(_)) => "array",
            Some(Value::Object(_)) => "object",
            Some(Value::String(_)) => "string",
            Some(Value::Bool(_)) => "boolean",
            Some(Value::Number(_)) => "number",
        };
        self.final_output["present"] = json!(output.is_some());
        self.final_output["kind"] = json!(kind);
        self.final_output["count"] = json!(output.and_then(Value::as_array).map_or(0, Vec::len));
    }

    fn remember_item(&mut self, item: &Value) {
        let Some(id) = item["id"].as_str().filter(|id| nonempty(Some(id))) else {
            return;
        };
        if self.item_refs.len() >= 100 || self.item_refs.contains_key(id) {
            return;
        }
        self.item_refs
            .insert(id.to_owned(), self.item_refs.len() as u64);
    }

    fn item_ref(&self, id: Option<&str>) -> Option<u64> {
        let id = id.filter(|id| nonempty(Some(id)))?;
        self.item_refs.get(id).copied()
    }

    fn completed_item(&mut self, event: &Value) {
        if self.completed_item_shapes.len() >= 100 {
            return;
        }
        let item = &event["item"];
        self.remember_item(item);
        let Some(item_ref) = self.item_ref(item["id"].as_str()) else {
            return;
        };
        let Some(output_index) = event["output_index"].as_u64().filter(|index| *index < 100) else {
            return;
        };
        self.completed_item_shapes.push(json!({
            "itemRef": item_ref,
            "outputIndex": output_index,
            "type": allowed_item_type(item["type"].as_str()),
            "status": allowed_status(item["status"].as_str()),
            "role": allowed_role(item["role"].as_str()),
            "contentTypes": content_types(&item["content"]),
        }));
    }

    fn content_event(&mut self, kind: &str, event: &Value) {
        if self.linked_content_events.len() >= 200 {
            return;
        }
        let Some(item_ref) = self.item_ref(event["item_id"].as_str()) else {
            return;
        };
        let Some(output_index) = event["output_index"].as_u64().filter(|index| *index < 100) else {
            return;
        };
        let Some(content_index) = event["content_index"].as_u64().filter(|index| *index < 100)
        else {
            return;
        };
        let part_type = event["part"]["type"].as_str();
        self.linked_content_events.push(json!({
            "event": allowed_content_event(kind),
            "itemRef": item_ref,
            "outputIndex": output_index,
            "contentIndex": content_index,
            "contentType": if kind.starts_with("response.output_text.") { "outputText" } else { allowed_content_type(part_type) },
        }));
    }
}
fn increment(counts: &mut Value, key: &'static str) {
    counts[key] = json!(counts[key].as_u64().unwrap_or(0).saturating_add(1));
}
fn item_kind(item: &Value) -> &'static str {
    match item["type"].as_str() {
        Some("web_search_call") => "webSearch",
        Some("message") => "message",
        Some("reasoning") => "reasoning",
        _ => "other",
    }
}

fn nonempty(value: Option<&str>) -> bool {
    value.is_some_and(|value| !value.is_empty() && value.len() <= 256)
}

fn allowed_item_type(value: Option<&str>) -> &'static str {
    match value {
        Some("web_search_call") => "webSearch",
        Some("message") => "message",
        Some("reasoning") => "reasoning",
        _ => "unknown",
    }
}

fn allowed_status(value: Option<&str>) -> &'static str {
    match value {
        Some("completed") => "completed",
        Some("failed") => "failed",
        Some("incomplete") => "incomplete",
        Some("in_progress") => "inProgress",
        _ => "unknown",
    }
}

fn allowed_role(value: Option<&str>) -> &'static str {
    match value {
        Some("assistant") => "assistant",
        Some("user") => "user",
        Some("system") => "system",
        Some("developer") => "developer",
        _ => "unknown",
    }
}

fn allowed_content_event(value: &str) -> &'static str {
    match value {
        "response.content_part.added" => "contentPartAdded",
        "response.content_part.done" => "contentPartDone",
        "response.output_text.delta" => "outputTextDelta",
        "response.output_text.done" => "outputTextDone",
        _ => "unknown",
    }
}

fn allowed_content_type(value: Option<&str>) -> &'static str {
    match value {
        Some("output_text") => "outputText",
        Some("refusal") => "refusal",
        Some("reasoning_text") => "reasoningText",
        _ => "unknown",
    }
}

fn content_types(content: &Value) -> Value {
    let mut output_text = 0u64;
    let mut refusal = 0u64;
    let mut other = 0u64;
    if let Some(parts) = content.as_array() {
        for part in parts {
            match part["type"].as_str() {
                Some("output_text") => output_text += 1,
                Some("refusal") => refusal += 1,
                _ => other += 1,
            }
        }
    }
    json!({"outputText":output_text,"refusal":refusal,"other":other})
}
