# soft-rose-desktop-native - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** A staged, fail-closed implementation path for Soft Rose widgets on the Windows desktop, with normal-window recovery.

**Why this approach:** Keep the privileged work app separate from a narrowly authorized Surface Host, reusing the existing observation, lifecycle and editing contracts.

**What it will NOT do:** No attachment, shell mutation, Native execution, deployment or changes to user profiles in this preparation step.

**Effort:** Large for the later implementation and real Windows qualification.
**Risk:** High - Explorer topology and cross-process composition/input are not stable attachment contracts.
**Decisions to sanity-check:** Recommend reusing the independently owned Native Host instead of reparenting the privileged Electron window. This is a proposal for the next implementation approval.

Your next move: Approve the next contract/bridge implementation scope separately; do not execute attachment from this plan alone.

---

> TL;DR (machine): design only; actual attachment NOT_IMPLEMENTED; actual Windows composition NOT_VERIFIED.

## Scope
### Must have
- UI and warning checkpoints preserved separately on `codex/soft-rose-desktop-surface`, based on `d779e121b5abeb69887abf399bd9c08ad64d54fa`.
- Main owns settings, authentication, Finance and the twelve work-tool routes. Surface owns only rendering/draft input; Host owns its native window and IPC lifetime.
- Identity-bound observation, transactional attachment/rollback, bounded cleanup and explicit UNKNOWN states.
- Independent real Windows acceptance for icon/input coexistence, Explorer replacement, monitor/DPI changes and composition.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- No privileged Electron Main reparenting, arbitrary HWND/path/URL/command supplied by a renderer, broad existing Main IPC exposure, or Finance/DPAPI access by Surface.
- No Explorer termination, hidden WorkerW-creation message, shell window destruction/reordering, registry/startup changes, always-on-top substitute, automatic attach retry or new QA workflow.
- No claim that CSS blur, an Acrylic request, a mock lifecycle test or S-3B-1 editing PASS proves attachment.

### Grounded reuse and limits
| Pinned source | Reuse | Limit |
| --- | --- | --- |
| `160eec4e3082f7477e5c6a515f2979eed2f1f773` `src-tauri/src/desktop_surface/{windows.rs,probe.rs}` | Progman/DefView/WorkerW topology classification | Read-only probe, no attachment |
| `c67f5bf1338b3f41c48c17d58ea57d956b48a82a` `src-tauri/src/desktop_surface/lifecycle/{observation_reader.rs,read_only_windows.rs,read_only_process.rs,machine.rs,model.rs}` | Identity checks, DPI context comparison, staged snapshot/rollback model | Adapter is test-only; no native HWND bridge |
| `e4dfcbf7b987039b093d3d1dbb8bed69a3bfcc6e` `src-surface-host/src/{native_window.rs,ownership.rs,ipc.rs,renderer_session.rs,live_surface_cleanup.rs}` and `src-surface/SurfaceApp.tsx` | Creator-thread ownership, authenticated Host/renderer lifecycle, edit/cleanup contracts | Different Tauri/WebView2 integration; Electron bridge absent |
| Same commit `docs/DESKTOP_SURFACE_S3B1_FINAL_GUI_QA.md` | Documentary GUI editing/cleanup PASS for binary source `36c6b13eb694318a015656d42f40488e395214c5` | WorkerW excluded; original evidence not revalidated here |

Read pinned files with `git show <SHA>:<path>`; selectively port verified contracts, never merge a historical feature branch wholesale. Current Electron build has no `src-surface-host` integration.

### Proposed process and permission boundary
Electron Main remains a normal top-level work window. It is never given to Explorer as a child. It starts one packaged, source/hash-bound Native Host through the authenticated launch/pipe design reused from S-2/S-3; peer process creation identity, private launch capability, generation, attempt and monotonic sequence are mandatory. Host rejects stale/duplicate frames and closes admission on pipe loss. Capability values never enter diagnostics.

Host owns a separate native HWND and isolated WebView2 environment. Before any visible Surface: attest packaged renderer identity, effective UDF directory ownership, RendererReady and cleanup capability. Surface receives only minimized widget view models and draft editing commands; no Electron preload, business IPC, arbitrary file/network access or Finance data. Dock sends a fixed action ID to Main; Main revalidates the session and opens the existing normal work window. No new Surface authorization is inferred from Main's existing privileges.

