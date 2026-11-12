# UX-07C-R4 Alt+Tab Final — 2026-11-12

## Verdict

**UX-07C CONDITIONAL; UX-07D NOT STARTED / remains blocked.**

The actual Palette Alt+Tab exclusion check is now **PASS**. The three historical blank BOGUNON cards already exist before this product starts and do not follow Palette visibility. Their individual underlying application HWND/PID and creation cause remain **NOT VERIFIED**, so the requested overall CONDITIONAL rule is retained. They must not be described as three Palette windows or conclusively as stale Shell records.

## Starting Git and runtime

- Repository school-health-hub/BOGUNON_DESK; branch codex/electron-h6-design-renewal.
- Start HEAD and live origin: c3980b1ce4b00ce2e10d9cfb4fbfa08bc9df8731; working tree clean.
- Existing worktree E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-h6-design; no other worktree changed.
- Reused exact existing product build with build-meta sourceSha a96e720e3369bea11c6067745309c749fe523f4f, dirty false. Diff from that source to starting HEAD contains only two QA documents; all product bytes are unchanged. This was not represented as a newly built c3980b1 executable.
- Electron45.2.1 / Chromium156; primary monitor1920x1080, workArea1920x1032, scale1.0.
- Fresh E: synthetic QA profile; product main PID22740. No operational account/database/Finance profile was used.

## Existing evidence and controlled baseline

Reused R3 trusted native date-button click and transparent-gap PASS, plus the user-assisted taskbar group PASS at c3980b1. Those tests were not repeated.

To open the actual switcher before product launch without input to personal apps, an evidence-only inert Electron observer was created under the local R4 evidence directory. It used explicit app name UX07C R4 Observer, a distinct application ID, and its own E: profile. Observer main PID17184, HWND37621002. It is a known QA-only extra window, not product source or a new feature. Codex was preserved. Native key input targeted this observer only; no terminal/Codex/private-window automation occurred.

Before the BOGUNON product launched, actual Ctrl+Alt+Tab already displayed **three blank BOGUNON DESK cards** alongside Observer and ChatGPT. Thus their presence is independent of this newly launched Palette. An all-top-level read-only Win32/DWM/property-store probe enumerated295 HWNDs at baseline and found zero BOGUNON-title/AUMID product candidates. No other BOGUNON product executable was running at that point; the observer process tree was explicitly distinguished.

## Actual HWND mapping

| Window | BrowserWindow ID | HWND decimal | PID | Class | Owner / parent | focusable | skipTaskbar |
|---|---:|---:|---:|---|---|---|---|
| Product Workspace |1|12847294|22740|Chrome_WidgetWin_1|0 / 0|true|default false|
| Product Palette |2|64358778|22740|Chrome_WidgetWin_1|0 / 0|true|true|
| Synthetic observer |1, separate app|37621002|17184|Chrome_WidgetWin_1|0 / 0|true|default false|

Workspace and Palette both had WS_EX_TOOLWINDOW=false, WS_EX_APPWINDOW=false, WS_EX_NOACTIVATE=false in the sampled states, and DWM cloak=0. Neither was recreated during the sequence. The skipTaskbar value is separately sourced from Electron creation options; it is not used alone as the Shell verdict. Actual screen comparison supplies that verdict.

Dock is renderer content and has no independent native window. No Newsletter output worker was created. Other native helper HWNDs, including IME/power/tray/Chromium helpers, were inventoried separately rather than equated with BrowserWindows.

## Seven-state actual screen comparison

Ctrl+Alt+Tab was opened for each state. All counts include the fixed observer and ChatGPT entries. BOGUNON entries below distinguish the three generic blank cards from the real Workspace card, which has its actual rendered preview and Electron icon.

| State | Workspace visible | Palette visible | Total switcher entries | Generic blank BOGUNON cards | Real Workspace entries | Palette entries |
|---|---|---|---:|---:|---:|---:|
|1 Product not running|N/A|N/A|5|3|0|0|
|2 Workspace only|yes|no|6|3|1|0|
|3 Palette shown|yes|yes|6|3|1|0|
|4 Palette hidden|yes|no|6|3|1|0|
|5 Palette reshown|yes|yes|6|3|1|0|
|6 Workspace hidden|no|yes|5|3|0|0|
|7 Workspace reshown|yes|yes|6|3|1|0|

