# UX-11 — Widget Selection Visual Polish and Windows DPI QA

## Status and baseline
- **Status:** implemented and validated within the documented limits; see [final validation](../qa/UX-11-widget-selection-polish.md). No integration or deployment.
- Repository: `school-health-hub/BOGUNON_DESK`.
- Base: `design/ux-10-widget-selection-grid@f36a32e5b8e8e2190e60ad3929a0f4b8c388b796`.
- Branch: `design/ux-11-polish-dpi-qa` (independent).
- Source record: `docs/qa/UX-10-widget-selection-grid.md`. UX-10 finished 1,053 PASS / 0 FAIL / 3 SKIP, actual GUI QA at DPR 1, zoom 1. Windows 125%/150% native DPI remains NOT RUN.
- Scope is only **a small Electron user-interface polish and actual Windows DPI QA**. Do not integrate with RC2 or ship.

## Visual punch list (from UX-10 supplied screenshot)
1. Remove redundant visible `ON` or `OFF` captions beneath the switch **only if** accessible switch name and checked state remain explicit to assistive technology. Maintain visible switch track/knob contrast, focus indicator and 48x48 hit area.
2. Tighten widget-selection card height and vertical section spacing moderately to display more of the 13-card catalog without feeling cramped. Use measured before/after dimensions, not arbitrary compression; retain Korean text legibility, 2-line description where needed and 3/2/1-column rules.
3. Ensure header, settings side navigation, group counts, rose ON / neutral OFF surfaces and card widths are aligned consistently.
4. Do not redesign the UX-09 toolbox, floating Dock, desktop canvas or change 13 widget identifiers, labels or order without evidence.
5. Report visual before/after screenshots. If polishing adversely affects legibility, preserve UX-10 style and mark the suggestion rejected.

## Native Windows DPI validation
- Test at actual Windows **125%** and **150%** display scaling, not only browser CSS zoom or DevTools emulation. Prefer isolated approved QA account/environment or user-approved temporary per-user display adjustment. Never alter school PC, production profile or other users' display settings; restore original scale after QA.
- Capture: effective screen resolution, Windows scaling, Electron devicePixelRatio, app zoomFactor, browser viewport CSS dimensions and actual window bounds, plus screenshot filenames.
- Under both DPI settings inspect 1440x900-equivalent or an appropriately sized physical desktop window, and at least one compact ~980x700 content window when physically feasible.
- Check widget library 13-card coverage, three/two/one-column thresholds, no horizontal overflow, no clipping, no doubled/misaligned scrollbars, no footer/Dock occlusion, card text/wrapping, switch target, keyboard focus and toggle state updates.
- Turn representative switches OFF/ON, close/reopen settings, restart, verify ID/geometry/hidden flags/memo/Dock state unchanged.
- If physical display cannot support a target combination, record NOT RUN and exact limitation; never call CSS simulation real DPI PASS.
- The `WorkerW/Native Attachment OPTION C` remains **DEFERRED / NOT RUN**.

## Verification gate
1. Preflight: confirm branch base SHA, all existing worktrees clean/protected, disk space, current Windows scaling; never overwrite uncommitted work.
2. Small, scoped CSS/UI changes only after baseline screenshots.
3. Focused UX-10/11 tests; verify accessible switch and screenshot changes.
4. Approved `node scripts/electron-p0/prepare-tests.mjs`; `npm run electron:p0:build`; existing full Electron regression command from UX-10 record, TS 3 configs, git diff --check. Use existing script where available; lint NOT RUN if script is absent.
5. Symlink fixture regression may require a QA-only user-operated elevated PowerShell as in UX-10: obtain *fresh explicit approval* before elevation; never silently skip 14 tests, alter developer mode or leave elevated Codex.
6. No source changes to auth, main/preload/IPC, storage schema, underlying widget actions, settings parser, work engines, integrations, RC2 or UX-09/10 protected branches.
7. Commit/push only if accepted UI and required gates PASS; otherwise preserve changes and report CONDITIONAL/BLOCKED, avoiding main/integration merge or deployment.

## Evidence/report
Return exact source SHA, changed files, UI measurements, native-DPI observations, screenshot paths, 13-card state persistence results, full regression PASS/FAIL/SKIP, untouched protected refs, commit/push SHA if performed, and residual NOT RUN items.

## Next distinct stage
After UX-11 visual approval and remote preservation, prepare an **RC2 + DESIGN-07/UX-09/UX-10/UX-11 integration compatibility audit** on a separate integration candidate. Do not perform such integration inside UX-11.
