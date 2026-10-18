# 9B-3L-E Surface Adapter P1 Hardening

## Baseline and scope

Worktree C:/Users/Public/Documents/BOGUNON-9b2a, branch codex/desktop-surface-core-9b2a, starting HEAD a3acee1b7511559977dfbc7aa5b7a5d2a8816de3, clean. This stage changes only Surface adapter contracts, pure Synthetic tests and QA design. Surface remains Disabled, no enable setter/command/startup path exists. No Tauri app/window/QA Runner/Explorer call is executed. No QA executable is built. Frontend builds and Rust test/check compilation are static/Synthetic validation, not Live evidence.

## Four P1 boundaries

### Configured versus effective UDF

isolation.rs checks existing absolute canonical directories, ancestor reparse attributes, disjoint component paths, environment override absence before/after and observed path stability. Missing directories, same/nested paths, reparse ancestor, unknown environment, WEBVIEW2_* even with empty value and snapshot changes fail closed. This stage creates no operational profile directory. Tests use only newly-created temporary synthetic fixtures.

Configured keeps canonical paths private and effective_admitted always false. Canonicalization/environment snapshots have TOCTOU and cannot exclude registry/policy overrides or certify actual WebView2 environment identity. Runtime passes the canonical Surface path to data_directory only after this permanently closed effective-admission Gate. Main data_directory is never changed.

Locked source chain: Tauri2.11.5 webview/mod.rs963 -> runtime-wry2.11.4 src/lib.rs4793 -> Wry0.55.1 webview2/mod.rs283–345. The runtime context map is keyed by requested path, not proof of effective UDF. Public PlatformWebview.environment at webview/mod.rs189 and with_webview expose low-level COM; actual Environment7 UserDataFolder requires postcreation observation and allocated-string cleanup. No unsafe COM workaround is added.

Official references: https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment7 and https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl . The first documents actual environment UDF; the latter environment/registry replacement behavior. Precreate effective isolation versus postcreate getter remains an unresolved activation design issue, not silently solved by configuration.

### Initial navigation

Builder callbacks now capture the exact CreationRequest. During Creating only about:blank is eligible; Surface asset loading is not admitted until pinned Live state. A foreign/stale request cannot authorize bootstrap or invalidate the current request. Denial before Owned pin now records against the original request rather than becoming an ignored invalidation. Popup and download always deny and close admission; no payload logging or Main hook changes.

Locked Wry installs handlers at webview2/mod.rs466 before initial Navigate531. NavigationStarting675–696 cancels disallowed navigation. Tauri manager/webview.rs580–605 invokes builder policy first; the global plugin may be skipped before manager registration. Thus initial policy does not depend solely on a postregistration global hook. Stable on_download returns false; Wry857–864 sets Cancel. Actual blank/global-hook timing, redirects, callbacks and Windows asset loading remain NOT VERIFIED. A safe denial may prevent loading; successful runtime loading is not claimed.

### Partial-create ownership

ConstructionOwnership separates NotAttempted, AttemptedUnresolved and ReturnedPinned. The attempt flag is set immediately before builder construction, after all Gates. Build error returns no trustworthy handle: ownership/cleanup remain Unknown, no label-only destructor, no recreation. Post-return cleanup still requires exact Window/WebView resource pins; it is independent of normal lifecycle admission. The request and model binding/sequence continue to reject stale completion.

Tauri WebviewWindowBuilder.build webview_window.rs438–443 calls window_builder.with_webview. window/mod.rs339–347 and409–428 do not return a partial resource on runtime failure. Public ready hooks run after successful manager attachment and cannot guarantee recovery of a preattachment Window. Stable Window+add_child split is unavailable without unstable. No feature expansion or ownership guess is made. Window-only remnants and unreturned native handles remain an activation P1.

### Tauri cleanup observations

CleanupObservation separates Window and WebView presence/identity, retained backend registration and WebView2 release. Stable get_webview_window returns a composite: Some permits checking both actual resource pins; None means each individual resource is Unobserved, not Missing. Separate get_window/get_webview APIs require unstable in the locked release. No dependency/feature expansion is used.

CloseRequested, Destroyed and missing composite remain distinct lifecycle observations; none certifies complete cleanup. Backend Arc identity pins intentionally remain a one-shot tombstone, reported retained, not released. WebView2 release is always Unknown. Replacement remains false. No Tauri CleanupConfirmed issuer, Native A+B conversion or Drop-based success exists. Separate registry absence, backend release and complete OS/WebView2 cleanup need future supported observation and Windows evidence.