Palette's visible native HWND is confirmed present while its Alt+Tab entry count stays0. Workspace hide/show removes/restores exactly its one real entry. Three blank cards remain unchanged across all seven states. **Palette exclusion PASS; Workspace inclusion PASS; no extra Palette instances.**

Evidence consists of actual Windows desktop-compositor title-strip crops and time-correlated BrowserWindow/Win32 inventories, not DOM screenshots or options-only assertions. Crops are labeled derivatives; full private-window contents were not intentionally retained. R3 original evidence remains untouched.

## What the three blank cards could and could not be mapped to

Supported read-only UI Automation identifies the switcher container as Explorer PID12384, HWND93916584, class XamlExplorerHostIslandWindow. Its exposed InputSite child is HWND1246828, class Windows.UI.Input.InputSite.WindowClass. It does not expose per-card children, item IDs, or an application HWND through this provider.

Supported MSAA AccessibleObjectFromWindow / read-only IDispatch getters were also attempted. Open and closed switcher states expose generic container/window/title/scrollbar information only; no per-card identities were returned. An initial .NET COM cast failure is recorded separately and is not treated as evidence of missing cards.

Explorer owns three ThumbnailDeviceHelperWnd HWNDs2033024,1443936,1181684. All are unnamed,1x1,cloaked=1, and persist with the switcher closed or open. Equal count is **not proof** they represent the three cards, so no such mapping is claimed. AUMID/title/owner inspection did not establish the source application for each card.

Therefore: the cards' containing Shell UI is identified, but the source window for **each of the three cards remains UNKNOWN / NOT VERIFIED**. A cached/persisted Shell entry is a hypothesis, not a confirmed cause. No undocumented Shell COM, Shell restart, window-style injection, owner reassignment, WorkerW, or process termination workaround was used. The boundary was reached without speculative product changes.

## Widget contract and scope correction

Workspace launch is already in UX-07C, not deferred to UX-07D: PaletteApp.tsx:66-68 maps existing safe TD2 actions to electronPalette.openWorkspace; preload/main validate and show/focus Workspace. The home handoff explicitly requires native widget-action restoration of Workspace. UX-07D defers Desktop-first startup and later scope, not this implemented callback.

CalendarWidget.tsx attaches the action only to its20x20 date-number button, not the cell body. R3 corrected the prior out-of-button click and observed trusted native button events plus Workspace show. That prior mismatch is not a product regression. No additional widget action, schema, or data contract was introduced.

## Changes and verification

Product code changes: **none**. No defect attributable to this Palette was reproduced. No window options, Dock, Workspace startup,7 modules, storage, or security boundaries were changed.

- Actual native Alt+Tab checks: seven states completed as above.
- Taskbar group, widget button, transparent click-through: prior PASS reused, not repeated.
- Focused16 tests and same-product TypeScript/production build: historical PASS reused; no code/test edits, therefore NOT RERUN per scope.
- Full regression/Portable build/workflow: NOT RUN, not required here.
- git diff --check: required before report-only commit.
- Product and observer were closed through their normal complete-quit/window-close lifecycle. Exact QA Electron executable process count after closure:0. No force kill. Synthetic profiles and evidence remain for diagnosis; other projects/processes were preserved.

## Evidence, remote preservation, and remaining gate

Private/local evidence: E:/BOGUNON_DEV/qa-output/UX07C_R4_20261112. Includes seven state captures/inventories, states.json, product-style-comparison.json, product-launch.json, all-top-level metadata, supported UIA/MSAA results, observer/probe source, journal, and manifest SHA-256 inventory. Personal window titles are omitted in the all-window saved metadata; raw local evidence is not a public upload package.

Only this non-sensitive Markdown is committed/pushed. Secret-pattern/manual review is best effort; no dedicated secret scanner was installed. Git sync does not transfer the local evidence. Full cross-PC original-evidence review therefore remains BLOCKED without approved secure transfer, independently of the source checkpoint.

Final docs commit SHA is discoverable via git log -1 -- docs/UX07C_R4_ALTTAB_FINAL_20261112.md; source/build SHA remains a96e720 as documented. Normal remote HEAD equality/divergence0/0/clean state are verified after push. No main merge or UX-07D work.

The only unresolved R4 identification is the provenance of the three pre-existing Shell cards. Without a supported per-item HWND observation, do not change product policy or promote the overall result beyond the requested CONDITIONAL verdict. UX-07D remains on hold.
