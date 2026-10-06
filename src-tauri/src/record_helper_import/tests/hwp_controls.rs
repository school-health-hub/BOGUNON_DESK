use std::fs;

use super::super::*;
use super::fixtures::{hwp_record_from_payload, hwp_text_record_from_units, write_hwp_sections};

#[test]
fn parses_tab_as_eight_wchar_control_and_emits_tab() {
    let mut units = "alpha".encode_utf16().collect::<Vec<_>>();
    units.extend([
        0x0009, 0x1111, 0x2222, 0x3333, 0x4444, 0x5555, 0x6666, 0x7777,
    ]);
    units.extend("omega".encode_utf16());
    let hwp = write_hwp_sections(
        "tab-control",
        &[hwp_text_record_from_units(&units)],
        0,
        0x0500_0000,
    );

    let text = hwp::extract_hwp_text(&hwp).unwrap();

    assert_eq!(text, "alpha\tomega");
    fs::remove_file(hwp).unwrap();
}

#[test]
fn parses_single_wchar_breaks_and_char_controls_without_losing_following_text() {
    let mut units = "alpha".encode_utf16().collect::<Vec<_>>();
    units.push(0x000a);
    units.extend("beta".encode_utf16());
    units.push(0x000d);
    units.extend("gamma".encode_utf16());
    units.push(0x0018);
    units.extend("delta".encode_utf16());
    units.push(0x001f);
    units.extend("omega".encode_utf16());
    let hwp = write_hwp_sections(
        "single-wchar-controls",
        &[hwp_text_record_from_units(&units)],
        0,
        0x0500_0000,
    );

    let text = hwp::extract_hwp_text(&hwp).unwrap();

    assert_eq!(text, "alpha\nbeta\ngamma-delta omega");
    fs::remove_file(hwp).unwrap();
}

#[test]
fn skips_eight_wchar_inline_controls_at_range_boundaries() {
    let mut units = "alpha".encode_utf16().collect::<Vec<_>>();
    units.extend([0x0001, 1, 2, 3, 4, 5, 6, 7]);
    units.extend("beta".encode_utf16());
    units.extend([0x0017, 1, 2, 3, 4, 5, 6, 7]);
    units.extend("omega".encode_utf16());
    let hwp = write_hwp_sections(
        "inline-controls",
        &[hwp_text_record_from_units(&units)],
        0,
        0x0500_0000,
    );

    let text = hwp::extract_hwp_text(&hwp).unwrap();

    assert_eq!(text, "alphabetaomega");
    fs::remove_file(hwp).unwrap();
}

#[test]
fn rejects_truncated_odd_and_invalid_hwp_para_text_payloads() {
    let truncated = write_hwp_sections(
        "truncated-control",
        &[hwp_text_record_from_units(&[0x0001, 1, 2, 3])],
        0,
        0x0500_0000,
    );
    let odd = write_hwp_sections(
        "odd-payload",
        &[hwp_record_from_payload(67, b"a")],
        0,
        0x0500_0000,
    );
    let invalid_utf16 = write_hwp_sections(
        "invalid-utf16",
        &[hwp_text_record_from_units(&[0xd800])],
        0,
        0x0500_0000,
    );

    assert_eq!(
        hwp::extract_hwp_text(&truncated),
        Err(ImportError::Unreadable)
    );
    assert_eq!(hwp::extract_hwp_text(&odd), Err(ImportError::Unreadable));
    assert_eq!(
        hwp::extract_hwp_text(&invalid_utf16),
        Err(ImportError::Unreadable)
    );

    for path in [truncated, odd, invalid_utf16] {
        fs::remove_file(path).unwrap();
    }
}
