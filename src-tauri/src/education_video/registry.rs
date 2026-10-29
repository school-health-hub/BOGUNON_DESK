//! Manually reviewed IDs; names and subscriber counts never establish official status.
pub fn evidence(channel_id: &str) -> Option<&'static str> {
    match channel_id {
        "UCexUyFaq9YH7XJfCQzVR_jg" => Some("https://moe.go.kr/main.do"),
        "UCa7-3Zvxg-5Rfxgu3RQY_gw" => Some("https://www.kdca.go.kr/sites/kdca/index.do"),
        _ => None,
    }
}
pub fn valid_claim(channel_id: &str, official: bool, proof: Option<&str>, synthetic: bool) -> bool {
    match (official, proof, synthetic) {
        (false, None, _) => true,
        (true, Some(proof), false) => evidence(channel_id) == Some(proof),
        _ => false,
    }
}