Enforce packaged-resource navigation/resource allowlists, external-navigation/new-window/download denial, permission-request denial and disabled privileged WebView host objects. Admit only the minimal versioned message schema with exact origin/frame/session checks. Synthetic hostile URLs, paths and message fields must be rejected. These are application controls, not proof that the same-user Native Host is an OS-sandboxed process; do not claim protection against a compromised Host executable.

Main owns committed layout data. Reuse existing layout IDs/grid/schema and Main validation. Native screen placement is a derived runtime projection, not a rewrite of saved widget coordinates. A future mode preference must be separate and default OFF; a requested mode is not an attached state. Store it only after its schema and compatibility tests are approved. Escape/cancel/session retirement discard Native drafts and must not change committed settings.

### Observation and attachment transaction
1. Query current shell topology without changing it. Require the current-session Explorer process identity (creation identity and verified image), Progman, DefView host and exactly one eligible existing WorkerW with monitor coverage. A handle number or class name alone is insufficient. No eligible WorkerW means normal-window fallback; do not send undocumented creation messages.
2. Bind a fresh operation/generation to the observation and the Host-owned HWND. Reject stale topology, changed shell identity, ambiguous ancestry or incompatible DPI awareness. Observation is never lifetime authorization.
3. Snapshot owned window parent/owner, styles, placement, visibility, bounds, DPI context, region, z-order and material policy. Reserve rollback ledger entries before writes. Use creator-thread native operations on the owned HWND only; never mutate Explorer styles, visibility, parent, icon list or z-order.
4. Hide the owned Surface, apply only reviewed child-window style/parent/placement changes, then re-read identities and actual state after every stage. `SetParent` alone does not set `WS_CHILD`/`WS_POPUP`; ambiguous null return requires last-error and observed-state checks. Do not change process DPI awareness after window creation.
5. Require verified parent identity, work-area bounds, region/input policy, correct shell stacking, RendererReady and material fallback before exposing the Surface. An API success return is not an `AttachedVerified` receipt. Never display a full-screen opaque canvas.
6. On partial failure, invalidate admission and hide the owned window, then reverse attempted stages while identity remains valid. Verify the full snapshot or close the still-owned Surface and verify destruction. If any identity/ownership is uncertain, stop writes, report `CleanupUnknown` and block further attach attempts. Main remains available in ordinary mode.

States: `NormalWindow -> Observed -> Preparing -> Attaching -> AttachedVerified -> Detaching -> NormalWindow`; failure enters `Fallback` only after restoration/owned destruction is verified, otherwise `RecoveryBlocked`. Persisted user intent and observed runtime state remain separate.

Each transition gets an operation ID and explicit deadline: prepare/observe 5s, native attach 5s, verification 5s, reserved cleanup 10s, total 25s. These are initial harness budgets, not performance evidence. All Win32/IPC/callback waits consume remaining budget; no unbounded wait or retry. Cleanup time is reserved even if attach fails early. A timeout remains a failure even if cleanup succeeds. Do not kill unrelated processes or delete UDF on uncertainty.

Synchronous Win32 calls can stall the creator thread, so that thread cannot guarantee its own deadline or completed cleanup. An independent Electron Main watchdog must keep the ordinary work window responsive, invalidate admission on deadline and report `RecoveryBlocked`/`CleanupUnknown` if Host is unresponsive. Do not promise a 25s destruction receipt. Any future forced termination of the owned Host requires separate identity-bound review/approval; never terminate Explorer or unrelated WebView processes.

### Explorer, normal-window recovery and shutdown
Use an unattached Host control window for shell notifications, supplemented by bounded process/topology observations. `TaskbarCreated` is only an invalidation hint: Windows may also broadcast it on primary-display DPI change. On shell replacement or ancestry loss, revoke the generation, stop input, hide any still-owned Surface and revalidate ownership. Never re-use old numeric HWNDs. If an attached child was destroyed with its parent, observe that destruction rather than writing to the reused handle.

First implementation returns to normal-window mode and requires a fresh user action; no automatic reattachment loop. Reconstitute a Surface only with a new generation after cleanup is verified. Electron Main's tray/menu provides the independent escape route. Restore/focus Main only after user request, without stealing another app's focus on shell recovery.

On normal exit, cancel draft editing, close admission, detach or close the owned Surface on its creator thread, observe WebView2/browser exit and ledger completion under deadline, and issue CleanupReceipt only if all predicates hold. Main crash/pipe EOF triggers the same bounded Host shutdown. Missing receipt or retained owned resources is UNKNOWN, not exit PASS. Preserve diagnostic-only logs and owned UDF; production profile cleanup/deletion is out of scope.

