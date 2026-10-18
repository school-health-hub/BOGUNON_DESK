# 9B-3L-D Tauri Surface Window Adapter

## Baseline and result scope

Worktree `C:/Users/Public/Documents/BOGUNON-9b2a`, branch `codex/desktop-surface-core-9b2a`, baseline `e0e1c6d2d214aa1b009683623b974e50d70bee68`, starting working tree clean.

This implements and compiles a **Disabled source adapter**, not an enabled runtime feature. No operational app, Tauri window, Native Runner, Explorer query, OS message pump or operational user data is executed/accessed. Existing Live Evidence, Claim and approvals are preserved. No Surface IPC or Main projection producer is connected.

## Source structure

- `surface_adapter/runtime.rs`: inert managed Adapter, creation/close/independent own-resource destruction, status, protocol configuration. No enable setter or command exists. `request_create` returns Disabled before path lookup or builder calls. Independently, `Gate.isolation=false` refuses creation until a future effective-UDF verifier is implemented. A future toggle alone cannot bypass it.
- `model.rs`: Dormant → Creating → Live → Closing, plus Destroyed/Missing/Unknown observations. Uses the existing `Registry<TauriObserved>` as a **reservation**, not actual observed cleanup evidence. Registry binding (instance/generation/operation) and monotonic sequence admission are reused. Accepted request sequence is retained for completion, delivery and callbacks. Overflow closes admission. No replacement is allowed.
- `identity.rs`: separate typed Window/WebView `ResourceId` and backend-owned `Arc<Identity>` pins. Both actual resource identities and the fixed Surface role label must match. Main pins are never reused. Resource-table number collisions do not authorize another resource.
- `bridge.rs`: backend-installed callback closure bound to the exact created Tauri Window and reservation; late/stale request bindings cannot affect another instance. This callback can record Destroyed even after resource-table retirement. Main global window policy remains unchanged. Global navigation delegates only the Surface role, and grants only with actual Surface resource pins/current Main lease. Every other view follows the existing Main policy.
- `settings.rs`: backend-resolved LocalData sibling `kr.sungandi.schoolhealthdesk.surface-v1`, fixed `bogunon-surface://localhost/surface.html`, HTTPS custom-protocol origin `https://bogunon-surface.localhost`. Rejects relative/parent paths and nonexact navigation, credentials, ports, query and fragment. No JS path/HWND/PID input is accepted.
- `surface_assets_build.rs` and `assets.rs`: optional std-only build snapshot of `dist-surface`, no added dependencies. Missing/invalid assets embed an unavailable set rather than enabling a fallback. Direct symlink/reparse entries and unexpected filenames/oversize snapshots are refused. Runtime serves only fixed Surface HTML/CSS/JS from embedded bytes; no arbitrary runtime filesystem reads and no Main assets.

`build.rs` keeps the existing 50-command AppManifest/tauri_build invocation, then captures optional Surface assets. `lib.rs` adds only module registration, inert state/protocol configuration and narrow Surface navigation delegation. Startup never calls request_create. Existing Main setup, hide/tray, auth restoration, commands, caller guards, capability sources, Channel and Native QA are unchanged.

## Public locked Tauri APIs

Verified against installed **Tauri 2.11.5**, runtime-wry 2.11.4 and Wry 0.55.1. Public WebviewWindowBuilder supports data_directory, use_https_scheme, on_navigation, on_new_window, visible/focused and disable_drag_drop_handler. Public register_uri_scheme_protocol supports ordinary HTTP response headers. Public resource tables support typed Arc identity pins. No raw HWND, COM, Native QA owner, reparenting or unsafe code is added.

References: https://docs.rs/tauri/2.11.5/tauri/webview/struct.WebviewWindowBuilder.html and https://docs.rs/tauri/2.11.5/tauri/struct.Builder.html . Locked `manager/webview.rs:580–607` applies the builder navigation callback before plugin navigation, and invokes plugins only when a manager WebView exists. `UriSchemeContext` exposes a label, not an instance handle, so protocol admission additionally resolves and verifies the current pinned resource; replacement is forbidden.

## Creation and isolation Gate

Source sequence: Disabled check → Main lifetime snapshot → backend-only settings → Broker binding/sequence and Main/configured ACL/assets/Explorer-disabled prerequisites → fixed-label collision check → Main lease recheck → hidden blank Tauri construction → exact Window callback binding → resource pins → Main/current resource recheck → Live reservation → exact Surface navigation.

The source builder explicitly supplies its separate UDF and HTTPS scheme and denies popup/new-window requests. No Main Window/WebView is passed into a Native owner or used as a Surface parent. No Main storage migration, file deletion, repository/auth access or profile mutation is performed.

