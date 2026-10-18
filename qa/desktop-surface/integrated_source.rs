//! Build-time source identity; runtime Git state is never substituted.
pub const SOURCE_SHA: Option<&str> = option_env!("BOGUNON_9B3J_SOURCE_SHA");
pub fn validate(value: Option<&str>) -> Result<&str, ()> {
    let value = value.ok_or(())?;
    if value.len() != 40
        || !value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(());
    }
    Ok(value)
}
