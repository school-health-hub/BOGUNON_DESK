# UX-11 — widget selection polish and preservation validation

Status: PASS for the documented scope and limitations. No integration or deployment.

Branch: `design/ux-11-polish-dpi-qa`.
Base: `0cf7a3dcf60689abe80b6028f80f90d137fc9bdc`.
UX10 reference: `f36a32e5b8e8e2190e60ad3929a0f4b8c388b796`.

## Scope

- Remove only redundant visible ON/OFF captions; retain accessible name,
  description, checked state, track/knob, visible focus and 48×48 targets.
- Card minimum 120→108px; vertical padding16→14px (horizontal16 unchanged),
  group spacing24→20px and heading gap12→10px. Preserve13IDs, categories,
  descriptions and 3/2/1 columns.
- Shared switch essentials are imported by the shared drawer. Ordinary App gets
  Navy/slate/white controls; more-specific Electron Soft Rose rules remain.
  No global tokens or whole-theme port.
- Correct the existing shared automatic-layout persistence defect at the
  callback boundary. See [UX11-LAYOUT-001](UX-11-layout-preservation.md).

## Completed gates

- Node22.23.3, npm10.9.9, Electron45.2.1, Vitest5.0.1; unchanged lockfile.
- Independent E: dependencies/cache/temp and approved Rust preparation; no
  shared node_modules writes or dependency installation in this closure.
- 84 focused tests passed, including new shared/adapter boundary coverage.
- Root TypeScript and three Electron TypeScript configurations passed.
- Ordinary production build and Electron build passed.
- Actual ordinary production App:16 captures across1440×900,1366×768,
  1280×720,980×700; all13 visibility/layout round trips, keyboard and reload PASS.
- Electron:26 captures across those viewports plus560px auxiliary; both-entry
  all13 toggles, mode/reopen/restart, saved geometry/memo and existing entry points
  PASS. Separate actual drag/resize/restart PASS.
- Two independent reviewers directly inspected all46 final images (42 library,
  manual Electron, three trace images) and corresponding DOM/reports.
- Zero horizontal page/library overflow and card overlaps in captured states;
  48px targets; ordinary knob/track contrast≥6.006:1. Ordinary description ellipsis
  is intentional and recorded, not certified as fully visible text; full
  accessible descriptions remain available.

## Full regression history — do not erase the initial failure

The initial expanded full run produced1062PASS/1FAIL/3existingSKIP,160files.
The unrelated file-drop modal focus test expected Shift+Tab to wrap to Cancel
before observing automatic focus initialization. Isolated diagnosis passed8tests.
Effect-readiness timing is a plausible explanation, not a conclusively proven
historical cause.

The test-only amendment removes manual `first.focus()` and waits for the
product's automatic initial focus before sending the same key. The exact Cancel
focus assertion remains unchanged. Missing autofocus or a broken trap still
fails. No modal product code, sleeps, skips or timeout inflation were added.
Three bounded focused runs passed8tests each; test TypeScript passed. The failed
full report is retained. The fresh, explicitly approved one-time full run completed: 1,063 PASS / 0 FAIL / 3 existing SKIP, 160 files, 244.02 seconds (2026-11-18). All 13 tested source hashes matched afterward.

The full command includes both changed shared component test files:

```powershell
node node_modules/vitest/vitest.mjs run electron-p0/tests src/dashboard src/dock src/components/dashboard/DesktopWidgetLayout.test.tsx src/components/dashboard/WidgetLibraryDrawer.test.tsx --no-file-parallelism --maxWorkers=1 --no-cache
```

Prepare using the approved `node scripts/electron-p0/prepare-tests.mjs`, independent
E: process-local cache/temp/Cargo paths, one Cargo job and one Rust test thread.
Do not elevate Codex, builds or Git. Windows symlink tests may need newly
approved, user-operated administrator QA. Preserve the three platform skips.

## Native DPI and limits

Actual Windows125%/120DPI and150%/144DPI were previously measured with matching
Electron scale/DPR and zoom1. Original100%1920×1080 restoration was verified.
Those evidence bytes remain intact. This correction adds no DPI/media rules;
more-specific theme geometry and newly captured Electron layout remain intact.
The prior DPI results are reused, not labeled newly measured.

Exact1440×900 at125/150% and980×700 at150% remain NOT RUN because of physical
work-area limits; measured alternatives were1440×736,1248×591 and980×591.
Auxiliary560px evidence covers captured content only. Native AttachmentOPTION C,
production deployment, authenticated live meal-data and receiving-PC GUI remain
NOT RUN / deferred. Ordinary memo remains session-only.

## Source and evidence provenance

Validation happened before checkpoint commits at the base HEAD plus recorded
working-file SHA256 manifests. Final commit source must match those tested
files; final commit IDs and remote equality are recorded in the closure report.
The historical UX11 native controller intentionally checks its recorded base
build metadata; do not spoof that metadata to reuse it on another commit.
Fresh builds can be checked through the actual app and a source-pinned QA run.

Local reports, screenshots, failed attempts and profiles stay under
`E:/BOGUNON_DEV/ux-11-home/`. They were not uploaded by the source push. This
record is not a claim of a complete cross-PC evidence handoff. No main/integration
merge, protected branch change, PR, release or deployment is authorized here.
