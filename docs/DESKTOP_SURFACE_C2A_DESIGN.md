# Desktop Surface C-2A Design and C-2B Handoff

> Portable handoff copy: only PC-specific paths are replaced; the original local plan is unchanged. Historical no-commit statements describe C-2A; this documentation checkpoint was subsequently authorized. C-2B implementation and runtime execution still require separate approval.
> `<FEATURE_WORKTREE>` is this feature checkout; `<CARGO_REGISTRY_SRC>` is the Cargo registry source root. Line references apply to pinned Tauri 2.11.5.
> C-1 Evidence: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/39638531486 . Local `.omo/evidence/` files are not committed or fetched by Git. Download the named artifacts separately when required; GitHub retention applies.

# desktop-surface-c2a - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** Main 권한·상태를 Surface로 넘기지 않는 구현 계약과, UDF·부분 생성·종료 증명의 승인 조건.

**Why this approach:** 현재 Tauri에는 모든 IPC를 Main 세대별로 철회하는 공개 runtime hook이 없다. Surface에 권한을 주지 않고, 내부 IPC까지 격리해야 하는 운영 경계는 별도 host로 분리한다.

**What it will NOT do:** 이번에는 코드·설정·설치본을 변경하거나 Native 실행·Explorer 조작·CI·commit·push를 하지 않는다. 이후 구현/격리 QA도 별도 승인이 필요하다.

**Effort:** Large
**Risk:** High - 실제 Windows 자원 소유권 및 브라우저 종료 증명은 아직 없다.
**Decisions to sanity-check:** 동일 Tauri 앱의 권한 없는 보조 창은 완전 무권한 IPC로 인정하지 않는다. 강한 경계의 권장안은 Main과 IPC 상태를 공유하지 않는 별도 Surface host이며, 새 실행 파일의 구현·패키징은 다음 승인 대상이다.

Your next move: 설계 결과에서 멈춘다. 다음 승인은 순수 계약/테스트 구현과 별도 host 검증 범위를 명시해야 하며, 운영 활성화 승인이 아니다.

---

> TL;DR (machine): C2A design complete; C1 remains source-specific PASS; universal IPC revocation and Native activation remain BLOCKED.

## Scope
### Must have

#### Baseline and evidence inheritance

- Repository/worktree: `school-health-hub/BOGUNON_DESK`, `<FEATURE_WORKTREE>`.
- Controller/local/remote HEAD: `c6951b4e54c52603da90b2226b81bdc7d6dc2461`, clean at entry.
- C-1 source: `ab5eb3f078b63428511d758137ba7747e54396f0`; run `39638531486`, attempt 1, completed/success re-queried read-only.
- Actual source delta C0 -> controller is exactly nine C1-only files: workflow, two Node files, verifier Cargo.toml/lock/build.rs/lib.rs/tests.rs and CI document. Application `src/`, `src-tauri/`, package/lockfiles have no delta. Controller is not a separately verified application source.
- Production artifact `12363259646`, ZIP SHA-256 `90e80645ed61f3d57ff5822c4e71fe73918e1797219a50c825fc28bca5b829b1`; QA artifact `12364792886`, ZIP SHA-256 `d7f6c239324277f223b794c4b27c110144cc5f192157f73a072d2bdb15549309`.
- Both report generated manifest hash `600c4c96f42cb33b3a4366410f7636595d2d87dff07200fef75199241aa6623a` and file capability hash `8d5bf50322c384c469f3055c9a8f68efc091ca801aa7be317485a2804abbc125`. The same file capabilities produce DIFFERENT effective ACLs because Finance QA selects an inline capability. Inspecting the file alone is insufficient.
- C1 proves Windows compilation, source Library tests, frontend tests and generated Context authority checks: 61 production / 12 QA / 62 unique commands; 124 app allow/deny declarations. It does not invoke a real Main/Surface WebView or prove native identity/navigation races. Each configuration has 414 Library passes, one deliberately ignored isolation seed fixture; frontend 1222 passes.
- Later code, ACL, feature, target, dependency, configuration, bundle or host changes do NOT inherit C1 PASS. New verifier/controller and source SHA, lock/config hashes and a separately approved run are required. Keep C1 artifacts/approval untouched.

