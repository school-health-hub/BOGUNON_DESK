use crate::{
    evidence_record::Record,
    evidence_schema::{decode, Decoded},
};
use serde_json::{json, Value};

fn current() -> Value {
    serde_json::to_value(Record::default()).expect("fixed evidence")
}
fn parsed(value: &Value) -> serde_json::Result<Decoded> {
    decode(&serde_json::to_vec(value).expect("synthetic JSON"))
}

#[test]
fn current_record_round_trips_with_six_sanitized_fields() {
    // Given a default current record.
    let value = current();
    // When it crosses the typed boundary.
    let result = parsed(&value).expect("v2");
    // Then its version and explicit unobserved topology survive.
    let Decoded::V2(record) = result else {
        panic!("expected current schema")
    };
    assert_eq!(value.as_object().expect("object").len(), 6);
    assert_eq!(value["schema_version"], 2);
    assert_eq!(record.topology, Default::default());
    assert_eq!(serde_json::to_value(record).expect("round trip"), value);
}

#[test]
fn legacy_record_remains_explicitly_legacy_without_inferred_topology() {
    // Given the exact original five-field shape.
    let value = json!({"schema_version":1,"collection":null,
        "post_collection_check":"NOT_OBSERVED","own_window_check":"PASSED",
        "final_query_error":"API"});
    // When it is decoded.
    let result = parsed(&value).expect("legacy remains readable");
    // Then no current record or topology is inferred.
    let Decoded::V1(record) = result else {
        panic!("expected legacy schema")
    };
    assert_eq!(record.schema_version, 1);
    assert!(record.collection.is_none());
    assert_eq!(
        record.post_collection_check,
        crate::evidence_record::Check::NotObserved
    );
    assert_eq!(
        record.own_window_check,
        crate::evidence_record::Check::Passed
    );
    assert_eq!(
        record.final_query_error,
        Some(crate::observation_reader::evidence::Failure::Api)
    );
}

#[test]
fn missing_current_fields_are_rejected_including_nullable_fields() {
    // Given each incomplete current shape.
    for field in [
        "schema_version",
        "collection",
        "post_collection_check",
        "own_window_check",
        "final_query_error",
        "topology",
    ] {
        let mut value = current();
        value.as_object_mut().expect("object").remove(field);
        // When decoded, then the omitted required field fails.
        assert!(parsed(&value).is_err(), "{field}");
    }
    for field in [
        "host_kind",
        "following_search",
        "following_tail_count",
        "enumeration_scope",
    ] {
        let mut value = current();
        value["topology"]
            .as_object_mut()
            .expect("object")
            .remove(field);
        assert!(parsed(&value).is_err(), "{field}");
    }
}

#[test]
fn extra_fields_invalid_enums_and_version_shape_mismatches_are_rejected() {
    // Given malformed evidence at each boundary.
    let mut cases = Vec::new();
    for field in ["hwnd", "pid", "path", "title", "WS_VISIBLE"] {
        let mut value = current();
        value[field] = json!("PRIVATE");
        cases.push(value);
        let mut value = current();
        value["topology"][field] = json!("PRIVATE");
        cases.push(value);
    }
    for (field, invalid) in [
        ("host_kind", "Explorer"),
        ("following_search", "SUCCESS"),
        ("enumeration_scope", "DESKTOP"),
    ] {
        let mut value = current();
        value["topology"][field] = json!(invalid);
        cases.push(value);
    }
    for version in [0, 1, 3, 255] {
        let mut value = current();
        value["schema_version"] = json!(version);
        cases.push(value);
    }
    // When each malformed value is parsed, then it fails closed.
    for value in cases {
        assert!(parsed(&value).is_err(), "{value}");
    }
}

#[test]
fn tail_counts_require_completed_search_and_nonnegative_integer() {
    // Given all search/count combinations.
    for search in ["FOUND", "NONE", "ERROR", "NOT_OBSERVED"] {
        for count in [Value::Null, json!(0), json!(3), json!(-1), json!(1.5)] {
            let mut value = current();
            value["topology"]["following_search"] = json!(search);
            value["topology"]["following_tail_count"] = count.clone();
            let expected = count.is_null()
                || match search {
                    "FOUND" => count.as_u64().is_some_and(|tail| tail >= 1),
                    "NONE" => count.as_u64() == Some(0),
                    "ERROR" | "NOT_OBSERVED" => false,
                    _ => unreachable!("fixed synthetic states"),
                };
            // When decoded, then only meaningful count states pass.
            assert_eq!(parsed(&value).is_ok(), expected, "{value}");
        }
    }
}

#[test]
fn collection_rejects_missing_fields_unknown_fields_and_invalid_enums() {
    let mut baseline = current();
    baseline["collection"] =
        serde_json::to_value(crate::observation_reader::evidence::Evidence::default())
            .expect("fixed collection");
    assert!(parsed(&baseline).is_ok());
    for field in [
        "reason",
        "workers_enumerated",
        "eligible_workers",
        "exclusions",
        "shell_identity_passed",
        "dpi_passed",
        "main_identity_recheck_passed",
        "topology_recheck_passed",
        "error",
    ] {
        let mut value = baseline.clone();
        value["collection"]
            .as_object_mut()
            .expect("collection")
            .remove(field);
        assert!(parsed(&value).is_err(), "missing {field}");
    }
    for field in ["pid", "hwnd", "path", "title", "topology"] {
        let mut value = baseline.clone();
        value["collection"][field] = json!("PRIVATE");
        assert!(parsed(&value).is_err(), "extra {field}");
    }
    for field in ["reason", "error"] {
        let mut value = baseline.clone();
        value["collection"][field] = json!("INVALID");
        assert!(parsed(&value).is_err(), "invalid {field}");
    }
}

#[test]
fn legacy_requires_exact_shape_and_cannot_be_relabelled_current() {
    let mut legacy = current();
    legacy.as_object_mut().expect("object").remove("topology");
    legacy["schema_version"] = json!(1);
    for field in [
        "schema_version",
        "collection",
        "post_collection_check",
        "own_window_check",
        "final_query_error",
    ] {
        let mut value = legacy.clone();
        value.as_object_mut().expect("object").remove(field);
        assert!(parsed(&value).is_err(), "missing legacy {field}");
    }
    legacy["schema_version"] = json!(2);
    assert!(parsed(&legacy).is_err());
}

#[test]
fn populated_legacy_collection_retains_original_nine_field_shape() {
    let collection = json!({
        "reason":"NO_ELIGIBLE_WORKER", "workers_enumerated":14,
        "eligible_workers":0, "exclusions":{
            "class":0,"process":2,"parent":0,"hidden":14,
            "bounds":1,"def_view":0,"order":14,"host":0},
        "shell_identity_passed":true,"dpi_passed":true,
        "main_identity_recheck_passed":true,"topology_recheck_passed":true,
        "error":"NO_ELIGIBLE_WORKER"
    });
    let value = json!({"schema_version":1,"collection":collection,
        "post_collection_check":"NOT_OBSERVED","own_window_check":"PASSED",
        "final_query_error":"NO_ELIGIBLE_WORKER"});
    let Decoded::V1(record) = parsed(&value).expect("safe synthetic legacy fixture") else {
        panic!("expected legacy schema");
    };
    let encoded = serde_json::to_value(record.collection.expect("populated collection"))
        .expect("fixed collection");
    assert_eq!(encoded.as_object().expect("collection").len(), 9);
    assert_eq!(encoded, collection);
}
