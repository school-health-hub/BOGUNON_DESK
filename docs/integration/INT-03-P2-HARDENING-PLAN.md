# INT-03 — P2 hardening after RC2 + UX-11 integration

## Status / boundaries
- Planning checkpoint, **no product code changes or QA executions yet**.
- Repository: `school-health-hub/BOGUNON_DESK`
- Base and tested source: `integration/int-02-rc2-ux11-candidate@fcfb180b3b7eccc89a42044c94b3d6cd45573a36`
- Independent follow-up: `integration/int-03-p2-hardening`.
- Evidence: `docs/integration/INT-02-IMPLEMENTATION-REPORT.md` and local private artifacts on E: (not in Git).
- Gate: fix or explicitly isolate the two identified P2 items. No release or main merge.

## Task A: Dashboard nested horizontal scroll
INT-02 observed internal horizontal scrolling at 980 and some 1280 viewports, with initially out-of-view D-Day. Existing tests proved content reachable after programmatic scrolling but NOT manual ergonomics.
1. Reproduce on exact INT-02 baseline in a segregated test profile, then inspect CSS layout, grid measurement, horizontal scroll containers, Dock obscuration, accessibility and browser zoom. Compare view/edit, desktop content 980×700 and 1280×720 first, other supported widths after.
2. Prefer eliminating accidental nested horizontal scrolling **without shifting user-saved x/y/w/h or dropping widgets**. If intrinsic horizontal scrolling is unavoidable in a compact layout, expose understandable user-operable scroll affordance and keyboard navigation. Explicitly distinguish hidden, horizontally scrollable, and clipped.
3. Preserve 13 widget IDs, ON/OFF, saved geometry, direct drag/resize-only persistence and layout data. Test mount/resize without user action must not write coordinates.
4. Check display 100%, 125%, 150% under fresh explicit user approval before modifying Windows scaling; previously captured DPI QA is for INT-02 SHA and not final INT-03 proof.
5. Prohibit using a blanket `overflow:hidden` fix that makes content unreachable.

## Task B: Packaged test-file inclusion
INT-02 found compiled `newsletter-ai-asset-storage.test.js` under Main build/package patterns.
1. Establish exact build graph and packaging inventory: compiled file location, builder include patterns and asar/unpacked output. Confirm no production runtime dependency.
2. Keep test source and CI discoverability. Make a minimal packaging-only exclusion or build output separation verified in the packaged artifact. Do not remove test coverage or weaken release protocol/asset inclusion.
3. Validate compiled `newsletter-ai-protocol.js`, app icons, preload, IPC and newsletters survive the packaging adjustment. Ensure no active test/runtime file imports excluded code.
4. Product build ≠ install GUI. A packaging content check alone cannot claim installed application PASS.

## Required verification
- Before any edits, record baseline Git/source SHA, local disk/RAM, active worktrees and dirty merges; never clean/reset other work.
- Tests for scrolling/reachability, preserve layout/memo/Dock, settings, toolbox/Newsletter, packaging inventory. Electron TypeScript root/main/renderer/test configurations, `prepare-tests.mjs`, serial full Electron + Newsletter regression, Electron build, package graph/inventory, diff check.
- With changed content, rerun actual independent Windows Electron GUI at 1440×900,1366×768,1280×720,980×700 including view/edit/scroll/manual keyboard, drag/resize, 13 ON/OFF/restart. For any native permission/DPI/system settings changes, obtain new approval; never reuse prior elevation.
- Existing 3 skips must be preserved and reported by names; do not add skips to force PASS.
- Verify no introduced account/logout/Newsletter consent/project authority/output lock, Official/Record cancel or tray regressions; add targeted cross-feature tests when change touches shared shell.
- Ideally test packaged/unpacked candidate cold launch and manual UI before asking for deployment; any installer installation requires explicit separate scope/approval.

## Deliverables and exit
- `docs/integration/INT-03-P2-REPORT.md`: before/after DOM measurements, screen captures (local evidence refs), package inventory, exact changed files/source fingerprint, regression counts, retained NOT RUN, git SHA.
- ONLY source/test/docs scoped to this branch. No main/existing integration/RC2/UX branches modified, no release, no Native Attachment OPTION C.
- Commit/regular push if required gates pass; otherwise retain changes and report CONDITIONAL/BLOCKED.
- Full installation GUI, live server account or third-party AI calls remain distinct later-stage authorization and cannot be inferred from test/mock PASS.