The effective isolation condition is deliberately **not issued**. Requested UDF/origin settings are not proof of effective WebView2 environment/profile separation, directory alias/reparse targets or policy/environment overrides. These require a future verifier and separately authorized Windows QA before this hard gate can change. StorageContract remains inactive. A separate HTML/bundle is not a storage boundary.

The protocol handler requires the pinned Surface resource, current Main lifetime lease and active matching Surface request. The actual generated Tauri ACL is resolved with the locked public resolver and rejects any command/plugin grant matching `desktop-surface`. Existing 50 Main commands and Main Channel register/unregister are not broadened.

## Asset and CSP contract

Optional build snapshots contain Surface HTML, CSS, JS and private graph metadata only. Runtime validates the graph's closed module set, import edges and JS hash. Protocol matches exact custom/HTTPS authority, GET and allowlisted paths; rejects traversal, metadata, other origins, query, credentials and ports. It returns no broadcast/asset fallback.

CSP is delivered as a **response header**, including frame-ancestors none, default-src none, script/style self and connect/frame/worker/form/object none. No unsafe-inline or business network grant. This is stricter than the future StorageContract IPC allowance because no IPC is enabled. Main CSP/origin/UDF and the renderer files remain unchanged. Effective custom-protocol rendering/headers under Windows are NOT VERIFIED.

## Cleanup and Main protection

CloseRequested closes Surface admission; Tauri close acceptance is not destruction. Destroyed and resource missing are distinct observations but both leave cleanup **Unknown**. A separate CleanupConfirmed type is uninhabited: no verifier exists to construct a Tauri-wide cleanup receipt. Synthetic Broker receipts and Native QA A+B Proof have no conversion path. Drop emits no receipt. Confirmed is a vocabulary value only; Adapter never reports it.

Independent `destroy_owned` remains available after lifecycle failure/Main retirement but verifies its own pinned Window/WebView first and admits at most one explicit destruction attempt. It never targets an unowned label or borrowed Main resource. Native-call errors, partial create, denied navigation and Main retirement preserve Unknown; successful close/destroy dispatch cannot turn failure into success. A failure after pin/create completion attempts own-resource destruction without holding model locks across Tauri calls. If build fails before ownership can be pinned, ownership is Unknown; arbitrary label-based destruction is forbidden.

No automatic retry, recreation, app exit, logout, Main hide, business save or Native proof issuance occurs. Main registry and Surface registry lifetimes are separate. Existing nonMain close/drop guards and Main-only Channel resource checks remain authoritative.

## Synthetic and regression evidence

Logs and disposable build outputs: `C:/Users/Public/Documents/BOGUNON-surface-adapter-output`.

Failing-first tests were registered before implementation and produced compile failures for missing adapter modules/types (`red-registered`, exit101). No test was weakened. Independent review found begin accepting a sequence that completion had hardcoded to1; it now retains the accepted sequence, with a sequence2/oldsequence1 regression. Registry overflow and Model Unknown are kept consistent.

A new ResourceTable test initially assumed separate tables allocate the same ID. Runtime evidence disproved that assumption: IDs are random. A second fixture attempted replacement in an empty table; the API panics for absent IDs. The final fixture first pins an actual resource, verifies admission, then uses public ResourceTable::replace on that existing ID. The identical numeric ID remains present but its new Arc is rejected. This is a deterministic resource-ID reuse/ABA test, not an assumption that independent random allocations collide. Only the test setup changes; production identity policy is unchanged.

Pure tests cover default Disabled, each Gate prerequisite/Main absence, duplicate/foreign binding, accepted and stale sequence, close during creation/late completion rejection, close admission, destroy/missing Unknown, partial create/navigation failure, overflow, replacement rejection, dedicated configured UDF/origin/navigation, actual merged ACL denial, exact resource identity/collision/missing, protocol/CSP/assets/hash rejection. Compile-fail doctests reject a forged CleanupConfirmed and a Synthetic Broker cleanup receipt passed as Tauri cleanup evidence.

No test invokes Adapter.request_create, request_close, destroy_owned or a Tauri app/window. Tests execute pure models, ResourceTable and HTTP response construction only. The real Windows shell probe is explicitly filtered from Library tests to preserve the no-Explorer scope. BOGUNON_VERIFY_SURFACE_ASSETS=1 requires the actually built embedded renderer to validate instead of accepting the optional-missing-assets case; it is a test-only check, not a runtime opt-in or approval.

