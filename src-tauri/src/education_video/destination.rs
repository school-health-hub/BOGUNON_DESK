use reqwest::Url;
const PRODUCTION: &str = "https://bogunon.vercel.app";
const ROUTE: &str = "/api/education-video/search";

pub(crate) fn proxy_url() -> Result<Url, String> {
    let dev = if cfg!(debug_assertions) {
        std::env::var("BOGUNON_EDUCATION_VIDEO_DEV_PROXY").ok()
    } else {
        None
    };
    parse_destination(cfg!(debug_assertions), dev.as_deref())
}

fn parse_destination(debug: bool, configured: Option<&str>) -> Result<Url, String> {
    let origin = match (debug, configured) {
        (true, Some("http://localhost:3000")) => "http://localhost:3000",
        (true, Some("http://127.0.0.1:3000")) => "http://127.0.0.1:3000",
        (true, Some(_)) => {
            return Err("Finder 개발 프록시 주소는 localhost:3000만 허용됩니다.".into())
        }
        (false, _) | (true, None) => PRODUCTION,
    };
    Url::parse(origin)
        .and_then(|url| url.join(ROUTE))
        .map_err(|_| "Finder 프록시 주소를 확인해 주세요.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn production_ignores_all_dev_overrides() {
        assert_eq!(
            parse_destination(false, Some("http://evil.test"))
                .unwrap()
                .as_str(),
            "https://bogunon.vercel.app/api/education-video/search"
        );
    }
    #[test]
    fn dev_only_allows_exact_loopback_origins() {
        for valid in ["http://localhost:3000", "http://127.0.0.1:3000"] {
            assert!(parse_destination(true, Some(valid)).is_ok());
        }
        for invalid in [
            "http://localhost:3001",
            "https://localhost:3000",
            "http://localhost:3000@evil.test",
            "http://localhost:3000/",
            "http://localhost:3000#x",
            "http://[::1]:3000",
        ] {
            assert!(parse_destination(true, Some(invalid)).is_err());
        }
    }
}
