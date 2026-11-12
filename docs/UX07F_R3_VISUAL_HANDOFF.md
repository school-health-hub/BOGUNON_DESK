# UX-07F-R3 — Topic-card P2 closeout

2026-11-12 KST. **Card-header correction / tested design scope: PASS. UX-07F overall: CONDITIONAL. UX-07E: independently CONDITIONAL.** This does not authorize integration QA, production installation or deployment.

## Git and product provenance

- Repository `school-health-hub/BOGUNON_DESK`, branch `codex/electron-h6-design-renewal`.
- Starting full local/live remote HEAD: `4f022719cc9c045bfea478c3652a1a3767945409`, clean, divergence 0/0.
- Worktree: `E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-h6-design`.
- New product Source **`b8b0f4647ead1639482913094b0d836a050423cc`**. Production build metadata `dirty:false` and actual Electron `electronP0.info()` match this exact SHA.
- Final report HEAD is the commit containing this document (`git log -1 --format=%H -- docs/UX07F_R3_VISUAL_HANDOFF.md`). Exact post-push HEAD/remote equality/0/0/clean result is recorded in the final response and local `closure-git.json`; it is distinct from product Source.

## Cause: product default, carried faithfully by fixture

R2's five affected pages are card PDF pages 3–7, topics 2–6. The fixture did not invent the erroneous coordinates: `approvedSyntheticB()` calls the product V1→V2 converter, then applies official templates only to the cover and first topic. The five remaining cards therefore expose product-generated defaults.

The old title frame `(72,130,1056,150)` and seasonal-decoration frame `(72,64,220,120)` overlap by **54 design units** vertically. The same defaults exist before UX-07F at `f541a11592e511acb1821c72b6957ac7a5653ff8`; history locates their introduction at `ac31d15cfd49820925776f2b1fd0a0a46200bab4` (2026-11-01). This is a real, pre-existing product layout-data defect, not a new UX-07F CSS regression or a fixture-only error.

Evidence separates the alternatives:

- Short titles already overlap, so long-title wrapping is not the original cause.
- The same placement is visible in Electron preview, real PNG and PDF output, so it is not solely image generation, PDF conversion or one display/DPI scale.
- The design is a 1200×1200 square; output remains 1800×1800 PNG / 432×432 pt PDF. No aspect-ratio or output-size workaround.
- Loading the original R2 V2 JSON in the new product still showed the old overlap at Revision 4. Applying the explicit existing layout action removed it. There is no silent import migration.

## Minimal correction

Changed product files:

1. `src/newsletter/rendering/cardHeaderLayout.ts`: shared default `(908,60,220,54)` and narrowly recognized legacy header.
2. `src/newsletter/rendering/designState.ts`: use that default for new topic layouts; repair the old default during the existing explicit `applyCardLayoutVariant` action.
3. `src/newsletter/rendering/cardHeaderLayout.test.ts`: safety, compatibility and revision regressions.

The new decoration stays inside the existing safe area `(60,60)..(1140,1140)`, ends at y114 and leaves **16 units** before title y130. Its x position is separate from the date badge ending at x508. Existing `contain` fit preserves the artwork's aspect ratio; no PNG bytes, character, asset ID, approval or image source changed.

Legacy repair occurs **only** when all conditions match: non-cover topic; no official-template/editorial owner; exact old title frame; exact old decoration frame. Only the decoration frame is added to the existing layout patch. Custom title/decorations are left alone. Existing parser behavior, file read, schema, canonical body and output engine remain unchanged.

For an old affected document: open **카드뉴스 7장**, select each affected topic, then explicitly select the existing **레이아웃 variant → 균형형** option. Like any existing layout selection, this applies that preset and appends a revision; inspect the preview and save a separate reviewed file. It is not automatic recovery for arbitrary customized layouts. Restoring an old revision intentionally restores its original coordinates.

## Actual Windows / output verification

Real Windows Electron 45.2.1 / Chromium 156, existing single-display environment; fresh UUID-isolated E: QA appData/session/stores. Only Codex was open before launch. No personal/operational data, Finance, SCHOOL login, DB or external service was used.

The actual product opened the **unchanged R2 approved synthetic JSON and exact image**, starting at Revision 4. Five normal UI layout selections produced revisions 5→9. A real dialog-scoped JSON save captured the repaired document for structural comparison:

- Project/body, A4 layout, assets, cover and first-topic layouts unchanged.
- All previous revision entries unchanged; original R2 file hash still matches its preserved R2 manifest.
- All five selected decoration frames now `(908,60,220,54)`; title frames stay unchanged.