## QA design

surface-windows-qa-design.md specifies a future independent artifact/source provenance, fresh synthetic QA UDF namespace, separate human approval, one-shot claim/permit, exact scope, sanitized Evidence and exit priority. It is not a new Gate/Runner/approval. No existing approval is reused. Effective-UDF bootstrap and partial ownership must be resolved or explicitly refused before execution. No operational Main/profile access, Explorer, retries, arbitrary process termination or Native QA proof reuse is authorized.

## Runtime audit hypotheses and evidence

1. Configuration might become effective-UDF proof: actual pure/temp-filesystem tests accept disjoint configuration but assert effective admission remains false. Override/unknown/race inputs are rejected. Default Adapter never attempts construction. External proof-promotion mutation failed its assertion.
2. Initial callback denial might be lost before pin or affect another generation: actual request-bound bridge tests deny pre-pin asset navigation and record Unknown; foreign request denial leaves the current Creating request intact. No Tauri construction is used.
3. Missing registry or partial creation might become cleanup success: pure construction/cleanup tests preserve AttemptedUnresolved, Unobserved and Unknown, retained backend registration and replacement=false. Actual ResourceTable ABA regression remains in the full suite. No Window/WebView2 cleanup success is inferred.

## Validation records

External logs: C:/Users/Public/Documents/BOGUNON-surface-hardening-output. Initial compile failures from assuming stable separate registry getters and a WebviewWindow.window method are preserved. The correction uses stable composite lookup and public Webview.window; individual absence remains unobserved. Tests/guards were not relaxed to hide either failure.

Final counts and review results are recorded after completion below. Windows actual UDF, junction behavior, bootstrap/callback timing, partial recovery, WebView2 release and Main noninterference remain NOT VERIFIED. The real Windows shell probe is filtered to preserve no-Explorer scope.

## Final results and preservation

- New Synthetic coverage: 16 tests (7 isolation, 3 request-bound navigation, 6 construction/cleanup); focused Surface suite **36 passed**, independent repeat **36 passed**, exit0.
- Full Rust Library: **469 passed, 0 failed, 1 real shell probe filtered**, exit0, rust-stable.log. Existing Main ACL/Guard/Channel/Broker/Producer/Native pure regressions included. No new production warning; unrelated existing unused Main event/Evidence writer warnings remain.
- Frontend full: **166 files / 997 tests passed**, exit0, generated ACL validation enabled.
- Cargo offline/locked all-target: exit0, check-stable.log. Windows host compilation only; no app or Runner execution.
- TypeScript, Main Vite and Surface Vite builds: exit0. Main output **13/13 byte-identical** to the preceding Adapter baseline, main-comparison.json. Surface renderer/graph source unchanged.
- Scoped rustfmt and diff audit pass. No unsafe/FFI, new feature/dependency/lockfile, Main command signature/ACL/Guard/Channel/config/auth change. Modules stay below250 lines.
- Protected artifacts **15/15**, legacy Runner sources **40/40** SHA-256 match. Independent context reviewer recomputed both manifests and Main bundle comparison. Existing Live Evidence/Claim/approvals unchanged.
- Five independent review lanes: goal, quality, security, context and Synthetic QA PASS for the Disabled fail-closed scope. These are agent reviews, not separate human execution approvals or Windows observations.

Changed files: surface_adapter/{mod,model,runtime,bridge,isolation,cleanup}.rs; this record; surface-windows-qa-design.md. Only these files belong to the checkpoint.

**SURFACE_HARDENING_READY**, scoped to source contracts and Synthetic verification with Disabled and Unknown preserved. This is not Windows QA activation readiness or a claim that all four P1s have been empirically resolved. Effective-UDF bootstrap, unreturned partial-resource recovery, individual registry absence/backend release and full WebView2 cleanup remain activation P1s. No current enabled-path P0 was found. Existing Native A+B proof is never reused as Tauri evidence.

Receipt compile-fail doctests: **2 passed**, exit0 (doc-tests.log). Forged/Synthetic cleanup receipts remain rejected by the type boundary. Final postvalidation preservation recheck also passed15/15 and40/40. No operational Windows verification was performed.
