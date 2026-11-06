# Integrated Windows GUI design review

Base: `integration/school-05-account-02b-qa` at `838cc0b1a7dc50129aebda75cf18b73386ed9bf7`.
Review branch: `qa/integrated-gui-design`. The integration branch is not updated by this review.

## Evidence and execution

The baseline product tree equals Windows product `39c775cdd11509fdc6bc930ef62990acdd1e1315`.
Its immutable Portable hash is `7cb0dc89cc967db9d687bc0f385451f740c21d11d7959f5b4f39aa710a1fdefa`.
Baseline actual Windows screenshots: Actions [42174863338](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42174863338),
then [42175621845](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42175621845).
The latter captured 18 areas at three sizes; settings capture was blocked by an open toolbox modal in the controller.
These failed controller runs are not full GUI PASS. The subsequent controller closes the toolbox explicitly.

The existing `electron-cloud-g0.yml` / `electron-p0-windows.yml` workflow runs this review branch only.
`gui-design-survey-<run>-<attempt>` contains `index.html`, `gui-survey.json`, PNGs, profile/process evidence,
`portable.json`, focused results and a `before/` directory. Download and extract the artifact, then open `index.html`.
Each source change rebuilds the Electron renderer/Main/Preload and checks the new source SHA and clean state.
Only unchanged, hash-verified native binaries are reused. A separate new Portable artifact is preserved.
No new workflow, Hosted connection, QA Workspace activation, or production DB call is required.

## Minimal changes

- Official workspace: the 420px + 520px columns, 18px gap and 56px padding exceeded the available width before the old 900px breakpoint. Use a 1024px single-column breakpoint and allow children to shrink. No overflow hiding or document logic change.
- Purchase toolbar: flex items previously shrank action labels into vertical characters at 900px while OCR controls occupied the same row. Wrap the existing toolbar and keep action button text unbroken. No import/output logic change.
- Finder toolbox label: remove obsolete “synthetic Mock” description; identify the actual Main-owned YouTube path and key requirement. Actual network search remains NOT RUN.
- Newsletter: expose the existing studio from the existing toolbox, retaining its settings entry. No new studio or major menu restructuring.

## Feature inventory

The generated `gui-survey.json` includes the current route-based integration matrix, per-screen evidence and limits.
GUI capture does not prove all business functions. Actual UI task/memo save and IPC reload, widget interaction,
owned native CSV picker and Finance engine status are distinguished from screen inspection.
Workspace is captured CLOSED; active school membership, shared inventory and instructor screens remain Hosted connection pending.
Independent Inbox, weather/meal providers and several legacy external shortcuts are not wired in this Electron build.
Tauri server synchronization and true OS Desktop Surface/WorkerW are not restored by this work.

## Existing UI branches

- `codex/int5c2-module-ui-polish` at `32d40c1769b587f917416f17bc588d7e62d7084f`: divergent (integration-only 146 / branch-only 44). Latest WIP changes include Finance tab wrapping and Purchase settlement widths; not Windows-verified on this product and not wholesale applied.
- `codex/td2-glass-portable-layout-fix` at `6e454f7e8d4e96abca9058e7413f6fb8f4b949e1`: divergent 78/7; selected TD2 product changes were integrated previously. Remaining QA/profile/document history is not a product merge candidate.
- `design/electron-soft-rose-visual-fix` at `036ff1e73a5cfdb6c0b16921aa04ebf804aed79a`: divergent 93/6; no wholesale old-UI replacement.

## Approval and remaining validation

The product still uses the previously approved Soft Rose Glass. A complete navy palette, home layout or major menu redesign requires user review of actual screenshots first.
Small Dashboard cards retain internal scroll areas; weather/meal cards explicitly disclose their missing provider.
Actual tray clicks, OS DPI 125/150, physical print, real Google/ChatGPT/YouTube/school-network calls and Hosted installation are not inferred from screenshots.
QA uses a new profile only, verifies all sensitive store paths and normal shutdown with zero owned residual processes.
Native file dialogs are operated only when owned identity and controls are unambiguous; otherwise record NOT RUN.

The generated Actions evidence is authoritative for final PASS/FAIL/PARTIAL/NOT RUN, not this pre-execution checklist.
