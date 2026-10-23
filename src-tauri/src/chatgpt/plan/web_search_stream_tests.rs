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
        json!({"id":"msg_synthetic","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"{\"videos\":[]}","annotations":[]}]}),
    ]
}
fn done_items(output: Vec<Value>) -> Vec<Value> {
    output.into_iter().enumerate().map(|(index,item)| json!({"type":"response.output_item.done","output_index":index,"item":item})).collect()
}
fn added_items(output: &[Value]) -> Vec<Value> {
    output.iter().enumerate().map(|(index,item)| json!({"type":"response.output_item.added","output_index":index,"item":{"id":item["id"],"type":item["type"],"status":"in_progress","role":item.get("role").cloned().unwrap_or(Value::Null),"content":[]}})).collect()
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
    let output = items();
    let mut events = added_items(&output);
    events.extend(done_items(output));
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
    let output = items();
    let mut events = added_items(&output);
    events.extend(done_items(output));
    assert_eq!(diagnose(&stream(events)), "missingCompletion");
    assert_eq!(
        diagnose(&stream(vec![completed(json!(items()))])),
        "accepted"
    );
}
#[test]
fn synthetic_done_sources_still_require_safe_urls_and_completed_status() {
    let mut unsafe_items = items();
    unsafe_items[0]["action"]["sources"][0]["url"] = json!("javascript:unsafe");
    let mut events = added_items(&unsafe_items);
    events.extend(done_items(unsafe_items));
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert_eq!(diagnose(&stream(events)), "unsafeOrMissingSourceUrl");
    let mut partial = items();
    partial[1]["status"] = json!("in_progress");
    let mut events = added_items(&partial);
    events.extend(done_items(partial));
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
fn synthetic_explicit_empty_final_output_is_not_recovered() {
    // Given: completed item events followed by an authoritative empty final output.
    let mut events = done_items(items());
    events.push(completed(json!([])));
    // When: the stream is reconciled.
    let reason = diagnose(&stream(events));
    // Then: item events do not override the explicit terminal representation.
    assert_eq!(reason, "conflictingOutput");
}

#[test]
fn synthetic_duplicate_done_is_rejected() {
    let completed_items = done_items(items());
    let mut events = completed_items.clone();
    events.extend(completed_items.clone());
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert_eq!(diagnose(&stream(events)), "duplicateItem");
}

#[test]
fn synthetic_missing_final_output_uses_completed_item_fallback() {
    // Given: valid completed items and a terminal response whose output field is absent.
    let mut events = done_items(items());
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    // When/Then: the established missing-output fallback remains available.
    assert_eq!(diagnose(&stream(events)), "accepted");
}

#[test]
fn synthetic_non_streaming_response_is_not_newly_allowed() {
    // Given: a JSON response outside the established SSE contract.
    let response = json!({"id":"resp_synthetic","status":"completed","output":items(),"usage":{"total_tokens":42}});
    // When/Then: it is rejected instead of bypassing item validation.
    assert_eq!(
        diagnose(response.to_string().as_bytes()),
        "missingCompletion"
    );
}

#[test]
fn synthetic_final_output_rejects_invalid_role_status_and_content() {
    // Given: three malformed assistant-message variants in final output.
    let mut invalid_role = items();
    invalid_role[1]["role"] = json!("user");
    let mut invalid_status = items();
    invalid_status[1]["status"] = json!("in_progress");
    let mut invalid_role_type = items();
    invalid_role_type[1]["role"] = json!(42);
    let mut invalid_status_type = items();
    invalid_status_type[1]["status"] = json!(42);
    let mut missing_role = items();
    missing_role[1].as_object_mut().unwrap().remove("role");
    let mut missing_status = items();
    missing_status[1].as_object_mut().unwrap().remove("status");
    let mut invalid_content = items();
    invalid_content[1]["content"][0]["type"] = json!("input_text");
    // When/Then: each terminal representation fails closed.
    assert_eq!(
        diagnose(&stream(vec![completed(json!(invalid_role))])),
        "invalidCompletedItem"
    );
    assert_eq!(
        diagnose(&stream(vec![completed(json!(invalid_status))])),
        "incompleteItem"
    );
    assert_eq!(
        diagnose(&stream(vec![completed(json!(invalid_role_type))])),
        "invalidCompletedItem"
    );
    assert_eq!(
        diagnose(&stream(vec![completed(json!(invalid_status_type))])),
        "incompleteItem"
    );
    assert_eq!(
        diagnose(&stream(vec![completed(json!(missing_role))])),
        "invalidCompletedItem"
    );
    assert_eq!(
        diagnose(&stream(vec![completed(json!(missing_status))])),
        "incompleteItem"
    );
    assert_eq!(
        diagnose(&stream(vec![completed(json!(invalid_content))])),
        "invalidCompletedItem"
    );
}

#[test]
fn synthetic_refusal_and_short_notice_do_not_become_search_results() {
    let mut refusal = items();
    refusal[1]["content"] = json!([{"type":"refusal","refusal":"no"}]);
    let mut events = done_items(refusal);
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    assert_eq!(diagnose(&stream(events)), "missingText");

    let mut notice = items();
    notice[1]["content"][0]["text"] = json!("잠시 후 다시 시도해 주세요.");
    let mut events = done_items(notice);
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    let parsed = parse(&stream(events), 0).expect("structurally complete short message");
    assert_eq!(parsed.text, "잠시 후 다시 시도해 주세요.");
}

#[test]
fn synthetic_failed_tool_and_quota_response_stay_fail_closed() {
    let failed = stream(vec![
        json!({"type":"response.failed","response":{"status":"failed","error":{"code":"tool_error"}}}),
    ]);
    assert_eq!(diagnose(&failed), "failedStream");
    let quota = br#"{"error":{"type":"rate_limit_error","code":"rate_limit_exceeded"}}"#;
    assert_eq!(diagnose(quota), "missingCompletion");
}

#[test]
fn synthetic_matching_final_output_preserves_completed_item_order() {
    // Given: the same completed items in both representations.
    let output = items();
    let mut events = added_items(&output);
    events.extend(done_items(output.clone()));
    events.push(completed(json!(output)));
    // When: the production parser reconciles the synthetic stream.
    let result = parse(&stream(events), 0).expect("matching completed output");
    // Then: the message and its source survive reconciliation.
    assert_eq!(result.text, "{\"videos\":[]}");
    assert_eq!(result.sources.len(), 1);
}

#[test]
fn synthetic_search_tools_without_message_are_not_recommendations() {
    // Given: a completed search with a source but no message.
    let output = vec![items()[0].clone()];
    let mut events = added_items(&output);
    events.extend(done_items(output));
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    // When: the production parser sees only tool evidence.
    let reason = diagnose(&stream(events));
    // Then: a source is not promoted into a recommendation.
    assert_eq!(reason, "missingText");
}

#[test]
fn synthetic_qa3_count_shape_without_lifecycle_links_stays_fail_closed() {
    // Given: invented values matching counts, NOT the unavailable original SSE.
    let mut output: Vec<Value> = (0..3)
        .map(|index| json!({"id":format!("synthetic_reasoning_{index}"),"type":"reasoning","summary":[]}))
        .collect();
    for index in 0..6 {
        let count = if index == 0 { 17 } else { 13 };
        let sources: Vec<Value> = (0..count)
            .map(|source| json!({"url":format!("https://example.org/synthetic/{index}/{source}"),"title":"Synthetic source"}))
            .collect();
        output.push(json!({"id":format!("synthetic_search_{index}"),"type":"web_search_call","status":"completed","action":{"type":"search","sources":sources}}));
    }
    output.push(items()[1].clone());
    let mut events = done_items(output);
    events.push(completed(json!([])));
    // When: completed items coexist with an explicitly empty final array.
    let reason = diagnose(&stream(events));
    assert_eq!(reason, "conflictingOutput");
}

#[test]
fn synthetic_duplicate_ids_at_different_indices_are_rejected() {
    // Given: two different indices claiming the same completed item ID.
    let mut output = items();
    output[1]["id"] = output[0]["id"].clone();
    let mut events = added_items(&output);
    events.extend(done_items(output));
    events.push(json!({"type":"response.completed","response":{"status":"completed"}}));
    // When: the stream is reconciled.
    let reason = diagnose(&stream(events));
    // Then: ambiguous identity cannot become search evidence.
    assert_eq!(reason, "duplicateItem");
}
