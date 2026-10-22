use super::*;
use serde_json::json;
fn body(output: Value) -> Vec<u8> {
    format!(
        "data: {}\n\n",
        json!({"type":"response.completed","response":{"status":"completed","output":output}})
    )
    .into_bytes()
}
#[test]
fn request_requires_web_search_and_no_storage() {
    let body = request_body("gpt-6-astra", "synthetic");
    assert_eq!(body["store"], false);
    assert_eq!(body["stream"], true);
    assert_eq!(body["tool_choice"], "required");
    assert_eq!(body["tools"][0]["type"], "web_search");
    assert_eq!(body["include"][0], "web_search_call.action.sources");
    assert!(body["input"].is_array());
    assert!(supported_model("gpt-6-astra"));
    assert!(!supported_model("gpt-6-astra-untrusted"));
}
fn evidence() -> Value {
    json!([
        {"type":"web_search_call","status":"completed","action":{"sources":[{"url":"https://example.org/video","title":"synthetic"}]}},
        {"type":"message","content":[{"type":"output_text","text":"synthetic result","annotations":[]}]}
    ])
}
#[test]
fn accepts_completed_search_with_structured_sources() {
    let result = parse(&body(evidence()), 0).unwrap();
    assert_eq!(result.sources.len(), 1);
    assert_eq!(result.checked_at, "1970-01-01T00:00:00.000Z");
}
#[test]
fn requires_completed_event_and_search_evidence() {
    assert!(parse(
        b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"searched web\"}\n\n",
        0
    )
    .is_err());
    let mut output = evidence();
    output.as_array_mut().unwrap().remove(0);
    assert!(parse(&body(output), 0).is_err());
}
#[test]
fn rejects_unsafe_source_and_incomplete_search() {
    let mut output = evidence();
    output[0]["action"]["sources"][0]["url"] = json!("http://example.org");
    assert!(parse(&body(output), 0).is_err());
    let mut output = evidence();
    output[0]["status"] = json!("in_progress");
    assert!(parse(&body(output), 0).is_err());
}
#[test]
fn accepts_url_annotations_and_deduplicates() {
    let mut output = evidence();
    output[1]["content"][0]["annotations"] =
        json!([{ "type":"url_citation", "url":"https://example.org/video", "title":"citation" }]);
    assert_eq!(parse(&body(output), 0).unwrap().sources.len(), 1);
}
#[test]
fn later_citation_enriches_missing_source_title() {
    let mut output = evidence();
    output[0]["action"]["sources"][0]
        .as_object_mut()
        .unwrap()
        .remove("title");
    output[1]["content"][0]["annotations"] = json!([
        {"type":"url_citation","url":"https://example.org/video","title":"Provider citation title"},
        {"type":"url_citation","url":"https://example.org/video","title":""}
    ]);
    let result = parse(&body(output), 0).unwrap();
    assert_eq!(result.sources.len(), 1);
    assert_eq!(result.sources[0].title, "Provider citation title");
}
// Synthetic envelopes only; these are not captured live provider responses.
#[test]
fn synthetic_empty_and_non_sse_responses_are_rejected() {
    for input in [
        b"".as_slice(),
        b"data: [DONE]\n\n",
        b"{\"output\":[]}",
        b"data: {\"type\":\"unknown\"}\n\n",
    ] {
        assert!(parse(input, 0).is_err());
    }
}
#[test]
fn synthetic_failed_and_incomplete_events_are_rejected() {
    for kind in ["response.failed", "response.incomplete"] {
        let event = format!(
            "data: {}\n\n",
            json!({"type":kind,"response":{"status":"failed"}})
        );
        assert!(parse(event.as_bytes(), 0).is_err());
    }
}
#[test]
fn synthetic_completed_envelope_requires_status_and_output_array() {
    for response in [
        json!({}),
        json!({"status":"in_progress","output":[]}),
        json!({"status":"completed","output":{}}),
    ] {
        let event = format!(
            "data: {}\n\n",
            json!({"type":"response.completed","response":response})
        );
        assert!(parse(event.as_bytes(), 0).is_err());
    }
}
#[test]
fn synthetic_malformed_json_utf8_and_duplicate_completion_are_rejected() {
    assert!(parse(b"data: {\n\n", 0).is_err());
    assert!(parse(&[0xff], 0).is_err());
    let mut duplicate = body(evidence());
    duplicate.extend(body(evidence()));
    assert!(parse(&duplicate, 0).is_err());
}
#[test]
fn synthetic_missing_sources_are_rejected() {
    let mut output = evidence();
    output[0]["action"]["sources"] = json!([]);
    assert!(parse(&body(output), 0).is_err());
}
#[test]
fn synthetic_missing_or_blank_output_text_is_rejected() {
    for text in [json!("  "), json!(null), json!(42)] {
        let mut output = evidence();
        output[1]["content"][0]["text"] = text;
        assert!(parse(&body(output), 0).is_err());
    }
}
#[test]
fn synthetic_citation_only_evidence_and_crlf_are_accepted() {
    let mut output = evidence();
    output[0]["action"]["sources"] = json!([]);
    output[1]["content"][0]["annotations"] = json!([{"type":"url_citation","url":"https://example.org/video","title":"synthetic citation"}]);
    let crlf = String::from_utf8(body(output))
        .unwrap()
        .replace('\n', "\r\n");
    assert_eq!(parse(crlf.as_bytes(), 0).unwrap().sources.len(), 1);
}
#[test]
fn synthetic_zero_videos_is_not_a_native_envelope_error() {
    let mut output = evidence();
    output[1]["content"][0]["text"] = json!("{\"videos\":[]}");
    let result = parse(&body(output), 0).unwrap();
    assert_eq!(result.text, "{\"videos\":[]}");
    assert_eq!(result.sources.len(), 1);
}
#[test]
fn synthetic_finder_json_validation_is_left_to_the_consumer() {
    let mut output = evidence();
    output[1]["content"][0]["text"] = json!("not Finder JSON");
    assert_eq!(parse(&body(output), 0).unwrap().text, "not Finder JSON");
}
