# Dashboard v2 — Phase B integration contract

Status: design only; **Native activation blocked**. UI baseline 7b0e82f; historical 9B source checkpoint c67f5bf (separate, unmerged).

## Evidence and reuse

The candidate contains the 9B-1 probe, not the later guarded Tauri Surface. `src-tauri/src/lib.rs` still has global drop/close handling and does not include `main_caller.rs` or `main_lifetime.rs`. A second operational WebView must not be introduced on this baseline before Main command ACL/caller, window/event and lifetime/navigation boundaries are ported and reviewed for its current commands. Do not assume historical 50-command coverage covers newly added Finance/current commands.

Historical source references below are relative to the preserved `BOGUNON-9b2a` worktree, not this branch:

| Reuse | Evidence | Limit |
|---|---|---|
| Main resource guard / lifetime | main_caller.rs:58,98; main_lifetime.rs:108,125 | Exact Window/WebView pins, local origin and generation; dispatched effects cannot be recalled. Must adapt to current commands without relaxing policy. |
| Broker / projection | surface_broker/mod.rs:65,116,138; registry.rs:80 | OpenMain and RefreshProjection only; revision-only safe projection. Operational producer is unavailable; no business repository or credential access. |
| Renderer / asset boundary | qa/surface-broker/renderer-verification.md | Separate static entrypoint and closed bundle; no Main Provider tree/IPC/business data. Full Main dashboard cannot simply be mounted in Surface. |
| Tauri adapter | surface_adapter/runtime.rs:54,72 | Disabled first, effective isolation admission false. Not operationally activated. |
| Bound initial navigation | surface_adapter/bridge.rs:9,49 | about:blank during creation, exact local route/resource pins later; real callback ordering unverified. |
| Ownership / cleanup | surface_adapter/cleanup.rs:7,25,91,116; model.rs:53,199 | AttemptedUnresolved and Unobserved remain Unknown. No replacement or CleanupConfirmed issuer. |

Historical hardening records report 36 focused Synthetic, 469 Library and 997 frontend tests; these counts were read, not rerun. Native QA A+B only covers the dedicated one-shot hidden native QA window. It proves neither Tauri/WebView2 cleanup nor Explorer compatibility, OS queue quiet, Pump Stop C or thread join. Synthetic A+B+C integrated admission is a separate model. No historical approval/claim/evidence is reused or changed.

## Normal / requested / effective mode

- Normal remains default. No new setting, startup path or enable command in this work.
- A future explicit request must bind Surface instance/generation/operation/sequence and current Main lease. Requested mode is not effective mode.
- Denied preflight: zero construction, keep Normal with an actionable Unavailable reason. No Always-on-top substitute.
- Attempted creation with unresolved ownership, foreign identity, Explorer loss or cleanup Unknown: close Surface admission, invalidate pending work, preserve Unknown, block replacement and automatic retry. Main remains available only through its existing resource; never create/reparent Main as recovery.
- Explicit detach must operate only on pinned Surface resources. Main Tauri HWND/WebView2 are never borrowed by Native QA Owner, SetParent or destructor.
- Surface actions: OpenMain may reveal an existing validated Main without login dependency; missing/retired Main returns MainUnavailable. RefreshProjection returns only the current approved publication, never raw rows, paths, tokens, unsaved input, Finance state or fallback broadcast.
- Main windows retain authentication, business state, Finance/tools and storage. Surface has separate origin, effective WebView2 UDF and isolated renderer, and separate delivery from Main Channel. Logout/permission/navigation/Main loss revoke publication and registrations. Sequence/revision/generation checks run before delivery; queued delivery cancellation is not promised.

## Windows attachment and remaining blockers

WorkerW/Progman topology is not a stable public host contract. Historical UNSUPPORTED means the observed topology was not admitted, not proof that SetParent is safe or that every Windows version is impossible. This task performs no probe or Explorer query.

P0 before any production second WebView: current command/plugin ACL and actual caller identity, scoped business events and window policy, navigation/lifetime revocation, effective storage separation; no Main provider/data exposure.

Activation P1s from c67f5bf remain: configured UDF versus actual Environment/profile (including overrides/aliases and TOCTOU), initial blank bootstrap, partial build with no returned trusted handle, independent Window/WebView absence and backend handle release, full WebView2 cleanup. Effective UDF is deliberately literal false in isolation.rs:25–27. Destroyed alone is never success.

Explorer attach/detach must be a separate backend after isolated Tauri lifecycle is proven, with exact owned Surface identity, bounded operations, input/icon compatibility and safe fallback. No generic HWND/PID supplied by JavaScript, no Explorer termination/registry changes, no queued message pump bypass. Explorer restart/display/DPI/monitor changes immediately close admission; monitor rects must not strand Normal controls. Startup/login, taskbar/Alt+Tab, deep-link/single-instance and icon click behavior all require Windows observations.

## Minimum subsequent sequence (each separately reviewed)

1. Port/reconcile current Main ACL/caller/event/lifetime boundaries from 9B without changing business behavior. Inventory current commands including Finance.
2. Resolve effective UDF bootstrap and partial ownership/cleanup observations using supported locked APIs. Keep Disabled if impossible; no guessed proof.
3. Define non-sensitive producer and Surface-specific renderer/delivery. Revision-only Broker cannot display the full business dashboard; a richer allowlist requires explicit design approval.
4. Prepare an independent exact-source QA artifact, synthetic QA Main/Surface profiles disjoint from operational profiles, one-shot claim and real user approval. Do not run an existing Native Runner as substitute.
5. With separate Phase C approval, test one isolated Surface creation/navigation/close and evidence/Unknown handling, then separately scope Explorer attachment. No process kill for hang without an authorized supervision contract.
6. Validate Explorer restart, detach/fallback, multiple monitors, 100/125/150/200% DPI, resolution changes, taskbar/Alt+Tab, icon input, app exit, startup and deep-links. Record source/artifact hashes and explicit pass/fail/Unknown receipts. Failed/Unknown cleanup blocks recreation.

No Windows actual attachment, effective UDF, cleanup, Main noninterference or update-install compatibility is certified by this design.
