use super::util::{push_limited, ImportError};

const CONTROL_TAB: u16 = 9;
const CONTROL_LINE_BREAK: u16 = 10;
const CONTROL_PARAGRAPH_BREAK: u16 = 13;
const CONTROL_HYPHEN: u16 = 24;
const CONTROL_FIXED_WIDTH_SPACE: u16 = 30;
const CONTROL_NON_BREAKING_SPACE: u16 = 31;
const INLINE_CONTROL_UNITS: usize = 8;

const fn control_span_units(control: u16) -> Option<usize> {
    match control {
        0 | CONTROL_LINE_BREAK | CONTROL_PARAGRAPH_BREAK | 24..=31 => Some(1),
        1..=CONTROL_TAB | 11..=12 | 14..=23 => Some(INLINE_CONTROL_UNITS),
        _ => None,
    }
}

fn push_utf16_text(output: &mut String, text_units: &mut Vec<u16>) -> Result<(), ImportError> {
    if text_units.is_empty() {
        return Ok(());
    }
    let text = String::from_utf16(text_units).map_err(|_| ImportError::Unreadable)?;
    push_limited(output, &text)?;
    text_units.clear();
    Ok(())
}

pub(super) fn parse_para_text_payload(
    payload: &[u8],
    output: &mut String,
) -> Result<(), ImportError> {
    if payload.len() % 2 != 0 {
        return Err(ImportError::Unreadable);
    }
    let units = payload
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    let mut text_units = Vec::new();
    let mut index = 0_usize;
    while index < units.len() {
        let unit = units[index];
        let Some(span_units) = control_span_units(unit) else {
            text_units.push(unit);
            index += 1;
            continue;
        };
        push_utf16_text(output, &mut text_units)?;
        match unit {
            CONTROL_TAB => push_limited(output, "\t")?,
            CONTROL_LINE_BREAK | CONTROL_PARAGRAPH_BREAK => push_limited(output, "\n")?,
            CONTROL_HYPHEN => push_limited(output, "-")?,
            CONTROL_FIXED_WIDTH_SPACE | CONTROL_NON_BREAKING_SPACE => push_limited(output, " ")?,
            _ => {}
        }
        index = index
            .checked_add(span_units)
            .filter(|next| *next <= units.len())
            .ok_or(ImportError::Unreadable)?;
    }
    push_utf16_text(output, &mut text_units)
}