#### IPC feasibility conclusion and per-permission policy

Pinned source root T: `<CARGO_REGISTRY_SRC>/tauri-2.11.5`.

1. `T/src/webview/mod.rs:1795-1802` resolves ACL by origin/window label/WebView label, not Main instance/generation. `:1855-1863` dispatches plugins separately; app invoke_handler is only `:1907-1909`.
2. `T/src/lib.rs:813-819` provides additive capabilities. No supported per-generation runtime remove/revoke API was found. Pre-build unstable `Context::runtime_authority_mut` used by C1 is diagnostic instrumentation, not a live AppHandle security boundary. Private-map mutation, invoke_system JS replacement and global remove_plugin are rejected substitutes.
3. `T/src/webview/mod.rs:1822-1826` exempts `plugin:__TAURI_CHANNEL__|fetch` from ACL rejection. `T/src/ipc/channel.rs:318-333` fetches from an app-wide queue using numeric header ID without caller/generation binding. Valid invoke key/data ID are still needed; this is a verified framework exception, NOT evidence of an observed data theft.
4. Channel interceptor at `T/src/ipc/channel.rs:147-150` is outbound only, not a universal inbound firewall. Already accepted file/network effects and queued eval cannot be undone by retirement checks.

Therefore **complete dynamic revocation of all custom/plugin/core/internal IPC is BLOCKED with supported pinned Tauri APIs and unchanged Main semantics**. This is not a claim that no framework fork or different architecture could ever implement an interceptor. Do not make generation-wide revocation a fictitious PASS condition.

| Current permission/group | Current residual authority/risk | Main policy for follow-up | Surface policy |
| --- | --- | --- | --- |
| `main-commands` (61) / QA `finance-qa-commands` (12) | App wrapper authority; accepted effects may outlive lease | Keep static Main-only ACL AND actual resource/lifetime guard; check before sensitive effect and at result delivery | Never grant or forward these IPCs |
| `core:app:default` | Version/identity plus listener registration; not a generation gate | Preserve existing behavior initially; audit actual consumers before minimization | No exposure |
| `core:event:default` (also included in `core:default`) | listen/unlisten/emit/emit_to, including broadcast | No new business broadcast; keep six Main Channels; consider guarded backend facade only in separate regression-reviewed change | No event registration, broadcast or Main Channel |
| `core:image:default` | Includes `from_path`, resources and image bytes | Main-only static scope; future path access facade requires caller guard; do not classify as harmless metadata | No paths, images from local files, resource handles |
| `core:menu:default` | Mutable menu/application/window menu state | Existing Main-only scope; backend-only facade if later migrating JS calls | No menu IPC |
| `core:path:default` | Path operations and directory information | Static Main-only; remove unused grants only with consumer audit | No path IPC |
| `core:resources:default` | Resource close can invalidate pins/other state; availability risk | Do not expose Main guard resource IDs; immutable tombstone and fail-closed if pin is lost | No shared resource table or IDs |
| `core:tray:default` | Tray/menu mutation, global side effects | Main-only; backend-owned tray not Surface-owned | No tray IPC |
| `core:webview:default`, `core:window:default` | Enumeration/geometry, internal maximize/devtools paths; not pure read authority | Keep current Main behavior; scoped backend wrappers for later reduction; QA-only close stays QA-only | No Main HWND/WebView/window API access |
| `deep-link:default` | `get_current`, possible auth callback URL exposure | Existing trusted Main backend callback remains; no Surface forwarding | Never expose URLs/tokens |
| `notification:default` | Permission requests/notifications/channels/listeners | Main-only; dynamic side effects only through guarded backend if separately migrated | No notification plugin |
| updater check/download-and-install | Network, download/install side effects remain statically available to Main | No Surface grant, no update execution during Surface QA; separate guarded-facade proposal would require updater regression and new CI | No updater code or Environment/secrets |
| opener/store/dialog/autostart plugins registered but not granted to JS | Backend initialization is not JS permission | Preserve trusted backend behavior; don't infer grants from registration | No direct invocation |
| internal Channel fetch exception | Outside the enumerated effective ACL; shared queue, not lease-bound | Retain small frames for six Main events; audit other producers before any same-process Surface | Zero-capability Tauri WebView is insufficient for a zero-internal-IPC guarantee |

