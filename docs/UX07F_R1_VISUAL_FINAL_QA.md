# UX-07F-R1 — Windows visual/input closeout

Date: 2026-11-12 KST. Verdict: **CONDITIONAL WIP**. UX-07E remains independently CONDITIONAL; physical multi-monitor/hotplug/mixed-DPI acceptance is NOT RUN. Full integration QA and deployment were not started.

## Baseline and scope

- Branch: `codex/electron-h6-design-renewal`; starting local/remote HEAD `14d6b7ce4649aecfd4743c2c2c144ed046eaaf5a`, clean, divergence 0/0.
- Worktree: `E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-h6-design`.
- Existing F 110 focused tests and 48 accepted Windows images were reused, not rerun/recreated. See [original handoff](UX07F_DESIGN_RENEWAL_HANDOFF.md).
- Original UX-07A approval artwork is not present. Existing DESIGN.md and the confirmed navy/pastel/white Desktop-first principles remain the reference; no artwork was invented.
- Only Renderer presentation/input and related tests changed. Main, preload, monitor registry/lifecycle/profiles, TD2 v1/Dock v2 persistence, authentication, business logic, and output engines were not changed.

## Palette defect and supported-size distinction

Actual hardware: **one** 1920×1080 physical display, workArea **1920×1032 DIP**, scaleFactor 1, Electron 45.2.1 / Chromium 156. No Windows resolution/DPI setting was changed. The Palette is non-resizable and follows display workArea; Electron reported minimumSize 1920×1032 on this hardware. There is no newly invented universal minimum supported physical resolution.

Forcing its bounds to 1200×800 is below that current non-resizable minimum, but revealed a real renderer defect: viewport/grid geometry stayed at 1920 while the native viewport shrank. Nine measured cards extended outside the content bounds; Main correctly rejected hit regions, and the renderer replaced the widgets with a persistent error. This is not dismissed as a harmless QA-only issue because workArea changes also change native bounds. Physical display-change impact itself remains NOT VERIFIED.

Fixes:

1. Reactively recompute grid geometry on viewport width/height changes using existing viewport hooks.
2. Intersect measured input rectangles with the **current** visible CSS/DIP viewport; discard empty/non-finite rectangles. No physical-pixel conversion or Main validation relaxation.
3. A second real Electron repro alternated 1200×800 / 1920×1032 fifteen times at 10ms intervals: a resize between measurement and IPC handling still caused a sticky error. Publication generations now discard obsolete results; current failed publications remeasure and retry at most twice, 100ms apart. Cleanup cancels retry timers. Persistent failures remain fail-closed and do not announce readiness.

Actual Windows `sky` input, not DOM-dispatched events:

| Check | Result / limit |
|---|---|
| Normal 1920×1032 calendar button | PASS: trusted BUTTON click reached Palette; existing contract opened the single Workspace |
| Forced 1200×800 calendar button | PASS for input: trusted click and Workspace shown; no hit-region error |
| Forced 900×680 visible memo textarea | PASS for input/focus on first corrected candidate; no error; not physical small-monitor acceptance |
| Normal-size transparent gap | PASS: trusted click reached only an inert synthetic QA background window, not Palette or a personal app |
| Fifteen fast resize alternations, final product | PASS: same previously failing sequence, 12 visible widget cards restored, no alert; subsequent normal/1200 trusted clicks PASS |
| Forced small-size appearance | LIMITED: 1200 summary label wraps vertically; 900 clips summary/calendar/launcher content. These forced layouts are not visual acceptance of small physical displays |
| Physical small monitor / changed DPI / hotplug | NOT RUN; current one-monitor setup does not prove them |

The QA background was a separate inert, non-focusable, skip-taskbar window with no product capabilities. It is not a duplicate product Palette/Workspace.

## Proven additional visual defect

Populated Purchase output preview at outer window 900×680 showed the underlying fixed export toolbar painted across its bottom buttons. The toolbar has z-index 72 at short heights; its sibling preview had z-index 10. The underlying panel is inert, so DOM hit-testing alone misleadingly reported reachable preview buttons despite their visual obstruction.

Minimal Electron-specific CSS sets only the persistent Purchase output-preview backdrop to z-index 73. Real post-fix 900×680 and 1200×800 captures show `닫기` and `확인한 내용으로 출력` fully visible above the dimmed toolbar. The table retains intentional local horizontal scrolling. No file was exported and no output engine was modified.

