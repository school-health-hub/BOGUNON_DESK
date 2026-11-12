# UX-07F-R2 — Home Windows residual visual QA

2026-11-12 KST. **UX-07F: CONDITIONAL.** UX-07E remains independently CONDITIONAL. No full integration QA, merge or deployment was started.

## Source and preserved evidence

- Branch `codex/electron-h6-design-renewal`.
- Starting full HEAD and live remote: `8702ea5c63f4a1e9eb75d25874f7cb2270f0385a`; divergence 0/0, clean.
- Actual Electron product Source: **`8f3e5604e1aa89c2f99fa19224f7bcba607ca706`**, matching the existing clean build metadata and runtime `electronP0.info()`.
- No product code changed. This report is the only repository change. R1's 47 input tests + 4 Purchase tests, TypeScript and production build were reused; no test/build rerun was needed.
- Original F 48 captures and R1 24 captures were preserved. Palette input, click-through and Purchase preview-button checks were not repeated.
- Worktree: `E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-h6-design`.
- R2 local originals: **`E:/BOGUNON_DEV/qa-output/UX07F_R2_20261112`**. New visual review set: 9 actual Electron renderer/element captures and 8 rendered PDF pages, all 17 independently inspected by two reviewers.

## SCHOOL Mock availability and results

The current product gate reports `mode:disabled`, `connected:false`, generation 0. It stayed CLOSED; no runtime authentication, MFA, DB or permission substitution was introduced.

Existing approved Windows QA entry points were checked rather than creating a replacement mock:

- `electron-p0/main/main.mts` loads an optional external `../school05-qa/provider.mjs` only under the isolated synthetic gate. That artifact is absent in this build environment.
- `school-workspace/school05/server/provider.ts` delegates to the existing SQL-backed sessions; `local-db.ts` uses the dedicated PostgreSQL/Docker fixture. `scripts/qa/td2-workspace-gui.mjs` explicitly calls it an isolated PostgreSQL-backed fixture, not an in-memory mock.
- The H1 Windows fixture also declares native PostgreSQL plus simulated HTTP/JWT, not an independent no-DB product screen.
- No running PostgreSQL process or existing usable standalone no-DB product mock was found. No DB/container/provider was started or rebuilt. Existing Vitest component mocks were not presented as Windows GUI evidence.

| Requested SCHOOL state | Result |
|---|---|
| Populated list | NOT RUN — approved runtime provider unavailable |
| Detail and long text | NOT RUN |
| Status, filter/search | NOT RUN |
| Empty state | NOT RUN for connected Mock; prior disconnected boundary evidence reused only |
| Error / permission restriction | NOT RUN for connected Mock; CLOSED is not an authorization-test substitute |
| Small-window scroll | NOT RUN for populated Mock |

No operational connection was used to replace missing QA coverage.

## Normal output paths

### Newsletter

Reused **`approvedSyntheticB()`** and `syntheticImage` from `electron-p0/tests/newsletter-b-fixture.ts`, already used by the existing B integration tests. Materialization under the R2 evidence folder reused the factory without changing its source, original pending fixture, mascot approval or asset registry. The tiny test image and QA placeholders are synthetic and are not real artwork approval.

The real Electron editor opened this document, connected the exact image bytes by SHA-256, showed `출력 가능` and reported no Scene overflow/missing-text collision. At outer 900×680 (content 884×615), the output selector/button, modal busy lock, cancel and success messages remained visible.

Native path distinction:

- Actual Windows output approval dialog was reached and accepted.
- Native Save As automation could not set/click the filename field because of UIA/window-target validation. It was cancelled with Escape; the app displayed `출력 저장을 취소했습니다.` No native save was completed. **Native file-picker completion: NOT RUN.** No repeated attempts or security-policy changes.
- Subsequently reused the **existing `electron-p0/e2e/newsletter.e2e.ts` dialog-scoped QA strategy**: in this isolated process only, confirmation and destination selection return known new R2 output paths. Rasterizer, font loading, owned export window, authority validation, PDF composer, file-writing and Renderer success UI were real and unchanged. These exports are not proof of native-dialog automation.

| Format | Actual file result | Visual result |
|---|---|---|
| A4 PNG | PASS, 2480×3508 | Same complete synthetic A4 composition; no clipping observed |
| A4 PDF | PASS, one A4 page, about 595.28×841.89 pt | PASS for this synthetic page: six readable sections, footer intact |
| Card PDF | PASS file generation, 7 pages at 432×432 pt | **PARTIAL / P2**, see below; not all-card visual PASS |
| Card PNG bundle | PASS, one new bundle, 7 files at 1800×1800 | Same fixture-layout limitation; no full publication-quality claim |

All four UI operations returned `출력물을 저장했습니다.` Files and page/dimension checks are recorded in `r2-results.json` with SHA-256. Actual printing was NOT RUN.