Five independent goal/security/quality/context/QA lanes reviewed only the Disabled source boundary. Read-only reviewers found no current P0/P1 activation vulnerability. Independent QA ran pure focused tests. These reviews are not human execution approval or Windows verification. Quality review rechecked the sequence correction.

## Runtime audit hypotheses

1. Gate failure might admit creation: actual default Adapter status and pure Model tests show Disabled before creation admission; each Synthetic prerequisite fails independently. The compiled runtime additionally has a literal false effective-isolation gate. No Native call is used to validate this claim.
2. Destroyed/resource absence might become cleanup success: pure observation tests always yield CleanupUnknown, no delivery and no replacement. Receipt forgery/Synthetic substitution must fail compilation.
3. Asset/protocol paths might expose Main payload: actual generated ACL denies every Surface command/plugin grant; the embedded closed graph/hash and HTTP request tests reject Main authority, paths, metadata, writes and invalid hashes. Main Channel remains bound to existing Main resources.

## Remaining P1 activation prerequisites and Windows limits

1. Implement trustworthy effective WebView2 UDF/profile/alias/override verification before changing isolation:false; retain default Disabled and require separate activation review/approval.
2. Validate blank bootstrap/navigation hook/resource insertion ordering in Windows. If global navigation sees pre-pin Surface it safely denies; successful creation/loading is not established by compilation.
3. Validate actual callback ordering, resource loss and partial-build ownership/cleanup. A gap before per-window callback registration and partial creation with no returned handle cannot be presumed cleaned; explicit resource re-observation remains necessary.
4. Tauri Destroyed/resource absence does not prove OS/WebView2/context/profile release. There is no cleanup verifier or replacement permission. Full cleanup and any future replacement require a separately reviewed receipt/verifier.
5. Navigation/lease checks versus asynchronous dispatch have TOCTOU. Already-dispatched callbacks and future OS events cannot be cancelled by this model. Thread shutdown/join, queue quiet and Native A+B/C semantics are not claimed.

The current two hard gates make these activation prerequisites safe refusals. They must not be removed on the basis of Synthetic PASS. This checkpoint is source-contract-ready only, not activation-ready or Live-approved.

## Final results

- Rust Library final: **453 passed, 0 failed, 1 real shell probe filtered**, exit0 (`rust-verified.log`). Includes all20 Surface tests, existing Main/Broker/Producer/Native Synthetic regressions; built-asset verification flag enabled.
- Independent final Adapter QA: **20 passed, 0 failed, 434 other tests filtered**, exit0 (`independent-verified.log`). Historical fixture failures are retained as red evidence only.
- Compile-fail receipt doctests: **2 passed**, exit0 (`doc-tests.log`).
- Frontend full: **166 files / 997 tests passed**, exit0; generated Main ACL checks enabled (`frontend.log`).
- Cargo offline/locked all-target check: exit0 (`check-verified.log`), no new warning. Existing unrelated unused Event variants/Evidence writer warnings remain unchanged.
- TypeScript: exit0. Main Vite build and separate Surface build: exit0. Main output compared against the preceding renderer checkpoint: **13/13 files byte-identical** (`main-comparison.json`).
- Scoped rustfmt and diff audit: exit0. No added unsafe/FFI, dependency or lockfile change. Added Rust modules are each under250 lines; assets is in the200–250 warning band and should be split before any future growth crosses the ceiling.
- Protected artifacts **15/15** and legacy Runner/Gate/Evidence source manifest **40/40** SHA-256 match. Manifests: `C:/Users/Public/Documents/BOGUNON-9b3jc-output/protected-before.sha256` and `C:/Users/Public/Documents/BOGUNON-9b3jd-2200063/existing-runner-before.sha256`.
- Existing50 command signatures, Main ACL/Guard/Channel/auth/lifetime, Main HTML/App/renderer, Main storage configuration, Native QA Owner/Host/Driver and approvals/Evidence/Claim unchanged. The three integration files change only inert configuration, source asset capture and shared Broker admission reuse.

Changed files: `src-tauri/src/surface_adapter/{mod,model,runtime,bridge,identity,settings,assets,tests}.rs`; `src-tauri/surface_assets_build.rs`; minimal `src-tauri/{build.rs,src/lib.rs,src/surface_broker/registry.rs}`; this verification record. Build outputs/logs are external or ignored and are not committed.

**TAURI_ADAPTER_READY**, limited to the Disabled source contract and Synthetic verification. Discovery, implementation, regressions, independent review and scoped diff audit completed. Local checkpoint only; no push or PR. There is no execution authorization, enabled Surface, observed UDF isolation or confirmed Tauri cleanup.
