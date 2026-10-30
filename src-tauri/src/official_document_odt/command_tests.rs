use super::command::{
    default_odt_filename, selected_or_cancelled, OfficialDocumentOdtRequest,
    OfficialDocumentOdtResult,
};

#[test]
fn default_filename_replaces_windows_forbidden_characters() {
    let title = "합성:보건/교육*계획?<>|\"";

    let filename = default_odt_filename(title).expect("valid title");

    assert_eq!(filename, "합성_보건_교육_계획_____.odt");
}

#[test]
fn default_filename_rejects_empty_or_reserved_titles() {
    for title in ["   ... ", "CON", "nul.txt", "LPT1"] {
        assert!(default_odt_filename(title).is_err(), "{title}");
    }
}

#[test]
fn default_filename_trims_trailing_dots_and_spaces_and_bounds_length() {
    let title = format!("{}...   ", "합성".repeat(100));

    let filename = default_odt_filename(&title).expect("bounded filename");

    assert!(filename.ends_with(".odt"));
    assert!(filename.encode_utf16().count() <= 120);
    assert!(!filename.trim_end_matches(".odt").ends_with(['.', ' ']));
}

#[test]
fn request_rejects_empty_content_and_table_copy_text() {
    let empty = OfficialDocumentOdtRequest {
        title: " ".to_owned(),
        body: "본문 끝.".to_owned(),
        attachments: String::new(),
        has_table_text: false,
    };
    let table = OfficialDocumentOdtRequest {
        title: "합성 제목".to_owned(),
        body: "본문 끝.".to_owned(),
        attachments: String::new(),
        has_table_text: true,
    };

    assert!(empty.validate().is_err());
    assert!(table.validate().is_err());
}

#[test]
fn dialog_cancellation_and_saved_result_have_strict_renderer_shape() {
    let cancelled = serde_json::to_value(OfficialDocumentOdtResult::Cancelled)
        .expect("cancelled result serializes");
    let saved = serde_json::to_value(OfficialDocumentOdtResult::Saved {
        file_name: "합성.odt".to_owned(),
    })
    .expect("saved result serializes");

    assert_eq!(cancelled, serde_json::json!({ "status": "cancelled" }));
    assert_eq!(
        saved,
        serde_json::json!({ "status": "saved", "fileName": "합성.odt" })
    );
}

#[test]
fn template_dialog_cancel_returns_neutral_cancelled_result() {
    let result = selected_or_cancelled::<&str>(None);

    assert_eq!(result, Err(OfficialDocumentOdtResult::Cancelled));
}

#[test]
fn destination_dialog_cancel_returns_neutral_cancelled_result() {
    let result = selected_or_cancelled::<&str>(None);

    assert_eq!(result, Err(OfficialDocumentOdtResult::Cancelled));
}