**Remaining P2 visual limitation:** card PDF pages 3–7 (topics 2–6) show seasonal-decoration QA art overlapping the topic title/date band. Existing fixture/profile geometry places title at y130..280 and decoration at y64..184: a 54-design-unit overlap. Both independent reviewers confirmed it. This is authored in the existing input profile, not evidence of a newly introduced CSS or output-engine regression. Body text remains readable, but the five pages are not visually clean. No engine or fixture rewrite was used to hide the result. Minimum follow-up is to review/correct the approved profile's decoration/title spacing in its owning layout scope, then recheck affected pages; engine changes are not justified by this evidence.

The cover intentionally shows selected topic indices `[0,1,2,5]` with a four-topic preview. Omission of topics 4/5 there is not output data loss. White areas associated with the one-pixel synthetic image do not establish missing production artwork.

PDFs were rendered read-only with existing Poppler. Its Windows installation emitted nameToUnicode lookup warnings for Bulgarian/Greek/Thai under the non-ASCII user path; all eight page PNGs were generated and their Korean output was visually inspected. No renderer installation or PDF conversion code change.

### Official Document

- Existing local basic-draft flow, synthetic long title/body/attachment; expanded saved-content preview at 900×680 and full preview-element capture.
- PASS for tested preview: Korean text wraps, body/attachment reachable through scroll, no page-level horizontal overflow. Unsaved-leave confirmation was observed before explicitly discarding only this synthetic draft.
- Existing approved ODT/PDF/HWPX fixtures and provenance are present, but the development executable expected at `tools/official-document-cli/target/debug/official-document-cli.exe` is absent. **Actual ODT save/import/output: NOT RUN**. No Rust build, substitute converter or engine change was attempted. A readable text preview is not proof of rendered ODT pagination.

### Purchase Helper

- R1 normal three-row preview and fixed modal-button evidence reused.
- New scope: real CSV generation/storage through the existing QA dialog-selection pattern, using the same three synthetic items (2/4/6 units, 12,345/24,690/37,035 KRW).
- PASS: success notice visible at 900×680, UTF-8 BOM present, three data rows, expected line amounts 24,690 / 98,760 / 222,210, 431-byte new CSV. UI total remains 345,660 KRW.
- XLSX/PDF/physical print and native-picker completion were not newly verified. Intentional table-local horizontal scrolling is retained.

R1 invalid-asset/error evidence is reused. R2 additionally verifies safe output cancellation and normal-success states; it does not induce disk failure or alter user files to manufacture errors.

## Environment, security and cleanup

- Actual home Windows Electron on the existing single physical display. No display settings, DPI, cables or other programs were changed.
- New UUID-isolated E: QA profile/appData/session/stores; provenance recorded locally. No default user profile, Finance data, SCHOOL credentials or operating documents used.
- First launch failed because the newly selected QA root did not yet exist. After creating only that dedicated root, a cached automation connection timed out; no QA processes remained. Resetting the automation kernel allowed normal launch. These are harness/environment events, not a product-fix claim.
- Native dialog screenshots that included an unrelated Codex surface were not saved as evidence. Only synthetic Renderer/output captures are retained. No personal/operating window received an automated click.
- Temporary runtime dialog replacements were restored before normal application exit. Final matching QA Electron process count **0**, recorded in `cleanup.json`; no force termination. Existing profiles and all evidence are preserved.
- No products, dependencies, lockfiles, output engines, monitor lifecycle, TD2/Dock formats, security gates or authentication contracts changed.
- Public repository preservation is limited to this non-sensitive report. Best-effort staged/text secret-pattern and manual review; no installed gitleaks/trufflehog, so no exhaustive scan claim. Raw images, generated documents, scripts, environment/provenance and profile data remain local-only and are not staged/uploaded.

## Final Git state and school-only checklist

Normal report commit/push to the same branch only. The final report HEAD is the commit containing this file (`git log -1 --format=%H -- docs/UX07F_R2_FINAL_HANDOFF.md`); exact post-push HEAD, remote equality, divergence and clean state are recorded in the final response and local `closure-git.json`. Product Source remains **8f3e5604e1aa89c2f99fa19224f7bcba607ca706**.

Home-PC achievable output-state checks are now recorded separately from unavailable SCHOOL/ODT paths and school hardware. **UX-07F remains CONDITIONAL**, not an all-output visual PASS. No new P0/P1 defect was observed in the executed scope; the P2 card-profile overlap remains explicit.

School-PC-only QA, not retried here:

1. UX-07E physical 2+ monitors: one Palette per screen, independent input/layout restoration, actual disconnect/reconnect and dormant profiles, Workspace/Settings singleton/accessibility, taskbar/Alt+Tab exclusion.
2. Actual mixed DPI and school display workArea/resolution checks with permission before settings/cable changes; do not label simulated tests physical PASS.
3. UX-07F Palette/Dock/Workspace/Settings appearance on the school's other physical display, preserving user data and QA isolation.

Separate non-hardware follow-up: existing approved SCHOOL QA provider/environment, Official native CLI, native picker completion and the five card-profile pages. No new QA stage/project or production connection is authorized by this checklist.

Git synchronization is **not full HANDOFF READY**: raw R2 evidence/output originals remain on E: and have no verified approved online transfer. The source/report can be obtained remotely; original-evidence review on another PC remains unavailable until a separately approved secure transfer. Full integration QA, main merge and deployment remain unstarted.
