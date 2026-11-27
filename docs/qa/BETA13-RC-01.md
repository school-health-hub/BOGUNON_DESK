# BETA13-RC-01

Product Source SHA: `98f39f1467bf20a22e1ba182391fbd1c7e05155f`. The source matched `origin/codex/beta13-fix-01-newsletter-close` at verification. QA branch: `codex/beta13-rc-01`. Its documentation commit is distinct from the product source.

The candidate diff from `9ae595a2a52adcc8794e885ffbd7d8bef62de5c7` contains six files for Newsletter close protection, its tests and QA notes. Dependency manifests and lockfiles were unchanged.

## Environment

School PC, Windows 11 Pro build 26300, isolated F: worktree, two physical 1920×1080 monitors. Electron tests used disposable QA profiles and synthetic calendar/Newsletter data. Captures cover app windows. No operating desktop was captured.

## Compatibility and installation gate

The beta.12 source candidate `18c0c2c938cd524bb1e904a5f704a617cfd13b25` used Desktop Surface schema 2. The RC reader accepts the same shape and treats `boardPlacement` as optional. The compatibility fixtures cover the prior shape and preservation of monitor profiles. This is source and isolated-test evidence.

Obtain separate approval for an isolated Windows account, a clean install/update rehearsal, and rollback. Before update, close the app normally and confirm its processes exited. Back up the entire matching app profile to approved secure storage and record the source version and SHA-256 inventory. Verify the backup on a disposable profile. On a failed upgrade, preserve the upgraded state for diagnosis, close the app, restore the verified pre-upgrade backup with the matching installed version, and verify a known project, profile, and Dock layout. Use the original Windows identity for machine-bound credentials or reconnect separately. See also `docs/qa/BETA13-RELEASE-QA-01.md` on the release QA branch.

## Results

| Gate | Result | Observed scope |
| --- | --- | --- |
| TypeScript and Electron production build | PASS | Main, renderer and test compilation, then Electron production build. |
| Existing focused tests | PASS | 93/93 in 12 suites, including updater consent, verification and failure/cancel paths in a disposable temporary directory. |
| Dual monitor, Desk and Settings | PASS | Two 1920×1080 displays; work areas 1920×1032 at (0,0) and (1920,0). Verified shared 25% inset, secondary target, Dock Settings open/close, Apply/Cancel/Restore defaults, orderly exit and profile restore. Candidate widget geometry, ownership and visibility persisted. The 20–25% range and single-monitor DIP math were separately checked by automated tests. |
| Narrow Settings window | PASS at tested size | Resized only the isolated app window to 600×560. Vertical scroll exposes the three action buttons with readable labels. |
| Calendar display | CONDITIONAL · LOW | A long Korean QA event title rendered in the monthly calendar. The two-line cell truncates the visible title; the full title remains in the tooltip. This limits at-a-glance reading, with no storage loss. A separate visual fix would be needed if the full title must fit in the cell. |
| Newsletter draft protection | PASS | Clean document closed without prompting. Dirty editor and native tool-window close showed confirmation. Continue and leave-without-save retained session text. Cancel/error left the draft open. Save-and-leave wrote JSON. After normal app relaunch the saved JSON was opened explicitly and the updated title verified. Existing Rose export confirmation and synthetic A4 PNG/PDF passed. |
| Physical single monitor, mixed DPI, reconnect | NOT RUN | Use separate approved hardware/configuration. Repeat Settings selection and board geometry, unplug/reconnect, and confirm profile identity and temporary placement. |
| Desktop contrast and Explorer click-through | NOT RUN | Requires an approved isolated Windows desktop with synthetic icons and wallpaper. Confirm icon click-through, focus boundaries and the taskbar with that desktop. |
| Actual beta.12 upgrade, failure recovery and rollback | NOT RUN | Approval and isolated installation rehearsal required. No installer or update executed. |

The first GUI pass hit two test-runner races while a Palette window was replaced and a Workspace window hid during a simulated click. QA-only instrumentation waited for the live Palette and used explicit button activation for the clean-close assertion. The production code in the candidate was unchanged. Build metadata marks the tree dirty because of QA instrumentation and this report.

Final Windows Electron E2E: **2/2 PASS**. No QA-owned Electron processes remained after the run. Local evidence: `artifacts/rc-e2e-final.json`, `artifacts/rc-final/` for Settings, narrow Settings, calendar and Palette captures, and `artifacts/rc-newsletter-final/` for confirmation captures and synthetic outputs. The QA instrumentation was reverted after testing. Evidence and synthetic documents remain local.

## Disposition

**CONDITIONAL**. No BLOCKER or HIGH defect was reproduced. The long title display is LOW at the tested size. High-impact physical profile recovery, desktop interaction, upgrade and rollback remain unverified. Automatic recovery of unsaved Newsletter drafts after whole-app exit is currently unsupported. Only this QA document is committed to the RC branch. Compare local/remote refs and check the upstream divergence after pushing.
