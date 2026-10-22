//! Fixed-key structural counters; all untrusted strings remain in memory only.
use serde_json::{json, Value};
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
            "response.output_item.done" => {
                increment(&mut self.completed_items, item_kind(&event["item"]));
                self.completed_item_evidence.item(&event["item"]);
            }
            "response.completed" => {
                let output = event["response"].get("output");
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
                self.final_output["count"] =
                    json!(output.and_then(Value::as_array).map_or(0, Vec::len));
            }
            _ => {}
        }
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
