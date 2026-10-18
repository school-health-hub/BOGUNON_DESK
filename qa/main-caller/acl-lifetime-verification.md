# 9B-3K-E2 ACL and Main lifetime registry

Baseline: 50b28c889c15e6080407aeb94cb49e65f7e59a06, branch codex/desktop-surface-core-9b2a, clean at admission. Scope is source, Synthetic tests, static compiler checks and a local checkpoint. No Surface or Windows Live execution.

## ACL contract and generated evidence

Locked Tauri 2.11.5 uses tauri-build 2.6.3 and tauri-utils 2.9.3. build.rs supplies all 50 actual invoke-handler command names to AppManifest::commands. The build generates 50 permission TOMLs containing 100 individual allow/deny records; permissions/main-commands.toml explicitly lists the 50 allow permissions. No wildcard or default custom-command grant is used.

The separate main-commands capability is local-only, has webviews=[main] and no windows grant. Tauri matches window OR webview patterns: adding these permissions to the original windows=[main] capability would also admit non-Main child webviews inside Main. The original default plugin capability is preserved byte-for-byte. No Surface command grant is added. Label-scoped ACL does not replace the physical Rust resource guard.

Compiler output gen/schemas/acl-manifests.json uses the actual __app-acl__ key; gen/schemas/capabilities.json records merged configured capabilities. The Rust regression deserializes those outputs and uses the locked public Resolved::resolve(Target::Windows), requiring exactly 50 custom grants, each local, exactly main Webview and zero window patterns. It checks Main allowance and child/other Webview denial using the runtime OR matching rule. The frontend/static check verifies all generated command permission files and preserves the existing six plugin permissions. Generated schema files remain ignored; generated permission files are included with their build source.

## Runtime lifetime and navigation

MainCallerGuard retains its original pinned Webview and hosting Window Arc identity checks. MainLifetime pins a separate private resource pair and instance token. A generation lease, active/retired state, pending navigation phase, and current Channel registration epoch form document/event admission. Numeric labels or reused resource IDs cannot substitute for the pinned resources. Main is registered once; no recreation/rebinding feature is introduced.

Normal command authorization remains the first command-body operation and is strengthened by the actual caller URL's trusted-origin check and registry admission. Existing 50 command signatures, existing error shapes, secure-session data format, and authentication logic stay unchanged. Login is not an admission requirement: valid Main can restore a secure session before user login.

Public plugin::Builder::on_navigation is installed before configured windows. A rejected destination retires Main admission and invalidates channels/leases; this is intentionally sticky as required, even though the old local page may remain visible. No automatic recovery/recreation is provided. Other unowned Webview navigation is also denied by this QA-stage policy; there is currently no operational secondary Webview.

An allowed local navigation request advances generation and closes admission before Started. Matching trusted Started admits the new document before frontend bootstrap; Finished is not a command-readiness barrier. Waiting for Finished would risk rejecting the one-time secure-session restoration and Channel registration effects that can run before NavigationCompleted. Old leases remain invalid. Finished without Started cannot reactivate closed admission; mismatched completion, duplicate Started, overlap or counter overflow retires. A navigation that never reaches trusted Started remains blocked.

Origin policy follows tauri::is_dev() and exact configured development origin; Windows production uses the configured Main useHttpsScheme with tauri.localhost. Credentials, different scheme/host/effective port, opaque URLs and prefix lookalikes are rejected. Current config has local App(index.html), localhost:1420 development and local ../dist production. Configured external initial Main content is rejected. Setup also checks the observed current URL before registering authority.

Initial navigation may bypass plugin hooks before Tauri inserts the Webview into manager storage. Setup validation covers the initial observed URL, not a retroactive veto of initial loading. A setup-observed about:blank or other untrusted URL fails closed; actual platform startup timing remains to be tested.

OAuth opens the system browser via existing backend opener paths; deep links arrive through the existing plugin callback and do not navigate Main. Those paths and the original command implementations remain unchanged.

## Channel, event and Window integration

E1 public Channel envelopes, six event names/payloads, transfer ordering and 16MiB/8192-frame bounds remain unchanged. Each event lease carries Main instance/generation plus its captured registration epoch. Registration binds that epoch to the current generation. Replacement, unregister, navigation, reload and destruction revoke old registrations. Each transport frame rechecks generation/epoch; failures invalidate both the slot and current registration observation. No broadcast fallback exists. Purchase generation/cancel checks remain unchanged and execute with the destination lease check at completion.

Main close/drop identity classification stays physical, independent of business admission. This preserves close-to-tray during loading, while drop analysis/event delivery still requires an admitted registry lease. Non-Main close/drop has no Main policy or analysis side effect. Existing hide/restore/tray logic is retained for normal admitted Main.

