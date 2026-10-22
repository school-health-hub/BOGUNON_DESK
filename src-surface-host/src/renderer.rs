pub const HTML: &str = r#"<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BOGUNON DESK Surface</title>
</head>
<body><main><h1>BOGUNON DESK</h1><p id="revision">연결 대기</p></main></body>
</html>"#;

pub const fn contains_forbidden_authority() -> bool {
    contains(HTML.as_bytes(), b"__TAURI__")
        || contains(HTML.as_bytes(), b"fetch(")
        || contains(HTML.as_bytes(), b"localStorage")
        || contains(HTML.as_bytes(), b"indexedDB")
}

const fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() {
        return true;
    }
    let mut start = 0;
    while start + needle.len() <= haystack.len() {
        let mut index = 0;
        while index < needle.len() && haystack[start + index] == needle[index] {
            index += 1;
        }
        if index == needle.len() {
            return true;
        }
        start += 1;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renderer_contains_no_main_or_network_authority() {
        assert!(!contains_forbidden_authority());
        assert!(!HTML.contains("Finance"));
        assert!(!HTML.contains("plugin:"));
    }
}
