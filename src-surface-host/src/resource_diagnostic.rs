#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurfaceAssetKind {
    Html,
    JavaScript,
    Css,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpStatusClass {
    Success,
    Failure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MimeClass {
    Expected,
    Mismatch,
    Missing,
}

const SURFACE_ORIGIN: &str = "https://bogunon-surface.localhost";

pub fn classify_surface_asset(uri: &str) -> Option<SurfaceAssetKind> {
    let path = uri.strip_prefix(SURFACE_ORIGIN)?.split('?').next()?;
    if path == "/surface.html" {
        return Some(SurfaceAssetKind::Html);
    }
    let asset_path = path.strip_prefix("/assets/")?;
    if asset_path.ends_with(".js") {
        Some(SurfaceAssetKind::JavaScript)
    } else if asset_path.ends_with(".css") {
        Some(SurfaceAssetKind::Css)
    } else {
        None
    }
}

pub const fn classify_http_status(status: i32) -> HttpStatusClass {
    if status >= 200 && status <= 299 {
        HttpStatusClass::Success
    } else {
        HttpStatusClass::Failure
    }
}

pub fn classify_mime(asset: SurfaceAssetKind, value: Option<&str>) -> MimeClass {
    let Some(value) = value else {
        return MimeClass::Missing;
    };
    let normalized = value.split(';').next().map(str::trim).unwrap_or_default();
    let expected = match asset {
        SurfaceAssetKind::Html => normalized.eq_ignore_ascii_case("text/html"),
        SurfaceAssetKind::JavaScript => {
            normalized.eq_ignore_ascii_case("text/javascript")
                || normalized.eq_ignore_ascii_case("application/javascript")
        }
        SurfaceAssetKind::Css => normalized.eq_ignore_ascii_case("text/css"),
    };
    if expected {
        MimeClass::Expected
    } else {
        MimeClass::Mismatch
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_only_fixed_surface_assets_without_query_disclosure() {
        assert_eq!(
            classify_surface_asset("https://bogunon-surface.localhost/surface.html?generation=7"),
            Some(SurfaceAssetKind::Html)
        );
        assert_eq!(
            classify_surface_asset("https://bogunon-surface.localhost/assets/surface-a1.js"),
            Some(SurfaceAssetKind::JavaScript)
        );
        assert_eq!(
            classify_surface_asset("https://bogunon-surface.localhost/assets/surface-b2.css"),
            Some(SurfaceAssetKind::Css)
        );
        assert_eq!(
            classify_surface_asset("https://example.invalid/assets/surface-a1.js"),
            None
        );
        assert_eq!(
            classify_surface_asset("https://bogunon-surface.localhost/private.json"),
            None
        );
    }

    #[test]
    fn classifies_http_status_and_normalized_mime() {
        assert_eq!(classify_http_status(200), HttpStatusClass::Success);
        assert_eq!(classify_http_status(299), HttpStatusClass::Success);
        assert_eq!(classify_http_status(304), HttpStatusClass::Failure);
        assert_eq!(classify_http_status(404), HttpStatusClass::Failure);
        assert_eq!(
            classify_mime(
                SurfaceAssetKind::JavaScript,
                Some("text/javascript; charset=utf-8")
            ),
            MimeClass::Expected
        );
        assert_eq!(
            classify_mime(SurfaceAssetKind::JavaScript, Some("application/javascript")),
            MimeClass::Expected
        );
        assert_eq!(
            classify_mime(SurfaceAssetKind::Css, Some("text/css")),
            MimeClass::Expected
        );
        assert_eq!(
            classify_mime(SurfaceAssetKind::Html, Some("text/html; charset=UTF-8")),
            MimeClass::Expected
        );
        assert_eq!(
            classify_mime(SurfaceAssetKind::JavaScript, Some("text/plain")),
            MimeClass::Mismatch
        );
        assert_eq!(
            classify_mime(SurfaceAssetKind::Css, None),
            MimeClass::Missing
        );
    }
}