### Icons, focus, monitors, DPI and materials
- Treat icon/input coexistence as an early feasibility gate. A WorkerW without DefView does not prove correct icon stacking. Start behind the icon layer; accept only a topology where both widgets and icons actually work. Do not move/hide icons to make the demo pass.
- Test a bounded region union of visible widget/Dock islands on the owned HWND so transparent gaps are outside its hit region. Region coordinates are physical window-relative; region handle ownership transfers after successful `SetWindowRgn`. Child WebView input and dragging across region boundaries still require actual Windows proof. No global mouse hook or event injection into Explorer.
- `HTTRANSPARENT` is not a general cross-process click-through guarantee; `WS_EX_TRANSPARENT` is not proof of hit testing. If icon click/selection/drag or wallpaper context menu is blocked, disable attachment and fall back. Do not label successful visuals with failed input as PASS.
- Normal view must not steal foreground/keyboard focus or cover taskbar/other apps. Editing requires explicit entry and scoped focus; Escape releases pointer capture, restores draft baseline and notifies Main. Dock activation is a deliberate user action that may focus the ordinary work window. Verify Win+D, Alt+Tab, minimize/restore and another foreground app separately.
- Initial mode targets one selected monitor; never span the virtual desktop with one input plane. Reuse `electron-p0/main/desktop.ts:fitBounds` for ordinary-window DIP recovery. Native Host uses physical screen/client coordinates with explicit types/conversions and per-monitor DPI context; Electron DIP and native pixels cannot be compared directly.
- On `display-added/removed`, work-area/scale/rotation changes or `WM_DPICHANGED`, pause editing and re-project from committed layout. Respect taskbar work areas and negative monitor origins. Clamp only runtime geometry; preserve saved layout if a monitor disappears. If safe placement cannot be established, return to ordinary mode.
- Keep three result axes: renderer CSS material, configured native composition, actual attachment. Acrylic is a separate opt-in request, not a prerequisite that authorizes attachment. Native WebView2 alpha/compositor support for a WorkerW child is unverified; use clear gaps plus opaque readable cards when blur is unsupported. If clear gaps cannot be verified, attachment is unavailable. Test light/dark wallpaper, high contrast and reduced transparency; never use an opaque full-desktop fallback.

