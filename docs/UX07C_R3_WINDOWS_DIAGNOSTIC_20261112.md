# UX-07C-R3 Windows Palette Diagnostic — 2026-11-12

## Verdict and scope

**CONDITIONAL. UX-07D NOT STARTED / blocked pending remaining native evidence.** No product defect was confirmed and no product code was changed. The prior calendar-click concern was a test-target error, now corrected by actual Windows input. Blank Shell entries remain unidentified. Taskbar group contents were subsequently verified PASS in the addendum below.

## Git and executable provenance

Repository school-health-hub/BOGUNON_DESK (PUBLIC), branch codex/electron-h6-design-renewal. Start HEAD and remote both ba89a2bddf01173941f002938916dbcfb48e7dd7; working tree initially clean. Reused E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-h6-design; no other worktree modified.

Reused existing build/electron-p0-app, build-meta sourceSha a96e720e3369bea11c6067745309c749fe523f4f, dirty false. git diff a96e720 HEAD contained only the preceding home QA Markdown, so all product sources were identical. This is an explicitly reused a96e720 build, not a newly stamped ba89a2b binary. Electron45.2.1 / Chromium156.0.8078.75. The prior exact-product TypeScript/production build PASS is reused; no unnecessary rebuild or full tests.

## Existing evidence analysis

All 12 files referenced by the previous local manifest matched their recorded SHA-256. Previous native click at (605,430) was inside calendar-cell whitespace. DOM inspection now proves it was not inside the date button. The old test did not establish a product failure. Prior grouped taskbar icon and Alt+Tab screenshots alone did not identify individual Shell items; these findings are not upgraded by source settings.

## Actual 13-widget click contracts

| TD2 type | Existing Palette contract |
|---|---|
| clock | Display only |
| today-summary | Display only |
| priority-task | Nonempty task title opens Workspace; empty state display only |
| monthly-calendar | Date-number button only opens Workspace; cell whitespace has no action |
| today-tasks | Internal checkbox changes local completion; task title opens Workspace |
| quick-memo | Internal edit/copy/clear; explicit save uses existing local memo IPC; task/URL actions open Workspace |
| quick-launcher | Four action buttons and empty folder button open Workspace; no favourites in Palette |
| upcoming-schedule | Display only |
| dday | Display only |
| weekly-schedule | Display only |
| notifications | View-all/item opens Workspace |
| meal | Current Electron signedOut notice is noninteractive |
| weather | Current Electron signedOut notice is noninteractive |

