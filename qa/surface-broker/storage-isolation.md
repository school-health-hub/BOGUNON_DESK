# 9B-3L-B Storage isolation contract

Baseline: e95ae658146a8376997e64dd4573f860b6a34bb8, codex/desktop-surface-core-9b2a, clean. This is source/configuration evidence. No browser profile, operational AppData, application process, WebView or Windows desktop was inspected or created.

## Existing Main

Actual tauri.conf.json configures one default Main App window, no explicit dataDirectory/incognito/useHttpsScheme. Development origin is http://localhost:1420; Windows packaged App origin defaults to http://tauri.localhost. These are configured/source-derived origins, not runtime measurements.

Locked source versions: tauri 2.11.5; tauri-runtime-wry 2.11.4; wry 0.55.1; tauri-utils 2.9.3. Main's requested default UDF is LocalData/kr.sungandi.schoolhealthdesk. Tauri manager/webview.rs:534-550 injects this default and creates missing directories when building a Webview. No such build is performed here. runtime-wry src/lib.rs:4793-4816 keys contexts by data_directory, not labels or HTML entrypoints. Wry webview2/mod.rs:287-291,343-346 forwards the context directory to CreateCoreWebView2EnvironmentWithOptions. Wry's controller code sets InPrivate but never ProfileName: no named-profile isolation API is claimed from the Tauri builder.

With the same origin and default UDF/profile, future windows could share localStorage, IndexedDB, cookies and caches. sessionStorage has origin/top-level browsing-context lifetime and potential opener inheritance; distinct HTML/React roots do not establish isolation. UDF separation is required in addition to origin separation, including protection against cookie-domain/profile-wide state sharing. This is browser data separation, not a sandbox against a compromised native backend or OS user.

## Future Surface requirements, currently inactive

surface_storage::StorageContract is immutable requirements data, not a builder, adapter, verification receipt or execution permit. creation_enabled and development_surface_enabled are false. No Surface scheme handler, window, renderer, directory, profile or migration exists.

- Use explicit absolute WebviewWindowBuilder::data_directory pointing to LocalData/kr.sungandi.schoolhealthdesk.surface-v1, a sibling namespace outside Main's UDF. Resolve from a trusted backend root, not JS paths. No default-directory fallback. Require effective paths to be distinct and non-overlapping, including case, aliases and reparse targets; string inequality is not filesystem proof.
- Stable custom scheme bogunon-surface, Windows origin https://bogunon-surface.localhost via public WebviewUrl::CustomProtocol and use_https_scheme(true). Main's HTTP scheme, origin and UDF remain unchanged. No Surface dev origin is permitted yet; never reuse Main's dev origin as a fallback.
- Do not rely on incognito. Locked Tauri webview/mod.rs:988-998 documents runtime-version limits, and Wry webview2/mod.rs:389-410 falls back to an ordinary controller on older environment interfaces. Separate UDFs are the intended boundary; no no-files-written claim is made.
- Requested UDF is not effective UDF. WebView2 environment variables or policy registry values may override userDataFolder. Future admission requires checking the effective environment/profile before loading Surface content or exposing IPC; unknown/alias/override mismatch blocks admission. Merely setting a path or checking environment variables is insufficient. An empty/quarantined bootstrap and cleanup on failed verification need a separately reviewed adapter; none is implemented now.
- No opener relationship, shared Main WebView context, Main React Providers, auth client, or business repositories. Do not read, copy, move, clear or delete Main storage. A future Surface namespace/version migration requires explicit review.

## Assets, CSP and navigation

The current filesystem asset protocol is not enabled in the application configuration; bundled App assets are a separate mechanism. A scheme registration or asset protocol is not a storage boundary. Current Main CSP permits its existing application/IPC and Supabase connections and is unchanged.

A future custom protocol handler must serve an explicit Surface-only packaged asset allowlist, correct MIME types and strict CSP response headers. Preserve Tauri's public nonce/hash processing where applicable; custom protocol responses must not be assumed to inherit App CSP injection automatically. Do not grant filesystem asset scope, arbitrary Main-bundle traversal, remote scripts, business network endpoints, frames, workers or Main navigation. The draft CSP allows only self resources plus explicit IPC endpoints, no Supabase or unsafe-inline. Its HTTPS/mixed-content/IPC behavior is NOT VERIFIED and must be tested before enablement.

Current Main lifetime navigation guard rejects non-Main resources; it is not loosened here. Surface needs a separate future role-specific navigation policy for the fixed Surface origin and allowlisted routes. Unknown origin, redirect, popup/new-window, reload or unexpected navigation closes admission, without changing Main's policy. Same-origin policy/CSP alone cannot replace resource-based IPC authorization or effective UDF verification.

## Public API and authoritative references

- Locked Tauri builder: webview/webview_window.rs:1024 data_directory, 1052 incognito, 1152 use_https_scheme; webview/mod.rs:392-424 shows config-relative directory resolution, different from direct PathBuf builder input.
- Locked Tauri app.rs:2130 register_uri_scheme_protocol; tauri-utils config.rs WebviewUrl::CustomProtocol; Wry custom_protocol_workaround.rs maps Windows custom schemes to HTTP(S) .localhost origins.
- [Tauri 2.11.5 public builder](https://docs.rs/tauri/2.11.5/tauri/webview/struct.WebviewWindowBuilder.html).
- [Microsoft WebView2 user data folders](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder): profile data and sharing of sessions by UDF.
- [Microsoft multiple profiles](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/multi-profile-support): profiles under one UDF; not assumed available as a named-profile builder control here.
- [Microsoft environment overrides](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.3595.46): requested environment parameters can be overridden.

Static tests check unchanged Main config, distinct planned namespace/origin, strict draft CSP and disabled creation. They do not prove actual filesystem separation, storage/cookie isolation, profile identity, effective policy overrides or Windows/WebView2 noninterference. Those remain prerequisites for a future Surface adapter and separately authorized Windows QA.