Appendix below inventories every effective core/plugin command from the actual C1 reports. Static Main-only scope PASS is independent of dynamic revocation BLOCKED.

#### Selected Surface boundary and alternatives

- Renderer is independently bundled and has no Main App/Provider/auth/repository/Finance/updater imports, browser storage usage, arbitrary URL access or Tauri API imports. Initial data is revision-only; later fields need explicit non-sensitive schema approval.
- An ACL-empty WebView inside Main's Tauri App can test ordinary command denial, but shares the process/manager/internal IPC queue. It remains a **diagnostic-only alternative**, not the selected strong zero-authority operating boundary.
- Recommended strict boundary: a separate Surface host with no Main Tauri IPC bridge, plugins, Main resources or Channel queue. The host must have no general-purpose invoke endpoint; its backend bridge accepts exactly OpenMain and RefreshProjection. An empty separate Tauri app still has its own internal framework IPC; use a host without that bridge when claiming no Tauri IPC. This architecture is a future implementation decision requiring explicit approval, not a new process created here.
- OpenMain requests show/restore of the existing resource-pinned active Main only, without login prerequisite. Main missing/retired -> MainUnavailable. Never recreate Main, execute login, finance or business actions.
- RefreshProjection reads only an already approved Main-generation-bound publication; no producer -> Unavailable, never zero defaults. Broker never queries credential/file/DB/network/DOM. Logout/permission change/Main loss/navigation invalidates publication and in-flight responses. Display state expires on a bounded monotonic lease/heartbeat failure; clearing an already rendered old value is not atomic revocation, so no sensitive values may enter the schema.
- Trust the actual native WebMessage source/registration and transport peer, not JS labels/PIDs/tokens. Bind backend-assigned instance + generation + operation ticket + monotonic sequence and current Main lease; duplicate/reordered/stale/overflow -> deny. Require top-level fixed origin, no frames/popups, payload size limit and unknown-field rejection.
- Interprocess bridge, if approved, needs OS-peer identity and per-launch authenticated session binding (restricted endpoint ACL/no generic shared channel). Same-user process separation is not an OS-user/native-compromise sandbox. Any stronger filesystem isolation requires separate design/approval.

#### Effective UDF: actual folder observation contract

- Reuse 9B requirements, not its disabled proof claim: requested absolute backend-owned Surface directory, sibling/non-overlapping with Main, fixed separate origin `https://bogunon-surface.localhost`, Surface-only asset allowlist/CSP and no default UDF/incognito fallback. Do not change Main's profile, identifier or storage configuration.
- Preflight checks trusted configured Main path metadata only, canonical final paths and volume/file identity where possible, every reparse ancestor, equal/nested/aliased paths, applicable WebView2 environment/policy overrides and observation races. Do not read Main storage contents. Unknown, denied policy access or override -> refuse creation in the operating session. Never clear policy/env to force success.
- Actual public route in Tauri is `with_webview` -> `PlatformWebview.environment()` (`T/src/webview/mod.rs:185-193`). Query Microsoft `ICoreWebView2Environment7::get_UserDataFolder` from that exact returned environment. This is an actual effective absolute directory, not builder configuration or requested-path runtime cache key. Record profile path/name through the actual WebView2 Profile interface and verify it is beneath the approved Surface UDF, not a guessed default profile. Unsupported or unavailable Profile observation blocks activation; it is not optional proof.
- Perform COM queries and event token ownership on the owning STA; `with_webview` scheduling success is not a completed proof. Copy only bounded typed observations across threads. Pair allocated strings with the required deallocator; no unchecked COM casts, raw pointer Send or retained controller clones that prevent cleanup.
- Before any Surface asset/script/message admission: quarantined blank bootstrap, deny nonblank navigation, popup/download/permissions; require an instance-bound effective-UDF observation plus independently finalized directory-handle identity. Only then admit the approved fixed asset. Missing interface/callback timeout/wrong identity -> cleanup, never fallback.
- **Irreducible caveat:** Environment/WebView creation may already touch an override-selected UDF before its postcreation getter runs. Blank bootstrap does not prove zero storage contact. Neither Tauri data_directory nor absence of env variables proves a no-touch guarantee. First creation/override fault QA must run in a separately approved disposable account/VM with no operational profile. Production activation stays BLOCKED until this risk has a reviewed precreation control and empirical isolation evidence; postcreation mismatch detection alone is insufficient.
- QA independently compares native effective UDF/profile observation, actual final directory identity and disposable synthetic storage sentinels across both hosts. Do not rely on JS's report of its folder, a folder existing, command-line --user-data-dir alone, two HTML files or incognito. No real Main/QA financial data is used. Full paths/PIDs stay local/private; exported Evidence records sanitized hashes and correlated identities.