| Check | Result |
|---|---|
| Affected five cards | PASS: new actual PNG and rendered PDF pages show title/date/decorations separated |
| Card size / counts | PASS: 7 PNG files at 1800×1800 and PDF 7 pages at 432×432 pt |
| Adjacent cover + first topic | PASS: newly exported PNG bytes and decoded pixels are **identical** to R2 originals |
| Two-line Korean title | PASS for tested case: topic 4 uses synthetic `합성 보건교육 실천 안내`, custom title width 400 / height 150; actual preview has two lines at baselines y186 and y256, with decoration ending y114. Actual PNG and PDF page 5 show no interference |
| Older/custom documents | PASS focused tests: no parse-time rewrite, custom geometry/composition owners retained, old revisions restorable |
| Native save-dialog completion | NOT RUN; existing R2 limitation preserved |
| Physical printing / other displays | NOT RUN |

The first title-width experiment at 600 fitted one line (measured text width about 522). Its files are retained as **intermediate**, not evidence of two-line support. Acceptance is explicitly `two-line-verified-*` at width 400. This is a bounded two-line case, not a claim that arbitrary-length text always fits.

Output uses the unchanged real font/Canvas/owned export worker/authority/PDF/storage path. Only native confirmation and file destinations use the already-existing E2E dialog-scoped QA strategy, targeting new R3 files. No native picker PASS is claimed. No Official/Purchase/A4 output acceptance was repeated; the existing engine internally prepares its normal bundle, but only card outputs were saved/assessed here.

## Tests and evidence

- RED: new header tests fail for the actual old intersection and missing explicit legacy repair (2 failed / 2 passed).
- GREEN: **5 focused files / 24 tests PASS** — header, design-state revisions, schema, RenderScene and adjacent Newsletter B UI. This is not a rerun of the previous broad suites.
- TypeScript Main/Renderer/tests and Electron production build PASS. `git diff --check` PASS.
- Scoped independent source review found no blocker and confirmed clip bounds, custom-layout exclusion and history preservation.
- Two independent visual passes both **PASS**, opening the explicit packet: 2 before references, 8 after PDF renders, 6 after PNG files, 2 after preview images (18 images). Scope is this correction, not seven-module or entire publication approval.

Local originals: **`E:/BOGUNON_DEV/qa-output/UX07F_R3_20261112`**. `visual-packet.json` enumerates acceptance images. Before evidence reuses R2 `pdf-render/cards-3.png` and new `legacy-before-preview.png`; after pages are `pdf-render/cards-3.png` through `cards-7.png`. Two-line acceptance is `pdf-render/two-line-verified-5.png` plus its real PNG. `runtime-results.json`, `preservation-checks.json`, `output-checks.json` and `two-line-verified.json` record provenance and checks. `evidence-manifest.json` recursively inventories byte sizes, timestamps and SHA-256; referenced R2 bytes remain at their existing paths.

Existing 48 + 24 + R2 evidence is preserved, not regenerated. QA dialog replacements were restored, app quit normally, final matching QA Electron processes **0** (`cleanup.json`). No other process was terminated; no profile/evidence deletion.

Public Git preservation contains only the three scoped source/test files and this report. Best-effort pattern/manual secret review; no installed gitleaks/trufflehog, so no exhaustive security-scan claim. Raw synthetic outputs/profiles/logs remain local, not uploaded. Source/report sync does not equal a complete remote raw-evidence handoff.

## Remaining NOT RUN: distinct causes and school checklist

| Item | Cause / next safe boundary |
|---|---|
| SCHOOL populated Mock list/detail/search/error/permission | R2 investigation reused: approved Windows provider is external and SQL-backed; no standalone no-DB product mock located. `build/school05-qa/provider.mjs` still absent; current status disabled/disconnected. No operational replacement or new provider/DB started |
| Official ODT save | Approved synthetic originals **exist** with provenance; the missing prerequisite is `tools/official-document-cli/target/debug/official-document-cli.exe`, not lack of a real user document. No build/install/import/save attempt in R3 |
| Native file save completion | R2 reached native approval but filename automation was blocked by UIA/window-target validation and safely cancelled. QA-destination stub outputs are distinct; no repeated native retry here |
| Small/other physical display | Not available/tested here; no Windows resolution/DPI setting change or unsupported forced-size PASS |
| UX-07E physical multi-monitor | School-PC QA pending; CONDITIONAL unchanged |

School PC: obtain this branch/source and independent synthetic profile; verify actual 2+ monitor Palette/input/profile restoration, permitted cable disconnect/reconnect, actual mixed DPI, accessible singleton Workspace/Settings, Shell exclusions and UX-07F appearance on the school's other physical display. Do not use real work data or change display settings without approval. SCHOOL/ODT/native-picker prerequisites are separate from hardware checks.

**Final boundary:** the five-page P2 and its bounded title/header design acceptance are PASS; **UX-07F overall remains CONDITIONAL** because required broader actual-screen/Mock/native-output coverage remains NOT RUN. UX-07E remains CONDITIONAL. Full integration QA, main merge and production deployment were not started. Another-PC original-evidence review still requires an approved secure transfer of the local R2/R3 evidence; no HANDOFF READY claim is made from Git alone.
