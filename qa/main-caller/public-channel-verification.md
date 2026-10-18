# 9B-3K-E1 public Main Channel delivery

Baseline: 9bbbcb3f729a84c82b8a087b454a052b2d530f9c, codex/desktop-surface-core-9b2a, clean at admission.

## Public API and isolation

Locked Rust Tauri 2.11.5 ipc/channel.rs CommandArg binds Channel to command.message.webview(). Installed locked TypeScript API is 2.11.1. Registration and unregistration additionally run the unchanged MainCallerGuard before storing or changing a destination. The original 48 command signatures and guards remain unchanged; two guarded transport commands bring the registered total to 50.

No emit/emit_to broadcast fallback and no private listener ABI or application eval script remain in business delivery. Channel success is transport submission, never frontend acknowledgement.

Tauri 2.11.5 JSON messages at least 8192 bytes use an app-global fetch queue without requesting-Webview ownership validation. Therefore the unchanged business envelope is serialized and divided into UTF-8-safe chunks of at most 2048 bytes. Every actual serialized transport frame is checked below 8192 bytes before public Channel.send. Source-version admission remains pinned to 2.11.5. Transfer limits are 16 MiB serialized envelope and 8192 frames; exceeding either fails closed without truncation or fallback. Multi-byte boundaries can reach the frame cap below 16 MiB. No custom Channel interceptor is configured.

## Registration and lifecycle

The destination stays private in a mutex-serialized slot. A monotonically increasing registration epoch is captured in each Main event lease. Replacement, unregister, Main destruction, and Main page-load Started invalidate the slot. Stale unregister cannot remove a new registration. Old Purchase work cannot deliver through a replacement channel. Physical Main show/hide remains possible without a channel; business delivery requires an active matching registration.

Frontend DashboardCanvas and PurchaseHelperPanel share a module-local, reference-counted Channel. Registration/unregistration invocations are serialized; closed sessions discard callbacks immediately even before late registration acknowledgement. A consumer unmount removes its listener immediately. Last-consumer unmount and pagehide close the session. When other consumers remain mounted their own subscriptions remain valid. Framed transfers are reassembled contiguously with bounded size, stale transfer rejection and outer-envelope checks; nested Purchase records retain the trusted Rust serializer schema.

The public JS Channel has no public close/unregister method: cleanupCallback is private. Backend drop schedules the public transport end protocol, but missing/failed delivery can prevent callback-map cleanup. The frontend uses only public onmessage replacement and backend unregister; it does not claim complete SDK allocation reclamation.

## Event effects and preserved boundaries

- desktop:navigate / desktop:notice / desktop:file-drop retain names and payloads. Missing destination or send failure returns failure; no Surface/broadcast fallback.
- purchase:analysis-start admission failure stops the corresponding drop/picker analysis path.
- purchase:analysis / purchase:analysis-error retain generation and result/error schema and existing active/cancel checks. Delivery failure drops the result rather than exposing it elsewhere. A partial framed transfer cannot invoke the business handler.
- Existing Main close-to-tray and drop identity routing stay unchanged. No auth, OAuth, deep-link, ACL, navigation policy, or Main lifetime registry is added.

## Residual risks and explicit nonclaims

Channel registration checks, resource identity checks, UI evaluation and navigation are not one atomic transaction. Backend slot serialization prevents stale slot selection, not revocation of already queued evaluations. Frontend closed-session checks suppress application callbacks in the old realm; abrupt reload, numeric callback-ID reuse, delivery scheduling and Windows WebView teardown races remain NOT VERIFIED. Page-load invalidation is a subscription hook, not navigation authorization or a complete Main lifetime registry.

A Channel::new synthetic sink executes synchronously. Production stores only invoke-bound Channels and configures no reentrant interceptor; delivery holds the slot mutex to serialize against revocation. Future interceptor changes require re-audit.

No actual Windows/WebView/Main isolation, OS queue, Explorer, Native cleanup, or Surface rendering is verified here. Existing Live QA is not rerun. Synthetic callback delivery is the allowed execution surface for this stage.

## Verification results

Results and checkpoint are recorded after final checks below.

### Failure hypotheses exercised on the allowed Synthetic surface

1. A large Purchase result could enter Tauri's globally retrievable payload queue. Public Channel::new tests inspect actual serialized frame bodies, reconstruct 8191/8192/128-KiB envelopes and Unicode/escaping, and require every frame below 8192 bytes. Oversized transfers make zero sends; partial failures stop and revoke the slot.
2. A late register acknowledgement could revive an unmounted consumer. Deferred invoke tests dispose first, deliver queued callbacks before/after acknowledgement, and observe zero consumer callbacks plus eventual matching unregister. Replacement waits for old unregister acknowledgement.
3. A stale Purchase completion could reach a new registration. The actual destination-slot model rejects the old epoch after invalidation/re-register and ignores stale unregister; existing Purchase generation/cancel tests and bridge disposal regressions remain in the Library/frontend suites.

Independent source review lanes: goal/constraints, quality, security, QA coverage, and protection/context. These are code-review agents, not human approval signatories and not Windows Live validation.

### Completed checks

- Rust Library: 368 passed, 0 failed. The one actual Windows shell probe was explicitly filtered out; no Explorer query was executed.
- Entire target Cargo check: exit 0. Existing dead-code warning for PurchaseColumnMapping::write_json remains unrelated.
- Frontend full suite: 162 files / 982 tests passed after migrating the old node:test-only boundary file to the project's Vitest format. Initial full invocation reported that node:test file as having no Vitest suite; its assertions were retained and migrated, not removed.
- TypeScript noEmit: exit 0. Scoped rustfmt and diff whitespace audit passed.
- Original 48 command signatures unchanged; all original implementation files except the explicitly allowed lib wiring remain byte-for-byte unchanged. Two additional guarded Channel commands are included in the inventory regression.
- Historical protected artifacts: 15/15 SHA-256 match. Existing Runner/Gate/Evidence source manifest: 40/40 match. Integrated packet SHA256SUMS.PENDING.txt: all 17 entries match.
- Existing integrated-evidence.json e2a3e291a572ddb5b5682a81cfe1df27a14328cfca705a6cd15156b2d1363db8, integrated-run.claim f533ef5178698ffd1a8af6c7de4bce4d6139939f56ed769790277d27f643bcfd, operator-record.USER-AUTHORIZED.json 369c362659695bfb9c61cbe29853a6fc7245b942276906df86abb4f4e8ba061d remain unchanged.
- Five independent read-only review lanes returned PASS without concrete P0/P1 findings. Actual framework non-Main registration, WebView reload-hook timing, and Windows Main noninterference remain NOT VERIFIED.

External validation logs are in C:/Users/Public/Documents/BOGUNON-channel-migration-output. No app, Native Runner, WebView, tray or Surface was launched, and no existing approval, claim or evidence was modified.
- Final test-only coverage addition: scoped Channel/frame/Purchase lifecycle suite 3 files / 26 tests passed, including four additional unregister-failure, duplicate, replay, and changed-total cases. The full 982-test run preceded these four extra passing cases; no production code changed afterward.