#### Ownership and cleanup receipts

Use one backend attempt ledger: `Reserved -> Creating -> Quarantined -> Verified -> Active -> Retiring -> Retired`; any ambiguous creation/teardown -> `CleanupUnknown`. Each transition is instance/generation/operation-bound, admission closes before cleanup starts, and counters cannot wrap. Reservation is not creation; Lost/Destroyed is not cleanup success.

| Failure stage | Owned resources and required action | Receipt consequence |
| --- | --- | --- |
| Before create | No native resource acquired; release only reservation after proving NotAttempted | No-resource receipt, not WebView2 cleanup proof |
| Tauri builder called, returns error/no resource | AttemptedUnresolved; never search/destroy by label or touch Main | CleanupUnknown, replacement prohibited |
| Window/controller/environment returned but pin/registration fails | Record each acquired resource immediately in its own ownership slot; close only exact owned resource, including when Main admission retired | Partial receipt until every acquired/unreturned dimension is accounted for |
| Registered Surface closes/disappears | Invalidate tickets/leases, detach broker, request one owned close/destroy, observe event/resource/runtime exit separately | Retiring/Unknown until complete proof |
| Observation timeout, panic, stale callback or process abort | No invented success, no automatic retry/force kill | CleanupUnknown and explicit next approval |

The stable Tauri `WebviewWindowBuilder::build` returns only complete `(window,webview)` or error (`webview_window.rs:438-440`); it exposes no partial ownership token. 9B intentionally keeps AttemptedUnresolved/Unknown. Do not turn a missing composite lookup into separate resource absence or invent a cleanup issuer. A separately approved host can expose creation slots explicitly (own Window, then Environment, then Controller, then registration), but must test all asynchronous failure/completion races. Tauri-owned HWNDs are never transferred to Native QA Owner or double-closed through raw COM/Win32 cleanup.

`CleanupUnknown` may transition to `Retired` ONLY through a new reviewed verifier issuing a receipt for the same attempt with all these dimensions:

1. Admission/tickets/producer deliveries closed, generation invalidated, in-flight callbacks/results fenced; old callbacks cannot reactivate it.
2. Every actually acquired or potentially unreturned Window/WebView/controller accounted for; exact owned OS/window teardown and separate registry removals observed. Stable missing composite is Unobserved, not proof of both absent.
3. Broker registration, temporary handles/controller references and callback subscriptions released; a non-authorizing tombstone may remain for replay rejection. Observation monitor is separate from active ownership.
4. Before closing, subscribe to the exact environment's `ICoreWebView2Environment5::BrowserProcessExited`, retain the environment monitor until event, correlate browser process identity + generation/creation identity, then remove its event token. Callback must be outside blocking teardown waits, with no re-creation racing the observer.
5. Correlated BrowserProcessExited confirms that environment's associated WebView2 process collection and resources have ended. Unexpected exit kind, mismatched event, shared environment, missing interface/event or deadline -> Unknown until independently reviewed evidence resolves it; do not treat mere process-ID disappearance as proof.
6. Release monitor/event references without COM cycles and verify no backend registration keeps this attempt active. No Main resource is closed as a side effect.