Lock order is Channel slot then registry. Navigation/page-load/destruction release registry state before Channel cleanup. Runtime URL getters run before command admission and outside Channel/registry locks; event checks use pinned resources and hook-recorded state without a synchronous UI query under these locks. No lock is held across an await.

## Evidence limits

Public hooks expose URL and resource identity, not an initiating document ID. Exact-URL matching cannot distinguish every same-URL late callback. Source/URL check, navigation callback and command effect/Channel submission are not atomic. Already admitted async commands are not cancelled or rolled back, and already queued WebView evaluations cannot be revoked by this registry. Channel submission success is not frontend acknowledgement.

Started authorizes a trusted local document, not successful completion of every network/resource load. The public page-load hook lacks a complete error/abort/navigation-ID contract; precise error-page, abort, same-URL callback, startup and reload scheduling are NOT VERIFIED. No claim of actual Windows WebView2 noninterference is made.

Pure tests exercise the production lifetime state and origin helper; public Channel::new tests exercise framed serialization/admission with a synthetic revocation predicate. They do not instantiate actual Main WebView resources or execute real child-Webview IPC. Generated ACL resolution is real build-data resolution, not a Live invocation test.

## Verification ledger

Final test counts, protection hashes and independent review results are appended after completion. External logs: C:/Users/Public/Documents/BOGUNON-acl-lifetime-output.

### Completed results

- Rust Library: 385 passed, 0 failed; the one real Windows shell probe was explicitly filtered out. The actual generated merged ACL resolver test passed.
- Frontend full suite with BOGUNON_VERIFY_GENERATED_ACL=1: 163 files / 988 tests passed, including both generated/static ACL checks. The final event-source regression was extended to cover extracted lease/channel/transport files and passed separately (2 tests).
- Cargo offline locked all-target check and TypeScript noEmit: exit 0. Scoped rustfmt and diff audit passed. The existing PurchaseColumnMapping::write_json dead-code warning remains unrelated.
- Pure lifetime driver: bootstrap regression first failed with 11 passed/1 failed, then passed all 12 after admitting trusted Started before Finished. Three production origin-helper cases also passed in the Library suite.
- All 50 existing command signatures unchanged. All original per-command guard regression cases pass. No original command implementation, auth, ChatGPT, OAuth/deep-link or frontend production file was modified.
- Five independent read-only review lanes completed. A reviewer found an incorrect generated manifest key in tests (__app__ instead of the actual __app-acl__); it was corrected and the reviewer rechecked actual generated tests passing. Security and quality lanes re-reviewed the bootstrap policy fix and reported no remaining P0/P1 within this source scope.
- Historical protected artifacts: 15/15 SHA-256 match; previous Runner/Gate/Evidence source manifest: 40/40 match; integrated static packet: 17/17 match. Existing integrated-evidence.json e2a3e291a572ddb5b5682a81cfe1df27a14328cfca705a6cd15156b2d1363db8, integrated-run.claim f533ef5178698ffd1a8af6c7de4bce4d6139939f56ed769790277d27f643bcfd, operator-record.USER-AUTHORIZED.json 369c362659695bfb9c61cbe29853a6fc7245b942276906df86abb4f4e8ba061d remain unchanged.
- Original default plugin capability, Cargo manifests/locks, package manifests/locks and every qa/desktop-surface file remain unchanged. No other worktree was modified.

### Failure hypotheses and allowed execution surface

1. Window-scoped ACL could authorize a non-Main child Webview. The actual generated ACL resolver test now observes false for child/main Window and true only for main Webview; application grants contain no Window patterns.
2. Waiting for Finished could permanently fail bootstrap restoration or registration. The failing pure driver demonstrated that trusted Started still denied admission. The corrected production state model admits the new generation at Started, with old leases rejected, and all 12 driver cases pass. Actual React/WebView2 timing is not claimed from this model.
3. A generation change during framed publication could allow the remaining result to escape. Public Channel::new test observes one admitted frame, then rejection and slot revocation when its admission predicate changes. Separate production lifetime tests verify stale instance/generation/registration rejection. This is Synthetic evidence, not a real navigation race test.

No Live approval is issued by these tests or reviewer agents. Actual Windows startup, origin/navigation callback ordering, Main hide/restore under load, reload, child-Webview IPC denial, same-URL stale callbacks, already scheduled delivery cancellation, abort/error pages and navigation TOCTOU require separately authorized Windows verification. No app, Native Runner, Explorer/WorkerW, Surface or operational data was accessed in this task.

Final source/Synthetic verdict: ACL_LIFETIME_READY. This is not Windows execution approval. Local checkpoint contains only this change; push and PR are not performed.