Sources: src/widgets/*Widget.tsx; src/widgets/CalendarWidget.tsx:77-101; src/styles/components.css:80; electron-p0/renderer/palette/PaletteApp.tsx:66-70; Electron PersistentMemo adapter and vite.config.ts. Palette is editing=false; no editing/drag/hide chrome contract. Original non-Palette launcher external-site behaviour is intentionally mapped to Workspace here. No universal widget-body click contract exists.

## Corrected native date-button check — PASS

Computed Nov12 button bounds: x557.703125 y407.8125 width20 height20. Old (605,430) hit a DIV.calendar-cell; new native click at (568,418) hit the actual BUTTON. Observed pointerdown/mousedown/mouseup/click all isTrusted=true, recorded client coordinate (567,418). Palette input became enabled; Workspace emitted show and became visible/focused. Inert background received zero clicks. No DOM click or forced interactive state was used.

Actual callback: CalendarWidget selectCalendarDate -> Palette provider openQuickAddEventForDate -> electronPalette.openWorkspace -> restricted preload p0:palette:open-workspace -> main sender validation -> Workspace lifecycle show/focus. No code repair is needed.

## Input routing, transparency, and lifecycle

Main cursor/hit-region polling is every50ms; renderer mousemove/focus adds routing. show/hide initially ignores mouse with forward=true. Observation-only wrappers delegated to original setIgnoreMouseEvents and recorded show events; they did not force state. DOM capture listeners only observed trusted events.

A native click at transparent (100,930) reached only the full-screen inert synthetic QA background at (99,930), isTrusted=true. Workspace remained hidden. This is a safe click-through PASS, not an operating desktop icon test. Workspace hide/show preserved Palette's HWND. No geometry/schema/TD2/Dock source changes occurred. Isolated synthetic desktop/layout hashes matched the prior default values; no work JSON was created by these checks. Real-user profile was not inspected.

## Native window identity and Shell diagnosis

| Window | Electron ID | HWND decimal | Main PID | Parent/owner | Focusable / skipTaskbar |
|---|---:|---:|---:|---|---|
| Workspace | 1 | 1248744 | 8364 | none / 0 | true / default false |
| Palette | 2 | 73074326 | 8364 | none / 0 | true / true |
| Synthetic background, diagnostic only | 3 | 244779344 | 8364 | none / 0 | false / true |

PID8364 is the real browser process; launcher PID63920 was a wrapper. Palette/Workspace HWNDs stayed stable. DWM cloak=0 for all three. Hidden native helpers (IME, power messages, tray host, Chromium helper windows) were inventoried separately; none was identified as a titled blank BOGUNON Shell item. Dock is renderer content, not a BrowserWindow. The only other product constructor is an unused hidden temporary Newsletter export worker.

Alt+Tab visibly contained Workspace plus three blank BOGUNON DESK items. Temporary diagnostic titles assigned to all three controlled BrowserWindows changed the real Workspace tile; no Palette/background diagnostic title appeared, and all three blank items kept their original title. Titles were restored. This distinguishes controlled BrowserWindows from the unexplained Shell items but does not assign those items a HWND/PID. Previous hidden/shown evidence also preserved them. A root cause such as cached Shell registration or another session cannot be asserted.

There was an additional owned startup attempt PID13944: missing pre-created QA root caused ENOENT before initialization. This was an operator setup error. Closing its error dialog left hidden helpers; ownership matched that exact failed attempt. A normal documented CDP Browser.close request ended it and children; no forced termination. Its relationship to the three earlier blank items remains unproven, and it cannot explain the older captures by chronology. The successful QA profile was pre-created under E: and used throughout.

Taskbar captures show the Palette-only state without an Electron taskbar icon, while Workspace display restored the Electron icon. However group contents were not captured. The Windows tool did not expose a targetable taskbar surface. A single manual group-opening request was presented to the user; it remains unconfirmed. **Group membership NOT VERIFIED.** No unsupported Shell input, system-level window manipulation, WorkerW, focusable/owner blanket change, Shell restart, or private-app clicking was attempted.

## Validation matrix

| Requirement | Result |
|---|---|
| Correct actual widget button and Workspace response | PASS, native trusted input |
| Palette separate taskbar icon absent | PASS, including user-opened group and hide/reshow addendum |
| Palette Alt+Tab exclusion | No Palette/diagnostic title observed; overall CONDITIONAL due 3 unidentified items |
| Workspace visible/focused after action | PASS |
| Workspace/Palette independent hide/show | PASS, stable HWNDs |
| Transparent gap click-through | PASS, synthetic background only |
| Normal final quit / residual process check | Recorded at closure below |
| Related focused tests | Historical16 PASS reused; NOT RERUN because no product/test change |
| TypeScript / Electron production build | Prior same-product PASS reused; NOT RERUN |
| git diff --check | Required before scoped docs commit |

No actual product code or test changed. Do not treat absence of a confirmed defect as complete native PASS.

## Evidence and next step

Evidence remains private/local at E:/BOGUNON_DEV/qa-output/UX07C_R3_20261112. It contains HWND metadata, launch provenance, trusted click trace, gap trace, captures, and hash inventory. Original prior evidence is preserved in its original folder. Full-desktop switcher captures contain Codex/terminal thumbnails and are not approved public attachments. Only this non-sensitive report is intended for Git; no secrets or operational data are uploaded. Best-effort secret-pattern/manual review applies because no dedicated secret scanner is installed.

Next approved work is narrowly the actual taskbar group and blank Shell item identity, using an approved native observation method or user's manual opening. Do not alter Palette window policy until a specific live product window is connected to the anomaly. UX-07D remains blocked. All existing module/data/security boundaries remain unchanged.

Final report-only commit SHA is available through git log -1 -- docs/UX07C_R3_WINDOWS_DIAGNOSTIC_20261112.md; source/build provenance remains as stated above. Verify normal push, remote HEAD equality, divergence0/0 and clean tree. Original evidence has no approved online transfer, so full cross-PC original-evidence review remains BLOCKED independently of Git sync.

## Closure result

Normal complete-quit finished. Exact QA Electron executable process count was 0, including failed attempt13944 and successful main8364; their inspected listening ports were absent. Codex/Windows helper processes were retained. Temporary diagnostic journal was preserved in local evidence and removed from the worktree. No product source edits or runtime instrumentation remain. Taskbar group manual confirmation was not completed; do not infer PASS.

## User-assisted taskbar group verification — 2026-11-12 addendum

The user requested QA relaunch and manually opened the actual Electron taskbar preview. Reused the same isolated E: synthetic profile and identical a96e720 product build; no rebuild or product modification. Main PID58144; exactly Workspace ID1 and Palette ID2. Actual preview contained one BOGUNON DESK Workspace thumbnail only. With that popup open, Palette was hidden then reshown via the existing menu actions; one Workspace thumbnail remained in both states. Palette HWND stayed de05690400000000 and Workspace da0b8e0600000000. **Taskbar group exclusion PASS**. The earlier NOT VERIFIED / pending statements above are historical and superseded for this item only.

Evidence: taskbar-group-user-opened-crop.png, taskbar-group-palette-hidden-crop.png, taskbar-group-palette-reshown-crop.png, group-relaunch.json, group-check.json in the existing R3 local evidence directory. Captures are explicitly cropped derivatives confined to the preview; unrelated screen material was not retained in these evidence files. No raw full-screen copy is claimed.

The existing complete-quit action was invoked after verification. Final process check confirmed 0 remaining QA Electron processes. Overall UX-07C remains CONDITIONAL solely for the unidentified blank Alt+Tab entries; UX-07D remains NOT STARTED. No earlier tests were rerun.
