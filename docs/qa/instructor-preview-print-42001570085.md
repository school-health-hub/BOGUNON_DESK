# Instructor preview / PDF two-defect fix — 2026-11-05

**Scoped result: FIX-01 PASS / FIX-02 PASS. Not a blanket operational-use approval.**

## Immutable revisions and preservation

- Original QA product and current integration both: `002a095f238a505b284f3af4f8a46ca101207411`.
- Original QA branch `codex/instructor02-actions-qa`: `937f119bbfe5e929a42071bb1615f523485de73a`. It contains the original product; the merge-base is exactly002a095. No original branch was rewritten.
- Product fix branch `fix/instructor-preview-print`: **243ae95e69483dfbe8d2438c41f858577d748048**, based on that common product SHA.
- New QA controller used for the run: `qa/instructor-preview-print` at **3fadde654ca8a7a73a1aad2d7b70c50cf08c2240**. This report is a later documentation-only commit. QA files are not in the product fix branch.
- Existing `.github/workflows/electron-cloud-g0.yml` reused on the new QA branch; Windows-only dispatch exactly once. Main/default workflow registration, product/integration merges, deployment and Portable generation were not performed.

## Actual causes and minimal product changes

1. The `.s05-overlay` is1100, but the body-portal common SurfaceDialog modal was700. The opaque school workspace painted over the preview even though inert background elements allowed underlying dialog DOM interactions. Presence/click assertions alone missed the defect. Instructor now opts into `instructor-preview-overlay` at1101, immediately above its parent surface. Common modal layer defaults remain unchanged. Existing modal focus containment/inert/Escape are reused; an opt-in scroll/focus restoration preserves the school viewport.
2. `src/styles/base.css` sets HTML background `#f4f8f8`. Existing print rules whitened the content-sized body/dialog, leaving the HTML canvas exposed below the last page's shorter content. Original PDF drawing fills exactly matched RGB244/248/248. An Instructor-only print selector whitens HTML; no table/geometry/pagination/financial rule changes.

Product changes are only `SurfaceDialog.tsx`, InstructorWorkspace's two opt-in props, Instructor print CSS, and a focused modal regression test. Calculation, settings/storage, DB schema/RLS, seal stores/three positions, Excel engine, native CLI5/OCR and other modules are unchanged.

## Before evidence preserved

- [Original Windows run41997383342](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41997383342).
- [Original Artifact13401027183](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41997383342/artifacts/13401027183).
- Original downloaded ZIP SHA-256: `ed52c23bd809b42fb28152f52cd24dc4fe7e2b5bb30935719dd99f1329054573`, matching GitHub's digest.
- `attendance-both-stamps.png` and `payment-no-stamp.png` show the school screen instead of the preview. `attendance-multiple-pages.pdf` page2 has the gray rectangle below the footer. Originals were not altered/relabelled; original automated PASS did not establish visibility.

## New Windows execution and independent PDF review

[Run42001570085 — SUCCESS](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42001570085)

[Artifact13402807610](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42001570085/artifacts/13402807610), ZIP SHA-256 **a23465210c8a33c033e186b2670a493a68917e338c12c9fbc985cc178b10d2f0**, matched GitHub digest after download.

- Actual unpackaged Windows Electron, exact fixed product SHA, synthetic Auth and isolated native loopback PostgreSQL. No Hosted Supabase.
- Six Windows checks PASS. Requested outer size980×700; actual captured renderer964×635, DPR1, no root horizontal overflow.
- Actual screenshot review: attendance/payment previews are visibly above the school screen; document/seal controls are accessible. Topmost DOM proof1101>1100, body portal, no transform, root inert, active focus inside. Tab/Shift+Tab/Escape/header-close and focus/school-scroll restoration PASS. Header/actions and scrolled footer captures are separately preserved.
- Main print follows the actual product path; the QA controller substitutes native dialog return values and routes `webContents.print` to actual `printToPDF({preferCSSPageSize:true,printBackground:true})`. This is not physical printing/native OS preview proof.

| Original Windows-generated PDF | Pages / rows | Seal draws | Review |
|---|---|---|---|
| `attendance-19-rows.pdf` | 1 page /19 rows |39 | White background, rows1–19 unique/complete, footer intact |
| `attendance-31-rows.pdf` | 2 pages /24+7 rows |48+15=63 | All31 rows unique/complete; repeated header; no gray tail, row/seal clipping or duplication |

All three pages were rendered from the downloaded original PDFs with PyMuPDF at1.5× and visually inspected. Drawing-level review found no large non-white background rectangles; bottom pixels are255/255/255 on every page. Seal bounds are within the printable page. Comparing original31-row PDF to fixed31-row PDF shows **0.0pt maximum date-position delta and0.0pt seal-position delta on both pages**, identical page sizes and24+7 row split. The dimensions remain594.95996×841.91998pt (Chromium A4), with the existing margins/columns/fonts/seal placements unchanged.

- 19-row PDF SHA-256: `61d0a7bf0311ba23c7f32e354684d622f5949a708b32a750b46d71ebc81f2c9e`.
- 31-row PDF SHA-256: `75c8b91a987ea7a28386dccc72bf09c296d1a77518fc34ebd5ed634ba9deb328`.
- Payment XLSX actual worker generation/selected-file write and SheetJS reopen PASS:3h/90,000 won, no images/drawings. SHA-256 `4a8a4bd2ecdbb04bb9e3e1368b1d0820267265fb2f09dba53fb044e3af230d8b`. Payment sealing remains **NOT REQUIRED** and prohibited.
- Original result JSON retains `CONDITIONAL_PENDING_PDF_RASTER_REVIEW`; it was not edited. The scoped PASS here follows the separate downloaded-PDF analysis and visual review, not just job success.

## Other checks and limits

- Local focused tests19 PASS, including modal lifetime/focus/scroll, existing Soft Rose modal regression and Purchase-independent payment workbook contract.
- Electron Main/Preload/Renderer/test type checks and production build PASS. School workspace/web typecheck and production build PASS. No full independent suite or repeated database QA.
- Normal app exit PASS; owned residual processes0; owned PostgreSQL stopped. QA profile/DB/temp isolated under the disposable Windows runner and excluded from uploaded artifacts. Individual temporary-file deletion is not separately proven.
- Native OS picker/save/confirmation/print-preview interaction, physical printer, desktop Microsoft Excel,125%/150% DPI, standalone web GUI, Hosted Supabase and operational-school use remain **NOT RUN**. Existing Excel page-setup/desktop print-readiness limitation was not changed by these two fixes.
- Previous registration/edit/restore/permission tests are prior evidence, not freshly rerun as a full suite. Their protected implementation is unchanged.
- Integration remains002a095. Product fix is its direct descendant and can fast-forward if that integration HEAD remains unchanged. No automatic integration is performed.
