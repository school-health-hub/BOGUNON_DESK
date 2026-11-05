# Instructor 02 focused Actions QA — 2026-11-05

Product: `002a095f238a505b284f3af4f8a46ca101207411`.
QA controller branch: `codex/instructor02-actions-qa` (separate from product/integration/main).
Existing workflow reused: `.github/workflows/electron-cloud-g0.yml`; no new workflow file, Portable, product changes, production secrets, or deployment.

## Authoritative evidence

- [Linux run 41996385475](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41996385475): job `instructor02-db` PASS; the separate Windows job in this run failed in the QA controller.
  [Artifact `Instructor02-linux-db-41996385475`](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41996385475/artifacts/13400895831) contains **fresh** 68/68 passing tests in 14 files, clean schema application, `network:none` / no port binding, and owned-container cleanup.
  Seven tests use actual PostgreSQL (five Instructor and two SCHOOL-05 DB tests); remaining tests include contract/unit/mock coverage, not actual GUI proof. Synthetic Auth is used, not Hosted Supabase.
- [Windows run 41997383342](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41997383342): job SUCCESS; fixed product checkout plus QA controller `9f71054`. **14 automated checks PASS does not override the visual FAIL below.**
  [Artifact `Instructor02-windows-output-41997383342`](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41997383342/artifacts/13401027183): 12 actual Electron captures, 3 synthetic stamp input images, 5 actual Chromium PDFs (6 pages total), one XLSX, result/runtime/database/cleanup metadata. Electron 45.2.1.
- Artifacts are retained for 30 days. Original artifact bytes are authoritative; locally rendered PDF PNGs are derived review material.

## Attempts and limitations

- Run `41996001430`: Linux script prerequisite `rg` missing, tests **NOT RUN**. Its uploaded `new-tests.*` were pre-existing tracked baseline evidence; **do not count them as current results**. Windows onboarding intercepted the menu click. Owned resources cleaned up.
- Run `41996385475`: Linux 68/68 PASS. Windows QA profile string comparison failed on mixed path separators; app/provider started, but later checks NOT RUN.
- Run `41996708454`: actual Windows registration succeeded and showed the dashboard; QA incorrectly expected the registration form to stay open. Later checks NOT RUN.
- Run `41997302426`: canceled owned QA run to incorporate independent controller review; owned DB/process cleanup step passed. Not a completed QA result.
- Corrections were QA-only: prerequisite setup, onboarding dismissal, canonical profile path comparison, reopening Settings, inert-modal status observation, per-row stamp counts, builtin file writes in Electron evaluation, and strict role-denial assertions. Product source is unchanged.

## Scope and classification

- Linux: existing SCHOOL-05 runner creates a digest-pinned PostgreSQL container with `network:none`, tmpfs data, no host ports; removes only its owned container ID via trap.
- Windows: actual unpackaged Electron on a hosted Windows runner, using the existing native PostgreSQL helper on a random loopback port. This is not local-PC Docker, Hosted Auth, production, or a Portable package test.
- QA profile/data/temp stay under the hosted runner's dedicated temporary root. Main/preload/renderer, native image decoding, secure local stamp storage and workbook worker remain actual product code.
- File/save/confirmation dialog return values are substituted only in the QA controller. Actual OS dialog interaction is **NOT RUN**.
- Print is routed to actual Chromium `printToPDF` using product print CSS. Native OS print preview and physical printing are **NOT RUN**.
- XLSX reopen uses SheetJS; Microsoft Excel desktop is **NOT RUN**. Payment sealing is **NOT REQUIRED**.
- Standalone Instructor web GUI is **NOT RUN**; independent web-session read projection/authorization is covered by the real-DB tests.
- Multi-page records are synthetic fixture setup through actual Instructor IPC, not an Excel import GUI test.
- Renderer request origins are recorded, not a complete Main/OS egress audit. No operating Supabase configuration or real credentials are supplied.
- Local PC Docker, large local builds, user data, existing EXE/profiles, integration/main and unrelated processes are untouched. The interrupted initial local dependency install remains only in the isolated external-drive QA clone; no local product build ran.

## Final result

**CONDITIONAL — preview UI FAIL; do not approve normal attendance/payment preview use until corrected.**

Two independent read-only reviewers directly inspected all 12 Electron captures and all six PDF page renders. Original Actions files were preserved; the result JSON's automated PASS records were not rewritten.

