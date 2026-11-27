# BETA14-RC-01 — Electron candidate build handoff

## Source

- Repository: `school-health-hub/BOGUNON_DESK`
- Branch: `release/beta14-candidate-01`
- Parent UX QA HEAD: `badc86701f805c0aadafa2dd46b8e66add6b9939`
- Verified UX product SHA: `24ba8c383f2654187beb42be15b78d7a50204702`
- Candidate version in `electron-p0/package.json`: `2.0.0-beta.14`
- Branch was created without merging `main`, which is historically divergent.

## Included and excluded changes

Included: BETA13-UX-FINAL-01 (Dock editing preview, compact toggle rows, new shared 25% default, clock card) and BETA13-UX-FINAL-02 (actual Windows restart PASS). Existing beta.13 functionality remains the base.

Not included: merges of unrelated worktrees or outstanding PRs. Do not use Tauri production release scripts or change root `package.json` version for Electron.

## Next steps on the Windows build machine

1. Checkout exactly `release/beta14-candidate-01` into an isolated F: worktree; confirm remote SHA, clean state and package version.
2. Run targeted tests, TypeScript and production Electron build. Verify packaged runtime version via Electron `app.getVersion()` = `2.0.0-beta.14` and UI About pane. Check no QA-only UI in packaged release.
3. Build Windows x64 per-user NSIS using the already-established Electron beta.13 packaging path. Record installer SHA-256 and exact product source SHA. Do not replace beta.13 binaries.
4. With isolated QA profile, test verified beta.13 -> beta.14 update including Windows notification/tray entry, updater card, download, installation and relaunch. Preserve real user profile. Check update manifest and asset integrity/signature per existing beta channel and refuse unsafe fallback. Do not bypass Windows SmartScreen or signature policy.
5. Stop with a PASS/CONDITIONAL report and actual screenshots/files. Prepare release notes and candidate artifacts; publish the GitHub prerelease/update feed only if the complete update-chain checks pass and publishing is explicitly authorized. Do not merge main.

## Risk and acceptance

- `main` and UX branch are divergent (at inspection: UX ahead 239, behind 6); do not silently merge.
- Existing beta.13 and its GitHub Release assets are immutable.
- No operational profile mutation, Windows desktop icon moves, or automatic account changes.
- Physical single-display and 125% DPI were NOT RUN in the prior UX QA; report candidly unless re-tested.
- A source commit on GitHub does not imply an installer has been built, installed or published.

## Current state

GitHub beta.14 candidate branch and version bump prepared. Windows packaging / installed-app update / GitHub release: NOT RUN.