## Newly populated work states

Outer Windows sizes differ from content viewport (900×680 → 884×615 with native chrome). These are real Electron page/native captures, not browser substitutes. Form actions used Playwright against the real Electron renderer; only Palette checks explicitly labeled native used Windows input.

| Module | New evidence / result | Remaining limit |
|---|---|---|
| Official Document | Synthetic long work title/body, local basic draft, editor fields and expanded saved-content preview; 1200 and 900 captures; scrolling reaches fields/actions. Existing unsaved-leave confirmation observed before explicitly discarding synthetic input | No ODT save, import, physical print, or rendered ODT/PDF layout acceptance |
| Purchase Helper | Three synthetic rows: quantities 2/4/6, unit prices 12,345/24,690/37,035, total 345,660 KRW; CSV preview has 3 rows/7 columns. Proven modal overlap fixed at 900/1200 | Actual CSV/XLSX/PDF generation/print NOT RUN; rightmost table columns use local scroll |
| Education Video Finder | Existing `fixtures/finder-v2/electron-v1.json` imported into isolated profile, two records, first loaded, synthetic long education name and memo edited. Filled controls/save/unchecked-copy state readable at 900 | No YouTube/API/AI request or playback. Textareas have internal scroll; one capture shows partially scrolled first memo line, not full text-at-once acceptance |
| Inventory | Existing model's three synthetic items/four lots seeded through real Workspace bridge in isolated QA store; shortage/expiring/expired badges and selected-item detail. Invalid use of 999 units shows insufficient-stock notice; final dedicated capture makes the notice visible | No successful stock movement/export. Rejected operation leaves balances 8/2/8/9 and movement count 0 |
| MY FINANCE | Real isolated QA SQLCipher/DPAPI store, synthetic payer and 234,567 KRW, confirmation and saved non-sensitive list/summary readable at 900 | No operational Finance data, backup/restore, real account, cross-PC recovery or new dirty/busy acceptance claim |
| Newsletter | Existing synthetic B JSON opened; populated title/body editor, Revision 3 controls; unresolved `synthetic-bg` produces visible asset-validation failure and disabled output | This fixture does **not** prove approved-asset rendering, successful canvas/PDF/PNG output, or a pending-approval-specific case. Actual busy-output native flow NOT RUN |
| SCHOOL WORKSPACE | Existing CLOSED/unconnected boundary retained | Populated Mock list/detail NOT RUN: no existing approved no-DB Electron mock path found. Did not start DB, bypass the gate, invent authentication or use live records |

### Error/output coverage

Verified: real Inventory input error notice and unchanged stock; Official unsaved-leave confirmation; Newsletter invalid-asset output-disabled boundary; populated Purchase output preview and its buttons. Prior F empty/unavailable states and focused guard evidence remain historical evidence.

NOT RUN: induced disk/save failure, all modules' exhaustive error states, actual ODT/PDF processing/printing, successful Newsletter export and actual busy-close GUI, SCHOOL populated authorization states. No operating file/store was damaged to manufacture a failure. Therefore neither seven-module completion nor normal-output success is claimed.

## Product files, commits and checks

- `electron-p0/renderer/palette/PaletteApp.tsx`
- `electron-p0/renderer/palette/hitRegions.ts`
- `electron-p0/tests/palette-hit-regions.test.ts`
- `electron-p0/tests/palette-resize-input.test.tsx`
- `electron-p0/renderer/purchase/source.css`

Product checkpoints:

- `81b5d422d5f0532bab15810d856450328d959ec1`: viewport and clipping WIP, initial filled-state runtime.
- `c6edab6c00ec452355a37d5e82e7f554f592fcee`: Purchase layering; its actual runtime supplied the two GREEN Purchase screenshots, and the rapid-resize RED repro.
- **Final product Source SHA `8f3e5604e1aa89c2f99fa19224f7bcba607ca706`**: bounded publication retry. Build metadata `dirty:false`; actual `electronP0.info()` matched. Final native clicks/burst/Inventory error capture use this source.

Checks (overlapping runs are not added together):