| Item | Result | Evidence / scope |
|---|---|---|
| Actual Windows Electron / fixed SHA | PASS | `source-sha.txt`, runtime source SHA and isolated profile in result JSON |
| Teacher registration/edit, work log save/query | PASS | Actual UI + native loopback PostgreSQL; `teacher-saved-log.png` |
| Teacher/instructor stamp separation | PASS, scoped | Actual nativeImage decode/secure local store; both roles register/replace/delete without overwriting the other; `independent-stamps.png`; native picker/confirm NOT RUN |
| Save/relaunch restore | PASS, functional | Normal quit, same isolated profile, DB log restored and both stamp data URLs equal originals; screenshot alone shows upper Settings, not restored stamps |
| Assistant schedule / edit rejection | PASS | `assistant-read-only.png`; valid settings/current version rejected with exact `locked` teacher-permission message; independent web-session projection and server RPC isolation in Linux tests |
| Attendance/payment on-screen preview | **FAIL** | All preview-named screenshots show the underlying school workspace, not the modal. Automated DOM presence/clicks are insufficient visual proof. See defect below. |
| Four single-page attendance PDF variants | PASS | No stamps / instructor only / teacher only / both; A4 ~595.28×841.89pt, one page each. Correct signature, teacher-confirmation and larger teacher-verifier footer stamp; Korean readable; no clipping or overlap. |
| 31-row attendance PDF | PARTIAL | Two A4 pages, 24+7 complete rows, repeated header, footer intact. Pale-gray background artifact below page-2 footer. |
| Payment XLSX | PASS for generation/content; PARTIAL for desktop print readiness | Actual worker export and two independent readers (SheetJS/openpyxl): 8 rows×4 columns; 3 hours; 90,000 won; no formulas or media/drawing parts; no explicit page setup, paper/orientation or print area. Desktop Excel NOT RUN. |
| 980×700 window | PASS, scoped | Actual outer window; renderer 964×635 at DPR 1; no root horizontal overflow; three output buttons visible/reachable. Hidden preview modal is separately FAIL. |
| Cleanup | PASS for owned runtime | Windows normal exit; remaining owned Electron processes 0; native DB stopped. Linux owned container absent. Runner profile/DB/temp excluded from artifacts and left to hosted-runner disposal; individual temp-file deletion not separately verified. |

### Confirmed defects; no product edits performed

1. **High: hidden preview modal.** `electron-p0/renderer/P0App.tsx:192` hosts the school workspace in `.s05-overlay`; `soft-rose.css:186` gives that layer `z-index:1100`. Instructor preview uses the body portal in `SurfaceDialog.tsx:25`; common modal rules at `soft-rose.css:19,133` use 600/700. The school overlay paints above the preview. Evidence: `attendance-both-stamps.png`, the other attendance variants and `payment-no-stamp.png` all show the underlying page while the controller's dialog DOM assertions succeed. Users cannot visually confirm the document/opt-in controls. Minimal correction candidate: align school/common-modal stacking order; add a topmost/pixel-visible preview assertion. No z-index or product code was changed in this QA.
2. **Minor: print background leak.** `attendance-multiple-pages.pdf`, page 2, has a large pale-gray rectangle below the verifier (approximately x50–842/y476–1212 in the 893×1263 derived render). Rows, stamps and footer remain correct. Inspect print ancestor/content sizing/background rules; no content or calculation change is needed.

Evidence caveats: `teacher-empty.png` still shows loading, so it is not settled-empty-state visual proof. The preview/restart screenshots must not be relabeled as successful visual proof of states they do not show. Neither limitation invalidates the separately observed real-DB, output-file or restart assertions.

### Security and preservation

- Only synthetic schools, Instructor records and generated geometric stamp fixtures were used. No operational URL/key variables were passed to either job. Main/OS network capture was not added; renderer observed external origins were empty, with that observation limited to the controller's lifetime.
- Uploaded scopes exclude profiles, session vaults, database directories, `.env` and full environment dumps. Best-effort pattern inspection of QA source and downloaded text evidence found no private keys, access tokens or credentials; no dedicated secret-scanner executable was available. This is not a formal guarantee against all secret formats.
- Integration remains `002a095f238a505b284f3af4f8a46ca101207411`; no product/main merge, deployment, Portable rebuild or local Docker/large build. All remote changes are QA controller/workflow/report only, on the QA branch.
- Native OS dialogs/preview, physical printing, desktop Excel, standalone web GUI and Windows 125%/150% DPI remain NOT RUN. Payment sealing remains NOT REQUIRED.

Next approved implementation would need a separate product-fix authorization. Reuse the recorded Linux success; rerun only the affected visible-preview/print-background boundaries after a fix, not the entire independent QA suite.
