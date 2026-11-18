# INT-06 — BOGUNON DESK 2.0 beta.1 release gate

Status: PLAN ONLY. No QA runs, installer builds, installation, live login, AI calls, main merge, or release yet.

Base: `integration/int-05b-product-branding@d03a58fa7f73411aa2cdb9ebd31c0d8527e21947`.
Candidate branch: `integration/int-06-beta-release-gate`.
Product: BOGUNON DESK 2.0 / `2.0.0-beta.1` Windows x64.
INT-05B scoped branding/portable tests PASS; full regression at this SHA NOT RUN. INT-03's 1,520 PASS is an earlier SHA only.

## Gate 1: Freeze and static preflight
- In independent directory, verify source SHA, Git clean, no change to protected worktrees/dirty index/MERGE_HEAD, disk/RAM/commit capacity, read current package scripts and Electron builder config.
- Record official 2.0.0-beta.1 metadata; preserve existing appId and PROFILE_NAME to avoid profile changes.
- Only synthetic user data, QA profile, no real staff/student records or live provider credentials.

## Gate 2: Current-source complete regression
- Run official preparation, TypeScript 4 configs, focused branding, identity, settings, account/logout, newsletter authority/consent, widget/layout, Official/Record and Runtime package tests, then expanded Electron+Newsletter full suite.
- Prefer serial workers, avoid concurrent compilation and needless re-install. Do not silently drop failures, add SKIP, or claim a previous SHA's PASS applies now.
- For Windows symlink fixture that requires elevated terminal, seek **new explicit approval**; never auto-elevate/alter developer mode. Without it mark NOT RUN/CONDITIONAL.
- Capture exact source/checksum, test counts, legacy skip names, test logs and CLI/fixture provenance.

## Gate 3: Packaging-channel checks
- Confirm existing INT-05B unsigned portable SHA `3D9E193E6927BDE2487292B81ABF26CFEABB8F7C5CD51A052F2A84830EFA4C94` and metadata; it remains QA evidence and is not a signed release.
- Inspect NSIS configuration for truly per-user install versus assisted per-machine selection, installation target, upgrades, uninstall, user profile survival and data migration. Write a concise policy recommendation.
- **Do not generate or execute installer without fresh explicit approval and confirmation school IT policy permits it.** Prefer unsigned/isolated QA candidate; never distribute to school users while unsigned.
- Distinguish packaged Portable GUI already passed from installed NSIS GUI (NOT RUN). Signing/SmartScreen risks unresolved.

## Gate 4: Go/no-go report
Write `docs/integration/INT-06-BETA-RELEASE-GATE-REPORT.md` with source SHA, automated tests and GUI evidence (if performed), remaining NOT RUN, release mode/policy recommendation, release blocker list and GO/CONDITIONAL/NO-GO.
- Important gaps: live server auth/logout, provider AI external calls, physical tray clicks, NSIS installation/upgrade/uninstall, code signing, actual school IT policy, Native Attachment OPTION C deferred.
- Do not require risky live verification in this phase; plan explicit follow-on approvals.
- Documentation-only commit/push on this branch after review is allowed. No main merge, PR release, GitHub release, unsigned distribution or product changes.