Primary references checked 2026-11-03: [SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent), [TaskbarCreated](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar), [WM_DPICHANGED](https://learn.microsoft.com/en-us/windows/win32/hidpi/wm-dpichanged), [SetWindowRgn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn), [WM_NCHITTEST](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-nchittest), [Electron native handle/material](https://www.electronjs.org/docs/latest/api/base-window). WorkerW/Progman topology is a compatibility observation, not a documented Windows desktop-widget API.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: future contracts TDD (Rust unit/state tests, Node controller tests); artifact-specific isolated Windows GUI tests after separate execution approval.
- Current preparation: no Native execution; focused browser QA and existing UI tests only. Browser success cannot satisfy Native runtime criteria.
- Evidence: sanitized JSON identity/transition/cleanup summaries and synthetic screenshots, each source/artifact SHA-bound. Exclude URLs, raw handles/PIDs, credentials, profile contents, financial data and environment dumps. Missing runtime artifacts remain NOT_RUN.

## Execution strategy
### Parallel execution waves
All Todos 1–6 are proposed and unapproved. Approval/preservation of this design does not authorize implementation or Native execution; the current UI/document checkpoint authorization is separate.

Wave 1 proposes contracts, isolated Host boundary and geometry/input feasibility hooks without shell mutation. After Todo 4's minimal adapter, a separately approved synthetic Windows feasibility checkpoint must prove child-WebView clear gaps, widget input and desktop icon interaction before broader Todo 5 integration. Failure stops integration and retains ordinary mode. Final runtime qualification also needs separate approval and an existing guarded workflow; no new workflow is planned.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 lifecycle | none | 4,5 | 2,3 |
| 2 Host boundary | none | 4,5 | 1,3 |
| 3 geometry/input model | none | 4,5 | 1,2 |
| 4 native adapter + approved feasibility checkpoint | 1,2,3 and execution approval for feasibility | 5,6 | none |
| 5 Main mode integration | 1,2,3,4 and feasibility PASS | 6 | none |
| 6 Windows qualification | 4,5 and separate approval | runtime PASS | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Port lifecycle contracts into an isolated Native bridge module, retaining pinned 9B reader/model references above. Add typed observation/operation identities and full rollback snapshots. No SetParent yet. Acceptance: focused Rust model tests reject reused handles, stale generations and partial rollback. Happy/failure: attach model then detach restores snapshot; injected failure at each attempted stage reverses or reports UNKNOWN. Evidence: `.omo/evidence/native-1-contracts.json`. Commit: scoped contract + tests.
- [ ] 2. Adapt the S-3 Host launch/IPC/ownership contracts to an Electron Main controller (`electron-p0/main/desktop-surface/`, new only after approval). Plan a separate packaged renderer entry with no P0 preload. Acceptance: Node/Rust focused contracts prove exact peer identity, bounded frames, stale/replay/origin rejection, pipe-loss shutdown and isolated effective UDF admission. Happy/failure evidence: authenticated synthetic snapshot accepted; forged action and unknown cleanup rejected in `.omo/evidence/native-2-boundary.json`. Commit: bridge + direct tests, no Main business permission changes.
- [ ] 3. Add pure physical/DIP/work-area projection and input-region policies to the isolated bridge; reference `desktop.ts:fitBounds`, 9B snapshots and S-3 `window_geometry.rs`. Acceptance: unit fixtures cover 100/125/150/200% scale, negative origins, portrait, monitor removal and invalid input. No system DPI changes. Happy/failure evidence: bounded projection and impossible-fit fallback in `.omo/evidence/native-3-geometry.json`. Commit: geometry + tests. Cross-process input feasibility remains NOT_VERIFIED.
- [ ] 4. Implement creator-thread Native transaction operations only on the Host-owned HWND. Reuse the documented snapshot/rollback state machine; add per-write identity checks and an independent Main watchdog. Do not reparent Electron Main or mutate shell windows. Acceptance: adapter contracts inject failures at every write/readback, enforce zero writes after identity loss and retain cleanup UNKNOWN. Unit/mocked proof alone cannot authorize attachment. Before Todo 5, obtain separate approval for one minimal isolated Windows feasibility run covering child-WebView clear gaps, widget input and desktop icons; a failure stops integration. Evidence: `.omo/evidence/native-4-adapter.json` plus source/hash-bound feasibility observations. Commit: adapter + failure tests; actual execution approval required separately.
- [ ] 5. Add Main-only mode orchestration with default ordinary mode, separate user intent/runtime state, independent normal-window recovery, fixed Dock action IDs and committed-layout/draft separation. Acceptance: focused controller tests cover toggle-off during attach/edit, Main exit, pipe loss, shell generation change, pending cleanup and no automatic retry. Assert existing layout IDs/schema, twelve routes and Finance/auth policies unchanged. Evidence: `.omo/evidence/native-5-controller.json`. Commit: scoped orchestration + tests, no unrelated migrations.
- [ ] 6. After explicit runtime approval, build the exact source through an existing guarded Windows workflow with no release/install/updater, then verify manifest/host/renderer hashes. Run isolated QA with synthetic data: real layering and clear gaps, icons click/marquee/drag/context menu, widget Drag/Resize/Escape, Dock action, foreground/minimize/Win+D, monitor/DPI changes, supported shell replacement and bounded normal/crash cleanup. Never force-terminate Explorer. Failure or missing evidence disables attachment; no retries by default. Evidence: `.omo/evidence/native-6-runtime-manifest.json` plus referenced sanitized observations/screenshots. Commit: diagnostic summary only when separately approved; no runtime PASS before evidence.

## Final verification wave
These are future implementation/runtime gates, NOT actions authorized by the current preparation request. The current preparation may finish with all runtime items NOT_RUN.
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
Current preservation is independent of all future implementation todos. Keep UI, notice fix, production CSS regression and design records as separate scoped commits; push only the authorized UI branch. Future native commits require new approval. No main/integration merge or deployment.

## Success criteria
- This preparation: scoped checkpoints remotely preserved, design grounded in pinned source and primary docs, current UI/browser verification accurately reported.
- Native implementation: contract/compile PASS is separate from runtime PASS. Only a source/hash-bound Windows session proving safe attachment, icon coexistence, recovery, data noninterference and CleanupReceipt may record actual attachment PASS. Until then NOT_IMPLEMENTED / NOT_VERIFIED remain explicit.
