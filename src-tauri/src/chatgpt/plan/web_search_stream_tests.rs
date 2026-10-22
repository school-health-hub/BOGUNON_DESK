use super::*;
use serde_json::json;

fn stream(events: Vec<Value>) -> Vec<u8> {
    events
        .into_iter()
        .map(|event| format!("data: {event}\n\n"))
        .collect::<String>()
        .into_bytes()
}
fn items() -> Vec<Value> {
    vec![
        json!({"id":"ws_synthetic","type":"web_search_call","status":"completed","action":{"type":"search","sources":[{"url":"https://example.org/video","title":"Synthetic source"}]}}),
        json!({"id":"msg_synthetic","type":"message","status":"completed","content":[{"type":"output_text","text":"{\"videos\":[]}","annotations":[]}]}),
    ]
}
fn done_items(output: Vec<Value>) -> Vec<Value> {
    output.into_iter().enumerate().map(|(index,item)| json!({"type":"response.output_item.done","output_index":index,"item":item})).collect()
}
fn completed(output: Value) -> Value {
    json!({"type":"response.completed","response":{"status":"completed","output":output}})
}

#[test]
fn synthetic_done_items_survive_missing_final_output() {
    let mut events = done_items(items());
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    let result = parse(&stream(events), 0).expect("completed official items must not be lost");
    assert_eq!(result.text, "{\"videos\":[]}");
    assert_eq!(result.sources.len(), 1);
}
#[test]
fn synthetic_thin_terminal_requires_completed_items_not_deltas_or_lifecycle() {
    let mut events = done_items(items());
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert!(parse(&stream(events), 0).is_ok());
    let events = vec![
        json!({"type":"response.web_search_call.completed","item_id":"ws_synthetic","output_index":0}),
        json!({"type":"response.output_text.delta","delta":"{\"videos\":[]}"}),
        completed(json!([])),
    ];
    assert!(parse(&stream(events), 0).is_err());
}
#[test]
fn synthetic_empty_search_without_sources_remains_empty_not_a_parse_error() {
    let mut output = items();
    output[0]["action"]["sources"] = json!([]);
    let result =
        parse(&stream(vec![completed(json!(output))]), 0).expect("empty search is not malformed");
    assert!(result.sources.is_empty());
    assert_eq!(result.text, "{\"videos\":[]}");
}
#[test]
fn synthetic_unknown_event_does_not_erase_valid_evidence() {
    let mut events = vec![json!({"type":"future.unknown","text":"untrusted"})];
    events.extend(done_items(items()));
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert!(parse(&stream(events), 0).is_ok());
}
#[test]
fn synthetic_partial_failed_duplicate_and_conflicting_items_are_rejected() {
    let events = done_items(items());
    assert!(parse(&stream(events.clone()), 0).is_err());
    for kind in ["error", "response.failed", "response.incomplete"] {
        let mut failed = events.clone();
        failed.push(json!({"type":kind}));
        failed.push(completed(json!([])));
        assert!(parse(&stream(failed), 0).is_err());
    }
    let mut duplicate = events.clone();
    duplicate.push(events[0].clone());
    duplicate.push(completed(json!([])));
    assert!(parse(&stream(duplicate), 0).is_err());
    let mut conflicting = events;
    let mut final_items = items();
    final_items[1]["content"][0]["text"] = json!("conflicting text");
    conflicting.push(completed(json!(final_items)));
    assert!(parse(&stream(conflicting), 0).is_err());
}
#[test]
fn synthetic_rejection_reason_is_structural_not_provider_text() {
    assert_eq!(
        diagnose(&stream(vec![completed(json!([]))])),
        "missingOutput"
    );
    assert_eq!(diagnose(b"data: {\n\n"), "malformedEvent");
    assert_eq!(
        diagnose(&stream(vec![json!({"type":"error","message":"SECRET"})])),
        "failedStream"
    );
    assert_eq!(diagnose(&stream(done_items(items()))), "missingCompletion");
    assert_eq!(
        diagnose(&stream(vec![completed(json!(items()))])),
        "accepted"
    );
}
#[test]
fn synthetic_done_sources_still_require_safe_urls_and_completed_status() {
    let mut unsafe_items = items();
    unsafe_items[0]["action"]["sources"][0]["url"] = json!("javascript:unsafe");
    let mut events = done_items(unsafe_items);
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert_eq!(diagnose(&stream(events)), "unsafeOrMissingSourceUrl");
    let mut partial = items();
    partial[1]["status"] = json!("in_progress");
    let mut events = done_items(partial);
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert_eq!(diagnose(&stream(events)), "incompleteItem");
}
#[test]
fn synthetic_plain_text_is_not_mislabeled_as_a_completed_search() {
    let output = vec![items()[1].clone()];
    assert_eq!(
        diagnose(&stream(vec![completed(json!(output))])),
        "missingCompletedSearch"
    );
}
#[test]
fn synthetic_present_empty_final_output_cannot_contradict_completed_items() {
    let mut events = done_items(items());
    events.push(completed(json!([])));
    assert_eq!(diagnose(&stream(events)), "conflictingOutput");
}
