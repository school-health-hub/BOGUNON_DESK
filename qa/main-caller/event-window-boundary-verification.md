# 9B-3K-D Event and Window boundary

Baseline: `0f8f2f7ddad29c6039adfec9bfbeae668189445a`, branch `codex/desktop-surface-core-9b2a`, initially clean. No Surface window, app, WebView, tray, Native Runner, Explorer or operational-data execution is part of this change.

## Transport decision and actual framework evidence

Locked Tauri 2.11.5 does NOT offer a confidentiality boundary merely by replacing emit with emit_to(WebviewWindow(main)). `src/manager/mod.rs:592-636` filters listener target kinds; `src/event/listener.rs:274-310` still iterates all webviews and accepts EventTarget::Any listeners. Existing JS consumers use global listen. Thus a future Surface global listener could receive such an event. No manager emitter API is used for these six events.

The new Main-local adapter uses public `WebviewWindow::eval` (`src/webview/webview_window.rs:2403` -> its own Webview dispatcher), only on an identity-validated physical Main handle. The evaluated function invokes existing listeners inside that Main context using the version-specific event function/map from `src/event/listener.rs:76-85` and `src/event/mod.rs:168-235`. Listener IDs are non-enumerable; Object.getOwnPropertyNames, not Object.keys, is required. IDs remain numbers, payload/event shape unchanged. A local listener targeted to another window is excluded. No script is evaluated in another webview and no fallback emitter exists.

This is a small Main transport compatibility adapter, not a Surface renderer/broker. It intentionally depends on a private framework ABI. Installation checks that the embedded Cargo.lock selects Tauri 2.11.5; lockfile upgrades require re-review. Missing local internals/listeners suppress delivery without broadcasting. Rust eval success means scheduling accepted, NOT listener acknowledgement. Private ABI mismatch in the runtime may silently suppress events; actual Windows delivery is NOT VERIFIED.

## Six event paths

| Event | Previous | Current |
|---|---|---|
| desktop:navigate | app.emit after show | validated Main show and Main-local delivery |
| desktop:notice | tray app.emit | Main-local delivery |
| desktop:file-drop | any-window drop, window.emit broadcast | admitted Main drop only, Main-local delivery |
| purchase:analysis-start | picker app.emit / drop window.emit | both capture Main lifetime lease and deliver locally before work |
| purchase:analysis | both broadcast paths | shared completion helper checks original lease + current analysis generation, then validated local delivery |
| purchase:analysis-error | both broadcast paths | same completion gate; original error payload remains Main-confined |

Payloads remain the original Main data. Purchase rows, paths and error text are NOT converted into Surface projections. Main absence, replacement, revoked registration or identity mismatch never triggers broadcast.

## Identity and native Window policy

The original MainCallerGuard is unchanged. The event module first uses that guard, then pins an additional private Arc pair in the actual setup Main Webview and Window resource tables. Event leases capture this exact pair. Destination and caller window tokens are compared by Arc identity, never Window PartialEq/label alone. A reused label or numeric resource ID does not inherit authority.

Window callbacks reject non-Main before DesktopState, PurchaseHelperState, paths, hide/prevent-close or analysis effects. Main close-to-tray honors the existing enabled/quitting flags; other close policies are untouched. Main drops preserve active Purchase analysis versus inactive path forwarding. Destroyed retires only a matching owned window token, including when manager lookup is already absent. It changes only event registration, not auth, business or application shutdown state. Focus/blur and unrelated events have no application-state effects.

## Async contract and explicit limits

Picker/drop capture a lease before generation/start/work. Completion uses the existing active/current-generation cancellation rule and rechecks the captured Main pair. The lease is revalidated again before eval scheduling. Current observed stale, cancelled, retired or replacement destinations are suppressed. Existing start then result OR error order and payload generations remain unchanged. Failed start scheduling prevents further analysis admission.

There is NO general production Main generation/replacement registry here: one setup lifetime, no rebind/recreation. Resource identity does not identify document navigation, account/workspace revision or a new JS document in the same WebView. Purchase generation and eval scheduling are not an atomic transaction; supersession can occur after the check, and scheduled JS cannot be revoked. Existing frontend generation/acceptingResults checks remain necessary. A receiver epoch/revision and cancellation protocol, and serialized/acknowledged delivery, are required before broader lifecycle or Surface support. This change does not claim absolute stale-message absence at receive time.

