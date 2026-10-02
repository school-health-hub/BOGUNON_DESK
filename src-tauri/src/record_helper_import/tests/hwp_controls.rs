use std::fs;

use super::super::*;
use super::fixtures::{hwp_record_from_payload, hwp_text_record_from_units, write_hwp_sections};

#[test]
fn decodes_hwp_para_text_controls_and_skips_eight_wchar_spans() {
    let mut units = "alpha".encode_utf16().collect::<Vec<_>>();
    units.push(0x0009);
    units.extend("beta".encode_utf16());
    units.push(0x000a);
    units.extend("gamma".encode_utf16());
    units.extend([0x0001, 11, 12, 13, 14, 15, 16, 17]);
    units.extend("delta".encode_utf16());
    units.push(0x000d);
    units.extend("omega".encode_utf16());
    let hwp = write_hwp_sections(
        "controls",
        &[hwp_text_record_from_units(&units)],
        0,
        0x0500_0000,
    );

    let text = hwp::extract_hwp_text(&hwp).unwrap();

    assert_eq!(text, "alpha\tbeta\ngammadelta\nomega");
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
        &[hwp_record_from_payload(67, &[b'a'])],
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
