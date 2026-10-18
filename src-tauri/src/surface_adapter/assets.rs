use serde::Deserialize;
use sha2::{Digest, Sha256};
use tauri::http::{Method, Request, Response, StatusCode};

include!(concat!(env!("OUT_DIR"), "/surface_assets.rs"));

const CSP: &str = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";
const MODULES: &[&str] = &[
    "surface.html",
    "src/surface/main.tsx",
    "src/surface/SurfaceRoot.tsx",
    "src/surface/surface.css",
    "npm:react/index.js",
    "npm:react/jsx-runtime.js",
    "npm:react/cjs/react.production.js",
    "npm:react/cjs/react-jsx-runtime.production.js",
    "npm:react-dom/client.js",
    "npm:react-dom/index.js",
    "npm:react-dom/cjs/react-dom-client.production.js",
    "npm:react-dom/cjs/react-dom.production.js",
    "npm:scheduler/index.js",
    "npm:scheduler/cjs/scheduler.production.js",
    "virtual:rolldown/runtime.js",
];
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Graph {
    schema_version: u8,
    scope: String,
    modules: Vec<Module>,
    chunks: Vec<Chunk>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Module {
    id: String,
    imports: Vec<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Chunk {
    file: String,
    modules: Vec<String>,
    imports: Vec<String>,
    dynamic_imports: Vec<String>,
    sha256: String,
}

pub(super) fn available() -> bool {
    valid(EMBEDDED)
}

fn valid(assets: &[(&str, &[u8])]) -> bool {
    let lookup = |name: &str| {
        assets
            .iter()
            .find(|(key, _)| *key == name)
            .map(|(_, data)| *data)
    };
    let Some(raw) = lookup(".vite/surface-isolation.json") else {
        return false;
    };
    let Ok(graph) = serde_json::from_slice::<Graph>(raw) else {
        return false;
    };
    if graph.schema_version != 1
        || graph.scope != "static-surface-renderer-only"
        || graph.modules.len() != 14
        || graph.chunks.is_empty()
        || graph.chunks.len() > 8
        || lookup("surface.html").is_none()
    {
        return false;
    }
    let module_names: std::collections::BTreeSet<_> =
        graph.modules.iter().map(|m| m.id.as_str()).collect();
    if module_names.len() != graph.modules.len()
        || graph.modules.iter().any(|m| {
            !MODULES[..14].contains(&m.id.as_str())
                || m.imports.iter().any(|i| !module_names.contains(i.as_str()))
        })
    {
        return false;
    }
    for chunk in &graph.chunks {
        let Some(bytes) = lookup(&chunk.file) else {
            return false;
        };
        if !asset_name(&chunk.file)
            || !chunk.file.ends_with(".js")
            || !chunk.imports.is_empty()
            || !chunk.dynamic_imports.is_empty()
            || chunk.modules.iter().any(|m| !MODULES.contains(&m.as_str()))
            || format!("{:x}", Sha256::digest(bytes)) != chunk.sha256
        {
            return false;
        }
    }
    assets.iter().all(|(name, _)| {
        *name == "surface.html"
            || *name == ".vite/surface-isolation.json"
            || (asset_name(name)
                && (name.ends_with(".css") || graph.chunks.iter().any(|c| c.file == *name)))
    })
}
fn asset_name(name: &str) -> bool {
    name.strip_prefix("assets/surface-").is_some_and(|tail| {
        !tail.is_empty()
            && tail
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
            && !tail.contains("..")
            && (tail.ends_with(".js") || tail.ends_with(".css"))
    })
}

pub(super) fn response(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let uri = request.uri();
    let origin = matches!(
        (
            uri.scheme_str(),
            uri.authority().map(|value| value.as_str())
        ),
        (Some("bogunon-surface"), Some("localhost"))
            | (Some("https"), Some("bogunon-surface.localhost"))
    );
    let name = uri.path().strip_prefix('/').unwrap_or_default();
    let served = request.method() == Method::GET
        && origin
        && uri.port().is_none()
        && uri.query().is_none()
        && available()
        && (name == "surface.html" || asset_name(name));
    let bytes = served
        .then(|| EMBEDDED.iter().find(|(key, _)| *key == name))
        .flatten();
    let (status, body, mime) = match bytes {
        Some((_, data)) => (
            StatusCode::OK,
            data.to_vec(),
            if name.ends_with(".html") {
                "text/html; charset=utf-8"
            } else if name.ends_with(".js") {
                "text/javascript; charset=utf-8"
            } else {
                "text/css; charset=utf-8"
            },
        ),
        None => (
            StatusCode::NOT_FOUND,
            Vec::new(),
            "text/plain; charset=utf-8",
        ),
    };
    let mut response = Response::new(body);
    *response.status_mut() = status;
    for (key, value) in [
        ("content-type", mime),
        ("content-security-policy", CSP),
        ("x-content-type-options", "nosniff"),
        ("cache-control", "no-store"),
        ("referrer-policy", "no-referrer"),
    ] {
        response.headers_mut().insert(
            tauri::http::header::HeaderName::from_static(key),
            tauri::http::HeaderValue::from_static(value),
        );
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn absence_or_malformed_graph_is_unavailable() {
        assert!(!valid(&[]));
        assert!(!valid(&[
            (".vite/surface-isolation.json", b"{}"),
            ("surface.html", b"main")
        ]));
    }
    #[test]
    fn protocol_rejects_other_origin_metadata_and_paths() {
        for uri in [
            "https://tauri.localhost/surface.html",
            "bogunon-surface://localhost/.vite/surface-isolation.json",
            "bogunon-surface://localhost/../index.html",
            "bogunon-surface://localhost/surface.html?token=x",
            "bogunon-surface://localhost:80/surface.html",
            "bogunon-surface://user@localhost/surface.html",
            "bogunon-surface://localhost/assets/surface-%2e.js",
        ] {
            let request = Request::builder().uri(uri).body(Vec::new()).unwrap();
            let response = response(&request);
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
            assert!(response.body().is_empty());
        }
    }
    #[test]
    fn protocol_rejects_writes_and_csp_forbids_network_and_frames() {
        let request = Request::builder()
            .method("POST")
            .uri("bogunon-surface://localhost/surface.html")
            .body(Vec::new())
            .unwrap();
        let response = response(&request);
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(response.headers()["content-security-policy"]
            .to_str()
            .unwrap()
            .contains("connect-src 'none'"));
        assert!(CSP.contains("frame-ancestors 'none'"));
    }
    #[test]
    fn graph_hash_and_closed_module_allowlist_bind_javascript() {
        if available() {
            let mut changed = EMBEDDED.to_vec();
            let js = changed
                .iter_mut()
                .find(|(name, _)| name.ends_with(".js"))
                .unwrap();
            js.1 = b"unapproved";
            assert!(!valid(&changed));
            let request = Request::builder()
                .uri("bogunon-surface://localhost/surface.html")
                .body(Vec::new())
                .unwrap();
            assert_eq!(response(&request).status(), StatusCode::OK);
        }
        assert!(!asset_name("assets/surface-../../index.js"));
    }
}

#[cfg(test)]
#[test]
fn built_renderer_is_available_when_verification_is_requested() {
    if std::env::var_os("BOGUNON_VERIFY_SURFACE_ASSETS").is_some() {
        assert!(
            available(),
            "built Surface assets must validate for this verification run"
        );
    }
}
