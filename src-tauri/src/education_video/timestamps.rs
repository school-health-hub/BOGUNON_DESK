//! Canonical UTC millisecond timestamps, without process locale or external services.
use super::model::LibraryError;
use std::time::{SystemTime, UNIX_EPOCH};
pub const MAX_TTL_MS: i64 = 30 * 24 * 60 * 60 * 1000;
pub fn now_ms() -> Result<i64, LibraryError> {
    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| LibraryError::Invalid)?;
    i64::try_from(elapsed.as_millis()).map_err(|_| LibraryError::Invalid)
}
fn days(year: i64, month: i64, day: i64) -> i64 {
    let year = year - i64::from(month <= 2);
    let era = year.div_euclid(400);
    let yoe = year - era * 400;
    let adjusted = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * adjusted + 2) / 5 + day - 1;
    era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719468
}
pub fn format_iso(ms: i64) -> String {
    let whole = ms.div_euclid(86400000);
    let time = ms.rem_euclid(86400000);
    let z = whole + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = year + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        time / 3600000,
        (time / 60000) % 60,
        (time / 1000) % 60,
        time % 1000
    )
}
pub fn parse_iso(value: &str) -> Result<i64, LibraryError> {
    let b = value.as_bytes();
    if b.len() != 24
        || [4, 7].iter().any(|&i| b[i] != b'-')
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
        || b[19] != b'.'
        || b[23] != b'Z'
    {
        return Err(LibraryError::Invalid);
    }
    if b.iter()
        .enumerate()
        .any(|(i, c)| ![4, 7, 10, 13, 16, 19, 23].contains(&i) && !c.is_ascii_digit())
    {
        return Err(LibraryError::Invalid);
    }
    let part = |a: usize, z: usize| {
        value[a..z]
            .parse::<i64>()
            .map_err(|_| LibraryError::Invalid)
    };
    let (year, month, day, hour, minute, second, millis) = (
        part(0, 4)?,
        part(5, 7)?,
        part(8, 10)?,
        part(11, 13)?,
        part(14, 16)?,
        part(17, 19)?,
        part(20, 23)?,
    );
    if !(1970..=9999).contains(&year)
        || !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return Err(LibraryError::Invalid);
    }
    let result = days(year, month, day) * 86400000
        + hour * 3600000
        + minute * 60000
        + second * 1000
        + millis;
    if format_iso(result) != value {
        return Err(LibraryError::Invalid);
    }
    Ok(result)
}