Destroyed, ProcessFailed, successful destroy dispatch, Drop, host exit, file unlocked or elapsed time alone never meet this receipt. UDF persistence/deletion is a separate outcome: retaining browser cache after verified shutdown is normal, and no UDF deletion is required for cleanup PASS. Deleting data or forcibly terminating a process is never a cleanup probe. Native A+B Proof is a different type and cannot issue the receipt. If a proof dimension cannot be observed using the approved APIs, replacement remains blocked permanently for that attempt.

#### UI-thread and user-session constraints

- Tauri 2.11.5 documents Windows creation deadlocks from synchronous commands/event handlers. Future creation must use a reviewed asynchronous/control-thread design; COM work stays on its owning STA, and no UI/event callback blocks waiting for its own completion or BrowserProcessExited.
- The actual Windows user/session and effective profile must be observed in the disposable QA process, not inferred from a Codex-launched process. Prior AppData virtualization means configured paths, automation paths and normal-user paths are separate observations. No live operating profile is inspected by this design task.

#### Authoritative sources

- [Pinned Tauri 2.11.5 builder](https://docs.rs/tauri/2.11.5/tauri/webview/struct.WebviewWindowBuilder.html): explicit UDF, navigation/new-window/download callbacks; Windows synchronous-command creation deadlock warning.
- [Actual WebView2 UserDataFolder getter](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment7).
- [BrowserProcessExited lifecycle and event token](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment5).
- [WebView2 UDF sharing and shutdown](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder).
- [WebView2 environment/policy overrides](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.2420.47).
- Exact installed Tauri code overrides newer Context7/dev-branch examples where versions differ. Microsoft Profile/EnvironmentOptions2 pages were not retrievable in this session; do not claim those optional interfaces were runtime verified.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No implementation/native execution/second WebView/Explorer/system policy changes/operational storage access/Actions/commit/push in C2A. Preserve all worktrees, installed0.2.2, main/release/Finance/Purchase/documents/9B and original Cargo marker. Only these ignored design Markdown artifacts are written.
- No Main reparent/recreate/close/logout/storage migration, no sensitive projection, no inherited approvals, no unsupported all-IPC revocation claim or synthetic cleanup receipt promotion.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: C2A runs no tests/builds; evidence is read-only source/artifact verification. Future implementation uses TDD with Node/Rust contracts, real generated Context ACL checks and separately approved disposable Windows QA.
- Evidence: existing `.omo/evidence/c1/run-39638531486/`; future `.omo/evidence/c2b/` must bind new source/controller/run/attempt/config/runtime/approval and one-shot scope. A CI artifact existing does not establish final run success.

## Execution strategy
### Parallel execution waves
Phase 1: pure policy/registry/projection and ownership receipt contracts, no creation capability. Phase 2: compile-only Windows verifier changes with new source pin and separate dispatch approval. Phase 3: individually approved disposable Windows isolation/partial-create/cleanup QA. Phase 4: Explorer integration QA only after earlier gates; never authorize it from C1 or this document.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2,3,4 | evidence inventory only |
| 2 | 1 | 5 | 3,4 |
| 3 | 1 | 5 | 2,4 |
| 4 | 1 | 5 | 2,3 |
| 5 | 2,3,4 + approvals | 6 | no operating QA |
| 6 | 5 + separate Native approval | activation decision | no Explorer until baseline isolation/cleanup PASS |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Build an explicit capability policy and source provenance contract (future approval)
  - Expected files: new `src-tauri/src/surface_boundary/policy.rs`, `scripts/desktop-surface-c2.contract.mjs`, C2 verification document. Existing main capability/configuration untouched in the first contract step.
  - References: current `src-tauri/capabilities/default.json`, `main_caller.rs`, `main_lifetime.rs`, `main_lifetime_state.rs`; C1 report inventory and IPC source evidence above.
  - Acceptance/QA: Node/Rust synthetic tests require Main roles unchanged, Surface no existing permission, remote/nonMain/Main-child deny, internal fetch exception marked NOT_COVERED rather than false PASS. Wrong source, stale generation and privilege allowlist enlargement fail. Record `.omo/evidence/c2b/policy.json`.
  - Commit: only if separately authorized; no commit now.
- [ ] 2. Introduce pure Surface broker/publication/renderer contracts
  - Expected files: selectively reused `src-tauri/src/surface_broker/{registry,policy,projection}.rs`, independent `src/surface/` entry assets and import-graph tests; no Main App/Provider reuse. Preserve MainChannel six events. No production producer hookup in contract phase.
  - References: 9B `surface_broker/registry.rs`, `surface_storage.rs`, storage-isolation.md; current Main resource/lifetime interfaces. Copy only reviewed pure contracts, not the complete9B tree.
  - Acceptance/QA: OpenMain prelogin permits only extant Main; Main absent -> Unavailable; RefreshProjection producer absent -> Unavailable; revision-only schema, logout/navigation/Main-loss clear, stale instance/generation/sequence/overflow/expired-lease deny. Static bundle graph excludes authentication, repositories, storage, Main Channel and Tauri privileged imports. `.omo/evidence/c2b/broker-renderer.json`.
  - Commit: separate approval required.
- [ ] 3. Add configured/effective storage proof types and observation adapter design
  - Expected files: `src-tauri/src/surface_boundary/{storage_contract,environment_observation}.rs`; a separate host crate `src-surface-host/` only after explicit architecture/dependency approval. No live factory in default path.
  - References: 9B `surface_adapter/isolation.rs`, current locked public PlatformWebview handles, Microsoft Environment7 and event docs above.
  - Acceptance/QA: Synthetic mismatched/aliased/nested/reparse/override/unknown interface/late callback denied. Windows compile-only checks exact COM types/STA lifetimes/allocated-string cleanup; no runtime observer result fabricated. `.omo/evidence/c2b/udf-contract.json`. A postcreation getter never passes precreation no-touch requirement by itself.
  - Commit: separate approval required; any new dependency/feature is reviewed and locked, never silently imported.
- [ ] 4. Model owned creation slots and scoped cleanup receipt
  - Expected files: `src-tauri/src/surface_boundary/{ownership,cleanup_receipt}.rs`; host observation implementation only after approval. No Tauri Main resource ownership transfer.
  - References: 9B `surface_adapter/{cleanup,model,identity,runtime}.rs`, `surface_broker/registry.rs`; Tauri builder complete-or-error return and Microsoft Environment5.
  - Acceptance/QA: Inject failure at reservation, environment creation, Window creation, controller creation, pin registration, navigation, shutdown and event removal. Return-order races, wrong event/process, retained controller/event cycles, callback after retirement, Unknown and counter overflow must deny replacement. NativeA+B and Synthetic receipt types cannot construct Tauri/host receipt. `.omo/evidence/c2b/ownership-cleanup.json`.
  - Commit: separate approval required.
- [ ] 5. Implement new compile-only C2 CI (not execute from this plan)
  - Expected files: a new/reviewed C2 workflow and verifier, new source pin and doc. Do not repin/relabel old C1 artifacts as C2 evidence. Keep production/QA custom command behavior and immutable baseline comparison explicit.
  - Acceptance/QA after separate dispatch approval: locked MSVC all-target checks and Library tests for production/FinanceQA; full frontend, TypeScript/build; generated Context tests cover existing61/12/62 plus intentionally reviewed new commands, zero Surface grants, exception reporting, broker/receipt tests. Compiler failure stops; no installer/Native startup/secret/Environment/release/updater. `.omo/evidence/c2b/ci/`.
  - Commit/push/dispatch: each requires authorization; none now.
- [ ] 6. Independent Windows QA and activation decision
  - Needs new exact artifact/source hashes, genuine operator approval and one-shot claim; dedicated disposable account/VM with synthetic Main and Surface roots, no installed operating profile. Explorer backend Disabled in the first QA artifact.
  - Navigation cases: before-load/reload/cancel/redirect/new-window/download; command arriving before/during/after retirement; in-flight side effect and queued response; stale process/instance/revision/Channel; all plugin families plus internal fetch tested and reported separately. No assumption that RuntimeAuthority tests prove actual WebView transport.
  - Storage cases: requested/effective folders and profiles independently match, forced override/shared/alias path denies, inaccessible policy fails closed, synthetic cookies/IndexedDB/localStorage sentinels remain separate and Main synthetic files unchanged. Never seed the ignored operating fixture into a real profile.
  - Ownership/cleanup cases: each partial-create failure, controller close with outstanding callback, browser normal/crash exit, resource missing, event loss/wrong PID/retained refs/timeouts. Missing proof stays Unknown; no kill/retry/automatic replacement. `.omo/evidence/c2b/windows/`.
  - Later separately approved Explorer cases: user-controlled Explorer restart (never agent kills shell), stale Progman/WorkerW/HWND identity, monitor removal/DPI/resolution/taskbar/Win+D/Alt+Tab/desktop icon input/sleep-session change. Loss invalidates Surface admission; Main remains intact; no automatic reparent/recreate, fallback requests existing Main only. Test unattached isolation and cleanup before desktop attachment.
  - Commit: none for QA observations; store new sanitized Evidence without overwriting previous evidence. No runtime QA in C2A.

## Final verification wave (future implementation only)
> These gates apply after the future implementation todos and their separate approvals. They are not unfinished work in the present design-only task and authorize no execution now.
- [ ] F1. Future implementation source/approval scope audit against this contract
- [ ] F2. Future ownership/COM/IPC code and generated ACL review
- [ ] F3. Real isolated Native QA only after separate approval; otherwise BLOCKED, never synthetic promotion
- [ ] F4. Main behavior/data and all protected worktree/artifact preservation audit

## Commit strategy
No commit or push in C2A. Only ignored `.omo/plans/desktop-surface-c2a.md` and `.omo/drafts/desktop-surface-c2a.md` are written. Future commits must separate policy/broker/observation/CI changes and require explicit authorization. Registry/native host introduction and execution are separate approvals.

## Success criteria

| Claim | C2A outcome / future PASS requirement |
| --- | --- |
| C1 evidence/source identity | PASS: current app source matches fixed tested C0; controller-only additions enumerated |
| Complete all-IPC dynamic revocation in unchanged Tauri | BLOCKED: no supported universal hook/revocation; internal fetch exception remains |
| Independent zero-business-authority renderer contract | DESIGN READY; no Main providers/storage/permissions/sharedqueue; actual host implementation NOT VERIFIED |
| Requested storage contract | DESIGN READY; actual effective UDF/profile and strict precreation no-touch remain BLOCKED until isolated QA/control proof |
| Partial-create resource recovery | BLOCKED for stable Tauri builder's unreturned resources; explicit host ownership requires new implementation/QA |
| CleanupUnknown -> Retired | BLOCKED until all correlated receipt dimensions above are observed; no timeout/Destroyed shortcut |
| Native navigation/IPC race and Explorer | NOT VERIFIED; independently approved Windows QA mandatory |
| C2A permitted work | Complete when evidence, feasibility, policies, implementation order and failure/approval conditions are documented; no product edits/execution |

This document authorizes no implementation or Native execution. Stop after reporting the design and blockers.

## Appendix: complete C1 effective core/plugin command inventory

This is the exact C1 static grant inventory, not proof of generation revocation. Every command below inherits its family policy in Scope; Surface receives none. Internal Channel fetch is an additional excluded framework path, not part of these lists.

### production: 111 effective core/plugin commands

- `plugin:app`: `bundle_type`, `identifier`, `name`, `register_listener`, `remove_listener`, `supports_multiple_windows`, `tauri_version`, `version`.
- `plugin:deep-link`: `get_current`.
- `plugin:event`: `emit`, `emit_to`, `listen`, `unlisten`.
- `plugin:image`: `from_bytes`, `from_path`, `new`, `rgba`, `size`.
- `plugin:menu`: `append`, `create_default`, `get`, `insert`, `is_checked`, `is_enabled`, `items`, `new`, `popup`, `prepend`, `remove`, `remove_at`, `set_accelerator`, `set_as_app_menu`, `set_as_help_menu_for_nsapp`, `set_as_window_menu`, `set_as_windows_menu_for_nsapp`, `set_checked`, `set_enabled`, `set_icon`, `set_text`, `text`.
- `plugin:notification`: `batch`, `cancel`, `check_permissions`, `create_channel`, `delete_channel`, `get_active`, `get_pending`, `is_permission_granted`, `list_channels`, `notify`, `permission_state`, `register_action_types`, `register_listener`, `remove_active`, `request_permission`, `show`.
- `plugin:path`: `basename`, `dirname`, `extname`, `is_absolute`, `join`, `normalize`, `resolve`, `resolve_directory`.
- `plugin:resources`: `close`.
- `plugin:tray`: `get_by_id`, `new`, `remove_by_id`, `set_icon`, `set_icon_as_template`, `set_icon_with_as_template`, `set_menu`, `set_show_menu_on_left_click`, `set_temp_dir_path`, `set_title`, `set_tooltip`, `set_visible`.
- `plugin:updater`: `check`, `download_and_install`.
- `plugin:webview`: `get_all_webviews`, `internal_toggle_devtools`, `webview_position`, `webview_size`.
- `plugin:window`: `activity_name`, `available_monitors`, `current_monitor`, `cursor_position`, `get_all_windows`, `inner_position`, `inner_size`, `internal_toggle_maximize`, `is_always_on_top`, `is_closable`, `is_decorated`, `is_enabled`, `is_focused`, `is_fullscreen`, `is_maximizable`, `is_maximized`, `is_minimizable`, `is_minimized`, `is_resizable`, `is_visible`, `monitor_from_point`, `outer_position`, `outer_size`, `primary_monitor`, `scale_factor`, `scene_identifier`, `theme`, `title`.

### finance-qa: 93 effective core/plugin commands

- `plugin:app`: `bundle_type`, `identifier`, `name`, `register_listener`, `remove_listener`, `supports_multiple_windows`, `tauri_version`, `version`.
- `plugin:event`: `emit`, `emit_to`, `listen`, `unlisten`.
- `plugin:image`: `from_bytes`, `from_path`, `new`, `rgba`, `size`.
- `plugin:menu`: `append`, `create_default`, `get`, `insert`, `is_checked`, `is_enabled`, `items`, `new`, `popup`, `prepend`, `remove`, `remove_at`, `set_accelerator`, `set_as_app_menu`, `set_as_help_menu_for_nsapp`, `set_as_window_menu`, `set_as_windows_menu_for_nsapp`, `set_checked`, `set_enabled`, `set_icon`, `set_text`, `text`.
- `plugin:path`: `basename`, `dirname`, `extname`, `is_absolute`, `join`, `normalize`, `resolve`, `resolve_directory`.
- `plugin:resources`: `close`.
- `plugin:tray`: `get_by_id`, `new`, `remove_by_id`, `set_icon`, `set_icon_as_template`, `set_icon_with_as_template`, `set_menu`, `set_show_menu_on_left_click`, `set_temp_dir_path`, `set_title`, `set_tooltip`, `set_visible`.
- `plugin:webview`: `get_all_webviews`, `internal_toggle_devtools`, `webview_position`, `webview_size`.
- `plugin:window`: `activity_name`, `available_monitors`, `close`, `current_monitor`, `cursor_position`, `get_all_windows`, `inner_position`, `inner_size`, `internal_toggle_maximize`, `is_always_on_top`, `is_closable`, `is_decorated`, `is_enabled`, `is_focused`, `is_fullscreen`, `is_maximizable`, `is_maximized`, `is_minimizable`, `is_minimized`, `is_resizable`, `is_visible`, `monitor_from_point`, `outer_position`, `outer_size`, `primary_monitor`, `scale_factor`, `scene_identifier`, `theme`, `title`.
