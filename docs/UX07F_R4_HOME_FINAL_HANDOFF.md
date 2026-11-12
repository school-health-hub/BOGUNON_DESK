# UX-07F-R4 home final handoff

Status: **CONDITIONAL WIP**. Native Purchase CSV save and cancellation are newly verified; SCHOOL populated Mock and Official ODT save remain NOT RUN. UX-07E remains CONDITIONAL. No product code changed.

## Starting Git and runtime

Repository school-health-hub/BOGUNON_DESK (PUBLIC), branch codex/electron-h6-design-renewal. Starting HEAD and live remote: 1e05188103f00e7aed67483941abe14bc45ed39b; upstream matched, divergence 0/0, clean, no ongoing Git operation. Existing worktrees and prior evidence preserved.

Actual Windows Electron runtime source: **b8b0f4647ead1639482913094b0d836a050423cc**, verified through the existing built app info, not inferred from report HEAD. No rebuild or Portable packaging. Electron 45.2.1 / Chromium 156. UUID-isolated synthetic E: QA profile; only Codex present before QA. No personal/operational profile used. TEMP/TMP were process-local on E:, no system settings changed. Workspace outer size 1200x800; display settings unchanged.

## SCHOOL Mock boundary

No approved standalone populated no-DB Windows product Mock route was found. WorkspaceProductHost passes electronWorkspace; ProductWorkspace creates the real client/store only for connected status. Existing SCHOOL05 QA provider uses SQL-backed session execution and a dedicated PostgreSQL harness. build/school05-qa/provider.mjs is absent here. Unit mocks cover auth/disconnected/error boundaries, not a complete connected runtime fixture. No new provider, authentication bypass, DB, Docker or operating account was introduced.

Populated list/detail, long text, status, search/filter, populated empty/error/permission states, narrow scrolling and keyboard focus: **NOT RUN** in actual SCHOOL GUI. Required next condition: existing approved synthetic SCHOOL05 provider and isolated fixture environment, or a separately approved no-DB runtime test route. No actual MFA/authentication run.

## Official ODT

Approved synthetic original exists: tools/official-document-cli/tests/fixtures/synthetic-document.odt, 400 bytes, SHA-256 5E0A1B54AA2ECD6F3267E078EB52E234568697B6DFBE5C149B07D8F1586D1D6D. Its provenance is recorded by the existing fixture materials; read-only hash remains unchanged.

The missing prerequisite is tools/official-document-cli/target/debug/official-document-cli.exe. Actual original selection, title/body injection, native ODT save, output validation and failure retention: **NOT RUN**. No Rust install/build or borrowed binary; no operational document selected. Absence of an approved original is not the cause.

## Real native save: PASS for tested CSV path

Used the unchanged Purchase Helper with two synthetic rows (quantities 2 and 4, unit prices 12345 and 24690; amounts 24690 and 98760, total 123450). Existing output-format acceptance was reused; this run targeted the missing native end-to-end boundary.

1. Product CSV save opened the real confirmation, then Windows Save As (구매 품목 출력 저장). No dialog stubs or replacement destinations were installed.
2. Filename keyboard focus was proven by actual native screenshot selection. UIA focused_element was stale and was not trusted alone. Keyboard entry selected a new isolated E: QA output path, visually verified before Return.
3. Actual native save created outputs/native-purchase.csv: **232 bytes**, UTF-8 BOM, two expected records and amounts; SHA-256 **eb85e637cfdf0c46ca21bc84df1f05d1c26d2d5447b7790939dc15c6ac0fa43b**. Product completion: CSV 파일을 저장했습니다: native-purchase.csv. Destination did not exist before save.
4. A second real Save As was cancelled with Escape. All 16 captured row input label/value pairs matched before/after, only the original CSV existed in the output folder, and its hash stayed unchanged. Cancellation did not erase the draft. This is not a claim about every output format or forced filesystem-error path.

UIA index/coordinate attempts that were rejected by automation were method limitations, not product defects. No unverified click was redirected to another app. Native dialog crop contains machine-local navigation labels and remains private.

## Evidence, tests and cleanup

Local originals: **E:/BOGUNON_DEV/qa-output/UX07F_R4_20261112**. runtime-provenance.json, runtime-results.json, native-hypotheses.json; native-save-complete.png, native-cancel-dialog.jpg, native-cancel-preserved.png; outputs/native-purchase.csv; cleanup.json and evidence-manifest.json. Native dialog screenshot is private local evidence; renderer captures are actual Windows Electron, not browser substitutes.

No product change or new visual defect; no repeat of 110/51/24 tests or old captures, TypeScript/build and prior acceptance reused. git diff --check performed for this report. Prior 48 + 24 + R2/R3 evidence untouched. Current QA app and harness closed normally; matching worktree Electron processes **0**. No other process terminated, no profile/evidence deleted.

## Remaining acceptance and receiving-PC checklist

- SCHOOL populated Mock actual Windows GUI: NOT RUN, prerequisite above.
- Official ODT save: NOT RUN, approved synthetic fixture present; native CLI prerequisite above.
- Operating SCHOOL login/MFA and Finance data: excluded, not run.
- Different/small physical display, UX-07E actual 2+ monitors, cable disconnect/reconnect and mixed DPI: school-PC only, NOT RUN; no repeated attempts at home.
- Other native formats/error scenarios: only prior format/output evidence, no blanket native-picker PASS.

UX-07F home native-save scope is PASS; **UX-07F overall CONDITIONAL** because required actual-screen coverage remains unavailable. UX-07E CONDITIONAL unchanged. Full integration QA, main merge, deployment not started; outstanding acceptance must be resolved before full approval.

## Git preservation and full handoff boundary

Only this non-sensitive report is intended for public Git. No raw captures, profiles, generated CSV, tokens or local runtime bundles are committed. Best-effort pattern/manual review of intended report and local text evidence; no exhaustive secret-scanner assurance. No confidential transfer authorized.

Final report commit is the commit containing this document (git log -1 -- docs/UX07F_R4_HOME_FINAL_HANDOFF.md); post-push exact HEAD, remote match/divergence and clean state are recorded in local closure-git.json and the completion reply, avoiding a self-referential hash. Product source remains b8b0f4647ead1639482913094b0d836a050423cc.

**Git synchronization is separate from full handoff.** Source/instructions are remotely preserved after verified push; required raw QA evidence remains solely on this PC/E:. No fresh remote-only evidence restore can be claimed. Full cross-PC original-evidence review is **BLOCKED** until an approved secure online transfer of the manifest and transitively referenced originals is completed. Do not require carrying this drive or claim school PC was tested. A receiving PC can inspect remote code/report but cannot reproduce this original-evidence review from Git alone. Tool/device prerequisites must be checked there independently.

Two independent scoped visual reviews found no material issue in the new Electron save/cancel captures and independently matched the CSV. Both note that cancellation retains the previous success notice, so screenshots alone are not cancellation proof; row/file comparisons provide that evidence. Captures do not establish full table-row visibility beyond the viewport.