- Initial resize regression RED; clipping helper RED → 19 PASS (included in later runs).
- Initial input-focused six files: 44 PASS.
- Async/burst regression RED: transient rejection permanently destroyed widgets.
- **Final input-focused six files: 47 PASS**, including transient recovery, persistent fail-closed and obsolete rejection regressions.
- **Purchase output-focused two files: 4 PASS**; UI layer fix additionally verified in actual Electron at both sizes.
- TypeScript Main/Renderer/tests and Electron production build PASS at final product SHA; `git diff --check` PASS.
- Independent source/security review found no remaining blocker after retry fix; two independent visual reviews confirmed GREEN Purchase layering and explicitly retained forced-small-layout/partial-capture limits. Earlier review correctly flagged the race and missing visible Inventory error; both were addressed with repro/fix or a dedicated final capture.
- No full 110-test rerun, full module regression, Rust build or Portable packaging.

## Evidence, privacy and cleanup

New local originals: **`E:/BOGUNON_DEV/qa-output/UX07F_R1_20261112`**. `evidence-manifest.json` inventories files, byte sizes, timestamps and SHA-256. Candidate provenance is separate: `runtime-provenance.json` = 81b5d42, `runtime-provenance-c6edab6.json` = c6edab6, `runtime-provenance-final.json` = 8f3e560. Initial RED files remain preserved; they are not GREEN evidence. In particular, `purchase-filled-preview-900-settled.png` is RED, and the initial JSON's empty `purchaseModalButtons` array is not button proof.

Final input evidence: `palette-final-native-results.json`, `palette-final-burst-normal-native.png`, `palette-final-1200-native.png`. Purchase GREEN: `purchase-filled-preview-{900,1200}-green-c6edab6.png`. Dedicated visible Inventory error: `inventory-error-message-visible-final.png`; the earlier form-only error capture did not show the notice. `palette-burst-red.json` records the later failing sequence; its attempted PNG capture timed out and is not claimed as evidence.

QA appData/session/stores/temp were isolated under an E: UUID profile recorded in local provenance. Only synthetic data and existing approved synthetic fixtures were used. No operational DB/OAuth/MFA, original Finance store, personal/student data, existing user JSON, external monitor settings or other worktrees were changed. No other app was forcibly closed.

All QA Electron runs closed normally; `cleanup.json` records **0** matching QA Electron processes. Synthetic profile/evidence remains preserved, not deleted. Taskbar/Alt+Tab exclusions and prior Finance/Newsletter guard evidence are reused; no new broad Shell/guard PASS is claimed. Previously existing blank Alt+Tab items remain a separate nonblocking UNKNOWN-origin issue.

Public origin/upstream verified before normal push. Intended source/test/doc changes receive best-effort pattern/manual secret review; gitleaks/trufflehog are not installed. No QA screenshots/logs/profile data are staged or uploaded. This is not a certified exhaustive secret scan.

## Final state and next boundary

UX-07F remains **CONDITIONAL WIP** because SCHOOL filled states, successful approved-output states and small physical-display acceptance are incomplete. The reproduced input and modal-layer defects are fixed with focused/runtime evidence; no new P0/P1 defect was observed within the tested current-display scope.

The report commit containing this document is the final Git HEAD (`git log -1 --format=%H -- docs/UX07F_R1_VISUAL_FINAL_QA.md`); exact post-push HEAD/divergence/clean status is recorded in the final response and local `closure-git.json`. Product Source remains the separate SHA above.

Source/tests/document are preserved by normal push to the same branch. Raw screenshots/logs remain local-only on E: and are not a verified remote evidence handoff; Git synchronization does not mean HANDOFF READY on another PC. Reproduce focused checks with Node 24.15.0 and the lockfile using `node node_modules/vitest/vitest.mjs run electron-p0/tests/palette-resize-input.test.tsx electron-p0/tests/palette-hit-regions.test.ts electron-p0/tests/palette-projection.test.tsx electron-p0/tests/palette-dock.test.tsx electron-p0/tests/desktop-palette-window.test.ts electron-p0/tests/palette-registry.test.ts --no-file-parallelism --maxWorkers=1`, then `npm run electron:p0:build` in a safe independent environment; never substitute a default user profile for QA.

Full integration QA is **not started / not accepted as ready** from this limited result. Remaining work requires an approved existing SCHOOL Mock environment and safe approved-asset/output fixtures, plus separate school-PC UX-07E physical multi-monitor QA. No next feature, main merge or deployment was begun.
