# BETA13-RELEASE-QA-01

Candidate commit: `9ae595a2a52adcc8794e885ffbd7d8bef62de5c7` (`codex/beta13-visual-02`). The QA branch is `codex/beta13-release-qa-01`.

## Environment and evidence scope

Windows 11 Pro x64, build 26300, with two physical 1920×1080 displays. The primary display originated at (0,0) and the secondary at (1920,0). Both reported a 1920×1032 work area through Windows Forms. Electron E2E uses a separate temporary profile and synthetic Newsletter/calendar data. App-window captures exclude the operating desktop. No isolated Windows shell account was available for wallpaper and icon interaction testing.

## Upgrade and recovery gate

- The beta.12 candidate reference is `18c0c2c938cd524bb1e904a5f704a617cfd13b25`. The source comparison shows the existing Desktop Surface version 2 document is retained, with an optional `boardPlacement` field. The current parser also accepts a version 2 document without that field. The installed beta.12 application and its data were outside the runtime test.
- Actual update and rollback installation require separate approval and a disposable Windows identity. Before authorizing a pilot, close the app normally, confirm its processes have exited, and back up the entire Electron profile to approved secured storage. Record the app version and a hash inventory. Include settings and work data and protect files that contain school data or machine-bound credentials.
- Validate backup readability and rehearse restore against a separate disposable profile before the pilot. If the upgrade or startup fails, preserve both the backup and post-upgrade state. For approved rollback, restore the pre-upgrade profile with the app stopped and verify a known document, layout and Dock state on the matching version. Verify machine-bound account data on the original Windows identity or reconnect separately.

## Verification results

| Area | Result | Scope |
| --- | --- | --- |
| TypeScript and Electron production build | PASS | Main, renderer, and test TypeScript checks completed as part of the production build. |
| Automated focused regression | PASS | 74 integration tests plus 8 local-calendar tests. Isolated updater tests used a separate `UPDATE_QA_TEMP`. They exercise consent, verification, cancellation and failure handling without installing an update. |
| Physical dual-display setup | PASS | Dock Settings click, Settings open/close, Apply/Cancel/Restore defaults, primary shared mode with 25% inset, and dedicated secondary selection. |
| Storage and orderly exit | PASS | Board E2E verified saved placement and existing widget profiles after normal shutdown and relaunch. This verifies the tested settings flush path. |
| Newsletter confirmation and export | PASS | Dock Toolbox opened Workspace Newsletter. The Rose confirmation handled Escape and close without writing an output, returned focus, then accepted a separate request and produced valid synthetic A4 PNG and PDF files. |
| Newsletter unsaved editor exit | CONDITIONAL | Editing the title and selecting “보건 업무로” closed the editor immediately without a confirmation. Reopening through the Dock in the same process retained the draft title. Editor-close cancellation UI and draft survival after process exit were unverified. |
| Palette app surface | PASS at tested size | Real local calendar storage with a synthetic event. App-only views show the clock, health summary, memo, notifications, meal state and Dock. Meal and notification live data were outside the test. |
| Desktop icon, wallpaper, and taskbar interference | NOT RUN | Palette window bounds fit within the OS work area. The desktop composite, native pointer click-through into Explorer, and wallpaper readability require an isolated Windows shell. |
| Single monitor and hot-plug | NOT RUN on hardware | Synthetic DIP work-area bounds and monitor-profile cases passed in the focused suite. Physical single monitor, mixed DPI, unplug and reconnect require a separate test setup. |
| Installed beta.12 migration and updating | NOT RUN | Compatibility was checked at source and schema-test level. Runtime installation, update, downgrade and backup rehearsal require separate approval. |

Local evidence was retained under `artifacts/release-board/`, `artifacts/release-newsletter/`, and `artifacts/release-e2e.json`. QA test instrumentation exercised Dock Settings close and Newsletter draft close and is excluded from the QA branch commit.

## Findings and release disposition

- **MEDIUM — missing unsaved-close confirmation.** Load a synthetic editable Newsletter, change the title without applying it, press “보건 업무로”, then reopen the Newsletter from the Dock. The editor closes without offering a cancel action and the edited title is retained in that running app. The export confirmation is a separate flow. See `artifacts/release-newsletter/unsaved-close.json`. Address, if approved, on a separate fix branch that covers editor-close confirmation and preservation on cancel. Repeat the Newsletter, Dock handoff and export regressions on that branch.
- No BLOCKER or HIGH defect was reproduced in the exercised flows. Single-monitor, hot-plug, mixed-DPI, operational desktop contrast and real installer/upgrade/rollback remain unverified. Approve these on an isolated Windows shell before representing them as release coverage.
- Final release readiness is **CONDITIONAL**. Two Windows E2Es passed and no QA-owned Electron process was found afterward. The QA branch records evidence and leaves candidate code fixed. The QA commit is pushed separately from the candidate; verify with `git status -sb`, `git rev-list --left-right --count HEAD...@{u}` and `git ls-remote origin refs/heads/codex/beta13-release-qa-01`.