## Validation ledger

Synthetic and full Library results are recorded below after completion. Existing 48 command signatures were compared exactly against baseline and all match; guard implementation, auth/ChatGPT files, frontend, capabilities and dependencies are unchanged. Only lib.rs event routing/setup and purchase_helper.rs event-admission logic plus new shared event policy/transport/tests are changed.

Three runtime hypotheses: (1) non-Main or stale identities could trigger effects: pure production policy tests deny all such cases with zero effects; (2) target-name filtering alone could leak to global listeners: source audit proves Any bypass, so transport selects only the physical Main VM; (3) private callback IDs or payload quoting could break compatibility: Node executes the production JS with non-enumerable numeric IDs and inert quoted payloads, preserving callback shape.

## Completed verification

- Main-local delivery Node suite: **11/11 PASS** (six events, physical Main/Surface VM isolation, inert quotes, non-enumerable IDs, target exclusions, missing internals/unknown event, pinned lockfile and no-emitter source checks).
- Independent pure production identity/window policy driver: **6/6 PASS**. Nine event variants tested for both valid and alien window identities; missing/replaced/revoked pair rejects effects; old lease and numeric-ID reuse cannot substitute private Arc identity. Isolated mutation removing revocation rejection fails, original passes.
- Three new Library Purchase tests use the production deliver_current helper: current start/result/error ordering, missing/replaced destination suppression, superseded/cancelled/closed generation suppression.
- Full safe Rust Library: **358 passed, 0 failed, 1 filtered**, exit **0** (`library.log`, `library.exit`). Only `current_windows_shell_probe_returns_a_consistent_sanitized_result` is filtered to prevent real Explorer access. This includes the prior 48 source-bound command cases and authentication/ChatGPT policy regressions.
- All-target `cargo check --offline --locked`: exit **0** (`check-final.log`, `check-final.exit`). There are no compilation errors. Existing worker_evidence write_json dead-code warning and new pure-policy passive-event variant dead-code warning remain; they do not imply Windows execution.
- Scoped rustfmt: full new Rust files/lib.rs and changed Purchase implementation region pass. Unrelated legacy formatting outside the Purchase event region is preserved. `git diff --check` passes.
- Independent goal, code quality, security, hands-on Synthetic QA and context/ABI reviews: **all five PASS**, with the private-ABI, scheduling and generation limitations above retained. Review agents are not human approval authorities.
- All **48 command signatures exactly match baseline**. MainCallerGuard/auth/ChatGPT/frontend/capabilities/dependencies and qa/desktop-surface have no changes.
- Protected artifact SHA inventory: **15/15 unchanged**, verified against `C:/Users/Public/Documents/BOGUNON-9b3jc-output/protected-before.sha256`. Existing Runner/Gate/Evidence source inventory: **40/40 unchanged**. Original 9b3jd artifact/manifest/descriptor/packet SHA inventory unchanged.
- Prior integrated Evidence `e2a3e291a572ddb5b5682a81cfe1df27a14328cfca705a6cd15156b2d1363db8`, Claim `f533ef5178698ffd1a8af6c7de4bce4d6139939f56ed769790277d27f643bcfd`, operator record `369c362659695bfb9c61cbe29853a6fc7245b942276906df86abb4f4e8ba061d` and the previous stdout/stderr/authorization basis hashes remain unchanged. No rerun.

External verification logs: `C:/Users/Public/Documents/BOGUNON-event-boundary-output`.

No new P0 or in-scope blocking P1 was found by independent review. Remaining integration risks are private Tauri ABI, unacknowledged queued JS delivery, check/send cancellation race, and absent navigation/account/workspace/replacement epoch registry. Do not enable Surface or claim actual Main/WebView2 noninterference from this evidence. Actual Windows startup, tray/close, drag/drop, async completion and listener execution remain **NOT VERIFIED**. Final scoped verdict: **EVENT_BOUNDARY_READY**.
