# UX-07E Desktop Palette integration report

## Scope and source

- Branch: `codex/ux-07e-desktop-palette-beta-integration`
- Base source: `d03a58fa7f73411aa2cdb9ebd31c0d8527e21947`
- Product boundary: Desktop Palette integration only; the installed beta and other
  worktrees were not modified.
- Native attachment: not used. WorkerW, Progman, `SetParent`, Explorer, and Windows
  Shell behavior remain out of scope.

## Implemented product behavior

- Desktop Palette is the new-profile default. The ordinary Workspace remains a safe
  fallback and the exclusive owner of authentication, files, AI, and business IPC.
- One transparent, frameless, taskbar-hidden Palette window is created per connected
  display. Empty regions pass pointer input through; widgets, edit controls, and the
  Dock receive input.
- Existing profile settings are preserved. Legacy Palette profiles are migrated so
  the first profile retains its widgets while secondary profiles start without an
  automatic duplicate set.
- The 13 widget IDs and global widget data contract are unchanged. Per-monitor state
  stores widget ownership, visibility, geometry, monitor identity, dormant state, and
  update time only.
- Edit mode provides widget add/move, hide, bring-on-screen, arrange, resize, Dock
  monitor selection, completion, and cancellation. A move transfers ownership rather
  than copying the widget.
- Exactly one Floating Dock is rendered. The selected Dock monitor survives restart;
  an unavailable monitor receives a temporary fallback without overwriting its saved
  preference.
- Display add/remove/metrics events reconcile profiles. Disconnected profiles remain
  dormant, and unique monitor fingerprints can restore a profile when a display ID
  changes. Ambiguous matches are not committed automatically.
- Work-area projection keeps titles and essential controls reachable without silently
  rewriting stored coordinates. Persistent geometry changes only after a direct user
  edit.
- The tray exposes `업무 창 열기`, `바탕화면 다시 표시`, and `일반 창으로 복구`.
  Closing Workspace leaves Palette active; explicit app exit closes the application.

## Windows GUI QA

The current source was built and run with an isolated synthetic-data profile on a
school PC with two physical 1920×1080 displays (renderer zoom 1.0).

- Fresh start: Palette appeared on both displays and Workspace did not open twice.
- Primary display: default widget ownership; secondary display: empty Palette.
- Widget ownership: `주요 일정` was moved to the secondary display. It disappeared
  from the primary display, remained single-owned, and restored on the secondary
  display after restart.
- Dock: one Dock only. It was moved to the secondary display and restored there after
  restart; the primary display had no duplicate Dock.
- Workspace: opened from Dock/settings as a separate normal window and closed without
  terminating either Palette.
- Input: empty Palette regions remained click-through; widget, Dock, edit, and
  Workspace controls accepted pointer input.
- Content boundary: eight synthetic schedule items were stored in the isolated QA
  profile. `주요 일정` displayed its contracted five-item view with a reachable
  internal scrollbar, and scrolling exposed later items without moving persisted
  widget coordinates.
- Physical display disconnect/reconnect: **NOT RUN** because it requires equipment
  manipulation. Synthetic 1/2/3-display, DPI/metrics-change, dormant-profile, display
  ID recovery, and reconnection cases passed automated tests.
- Palette-creation failure injection: **NOT RUN** in the packaged GUI. The fallback
  path was verified statically and through controller tests.

The GUI evidence was observed live. Captures containing the surrounding school
desktop were not committed or transferred because they could expose unrelated local
content. QA logs and the isolated profile remain under the approved F: QA root.

## Automated verification

- Electron TypeScript configurations: 3/3 PASS.
- Root TypeScript configuration: PASS; no separate baseline errors remained.
- Desktop Palette/mode/tray focused tests: 22 PASS, 0 FAIL.
- IPC/preload boundary tests: 29 PASS, 0 FAIL.
- Runtime package tests: 3 PASS, 0 FAIL.
- Electron product build: PASS.
- `git diff --check`: PASS.
- Dedicated lint script: NOT RUN because the repository does not define one.

The product build emitted existing bundle-size and missing-public-auth warnings. GUI
stderr also reported the existing Electron safe-storage deprecation and listener
budget warnings; neither produced a runtime failure during the Palette scenarios.

## Protection and remaining conditions

- Installed beta, user profile, authentication data, original UX-07D/E branches,
  protected worktrees, and other dirty work were not changed.
- The QA profile used synthetic memo/schedule data only.
- A physical hot-plug/reconnect pass and a controlled Palette-start failure GUI pass
  remain recommended before a production rollout. They do not invalidate the tested
  two-display integration candidate, but remain explicit release conditions.
