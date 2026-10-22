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
#[test]
fn synthetic_event_names_are_fixed_and_sensitive_unknowns_never_emit() {
    let bytes = b"data: {\"type\":\"response.created\"}\n\ndata: {\"type\":\"PRIVATE-TOKEN-event\"}\n\ndata: {\"type\":\"response.web_search_call.completed\",\"item_id\":\"SECRET-ID\"}\n\n";
    let summary = summarize(200, false, bytes);
    assert_eq!(summary["streamEventCounts"]["created"], 1);
    assert_eq!(summary["streamEventCounts"]["unknown"], 1);
    assert_eq!(summary["toolLifecycleCounts"]["completed"], 1);
    assert!(!summary.to_string().contains("PRIVATE"));
    assert!(!summary.to_string().contains("SECRET"));
}
#[test]
fn synthetic_final_output_and_completed_items_are_separate() {
    let bytes = b"data: {\"type\":\"response.output_item.done\",\"output_index\":0,\"item\":{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"SECRET\"}]}}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[]}}\n\n";
    let summary = summarize(200, false, bytes);
    assert_eq!(summary["completedItemCounts"]["message"], 1);
    assert_eq!(summary["outputCounts"]["message"], 0);
    assert_eq!(summary["finalOutput"]["present"], true);
    assert_eq!(summary["finalOutput"]["kind"], "array");
    assert_eq!(summary["finalOutput"]["count"], 0);
    assert!(!summary.to_string().contains("SECRET"));
}
#[test]
fn synthetic_final_output_missing_and_wrong_type_are_distinct() {
    for (response, present, kind) in [
        (json!({"status":"completed"}), false, "missing"),
        (json!({"status":"completed","output":{}}), true, "object"),
    ] {
        let bytes = format!(
            "data: {}\n\n",
            json!({"type":"response.completed","response":response})
        );
        let summary = summarize(200, false, bytes.as_bytes());
        assert_eq!(summary["finalOutput"]["present"], present);
        assert_eq!(summary["finalOutput"]["kind"], kind);
    }
}
#[test]
fn synthetic_tool_lifecycle_is_not_source_evidence() {
    let bytes = b"data: {\"type\":\"response.web_search_call.in_progress\",\"item_id\":\"PRIVATE\"}\n\ndata: {\"type\":\"response.web_search_call.searching\"}\n\ndata: {\"type\":\"response.web_search_call.completed\"}\n\n";
    let summary = summarize(200, false, bytes);
    assert_eq!(
        summary["toolLifecycleCounts"],
        json!({"inProgress":1,"searching":1,"completed":1})
    );
    assert_eq!(summary["sourceCount"], 0);
    assert_eq!(summary["completedSearchCount"], 0);
    assert!(!summary.to_string().contains("PRIVATE"));
}
#[test]
fn synthetic_in_progress_output_is_not_counted_as_final_output() {
    let bytes = b"data: {\"type\":\"response.in_progress\",\"response\":{\"status\":\"in_progress\",\"output\":[{\"type\":\"message\"}]}}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[]}}\n\n";
    let summary = summarize(200, false, bytes);
    assert_eq!(summary["streamEventCounts"]["inProgress"], 1);
    assert_eq!(summary["outputCounts"]["message"], 0);
    assert_eq!(summary["finalOutput"]["messagePresent"], false);
}
#[test]
fn synthetic_completed_item_evidence_is_counted_without_leaking_or_final_output() {
    let bytes = b"data: {\"type\":\"response.output_item.done\",\"output_index\":0,\"item\":{\"type\":\"web_search_call\",\"status\":\"completed\",\"action\":{\"sources\":[{\"url\":\"https://example.org/SECRET\"}]}}}\n\ndata: {\"type\":\"response.output_item.done\",\"output_index\":1,\"item\":{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"SECRET\",\"annotations\":[{\"type\":\"url_citation\",\"url\":\"http://example.org/SECRET\"},{\"type\":\"url_citation\"}]}]}}\n\n";
    let summary = summarize(200, false, bytes);
    assert_eq!(
        summary["completedItemEvidence"],
        json!({"completedSearchCount":1,"sourceCount":3,"textBytes":6,"missingUrlCount":1,"unsafeUrlCount":1})
    );
    assert_eq!(summary["sourceCount"], 0);
    assert_eq!(summary["textBytes"], 0);
    assert_eq!(summary["outputCounts"]["message"], 0);
    assert!(!summary.to_string().contains("SECRET"));
    assert!(!summary.to_string().contains("example.org"));
}
#[test]
fn known_reasoning_event_types_have_separate_fixed_counters() {
    let bytes = b"data: {\"type\":\"response.reasoning_text.delta\",\"delta\":\"SECRET\"}\n\ndata: {\"type\":\"response.reasoning_summary_text.delta\",\"delta\":\"SECRET\"}\n\n";
    let summary = summarize(200, false, bytes);
    assert_eq!(summary["streamEventCounts"]["reasoningTextDelta"], 1);
    assert_eq!(summary["streamEventCounts"]["reasoningSummaryTextDelta"], 1);
    assert!(!summary.to_string().contains("SECRET"));
}
