# INT-06 — BOGUNON DESK 2.0 beta.1 release gate report

## Verdict

**CONDITIONAL**

The current product source passed the approved static, focused, complete Electron, complete Newsletter, runtime-package, and Electron build gates. The previously verified unsigned Portable candidate also remains byte-identical to its recorded SHA-256 and its isolated GUI result remains valid because this branch differs from the Portable product source only by INT-06 documentation.

This is **not a public- or school-distribution GO**. Code signing, school IT policy approval, and NSIS install/upgrade/uninstall QA remain release blockers. Live provider login/logout and external AI calls remain explicitly NOT RUN and must not be inferred from synthetic automated coverage.

## Frozen source and environment

- Candidate branch: `integration/int-06-beta-release-gate`
- Candidate source SHA: `78553b32bd4aba5114d34c6de35adae1f54c1bae`
- Product source SHA: `d03a58fa7f73411aa2cdb9ebd31c0d8527e21947`
- Candidate/product difference: only `docs/integration/INT-06-BETA-RELEASE-GATE-PLAN.md`
- Product: `BOGUNON DESK 2.0`
- Version: `2.0.0-beta.1`
- appId preserved: `kr.sungandi.schoolhealthdesk.electronp0`
- PROFILE_NAME preserved: `BOGUNON-DESK-ELECTRON-P0`
- Electron: `45.2.1`
- electron-builder: `26.18.0`
- Node/npm: `v22.23.3` / `10.9.9`
- Lockfile SHA-256: `DE950E78BF719EC3279187AAA52B847880F2D87AFB28081B1087BE00D50ED3A3`
- Builder config SHA-256: `0BCDF9C54435EF691A9EBB40901ADDE74BEDFD5E26F260B3E2655E474583486B`
- Electron package metadata SHA-256: `AF27080389733F07468185F294467B6F5E42FF011FF166B8CA8B968D9555355F`

The independent source directory, QA logs, TEMP/TMP, npm cache, and build evidence were kept on `F:`. Tests ran serially with one worker and file parallelism disabled. No administrator elevation, Windows policy change, live account, student data, or external AI call was used.

## Verification results

### Static and focused verification

| Gate | Result |
| --- | --- |
| TypeScript `tsconfig.json` | PASS |
| TypeScript `electron-p0/tsconfig.json` | PASS |
| TypeScript `electron-p0/tsconfig.renderer.json` | PASS |
| TypeScript `electron-p0/tsconfig.tests.json` | PASS |
| Focused auth/Newsletter/widget/toolbox/product/Official/Record suite | 120 PASS / 0 FAIL / 1 legacy SKIP |
| Electron product build | PASS |
| Runtime package contract | 3 PASS / 0 FAIL / 0 SKIP |
| `git diff --check` before report | PASS |

The first fixture preparation attempt set a global `CARGO_TARGET_DIR`. Cargo succeeded, but the approved fixture script copies from each tool's repository-local `target` directory and therefore failed with source-file `ENOENT`. The retry removed only that override; all tool targets remained on `F:` because the independent repository itself is on `F:`. Preparation then passed. The first runtime-package invocation occurred before Electron staging existed and reported one environment-ordering failure; after the approved Electron build, the unchanged runtime package test passed 3/3. Neither event is classified as a product failure.

Fixture preparation also executed the approved native synthetic suites:

- Purchase Excel Rust fixture: 59 PASS / 0 FAIL
- Record Helper Rust fixture: 16 PASS / 0 FAIL

### Complete current-source regression

| Suite | Files | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: | ---: |
| Electron + Dashboard + Dock | 173 | 1,172 | 0 | 3 |
| Newsletter | 59 | 336 | 0 | 0 |
| Combined current-source JS/TS regression | 232 | **1,508** | **0** | **3** |

The three SKIP cases are identical Windows/platform limitations already present in the approved suite; no test was newly skipped or changed:

1. `electron-p0/tests/file-drop.test.ts` — `rejects actual permission errors without extraction`; guarded by `process.platform === 'win32'` because POSIX `chmod(0)` denial cannot be reproduced on Windows.
2. `electron-p0/tests/record-helper.test.ts` — `terminates only its owned extraction process on timeout/cancel and waits for close`; explicitly guarded on Windows because its executable shell-script fixture is POSIX-only.
3. `electron-p0/tests/work-folders.test.ts` — `reports actual denied directory access without invoking the opener`; guarded by `process.platform === 'win32'` for the same POSIX permission-model reason.

The JSON evidence hashes are:

- Electron regression JSON: `814AEDA78537413D3C2653AD64A547586EBE0BE25F2426F18A8FC1B366B8376C`
- Newsletter regression JSON: `6DD41636A3BFF887F8F375AEDD52A7A3D00FDD60F38F3B01681B0662214A475D`

The earlier INT-03 `1,520 PASS` is not reused or represented as an INT-06 result.

## Portable channel evidence

The existing INT-05B x64 Portable candidate was re-hashed without rebuilding or modifying it:

- File: `BOGUNON-DESK-2.0.0-beta.1-win-x64.exe`
- Product source: `d03a58fa7f73411aa2cdb9ebd31c0d8527e21947`
- Size: `195,448,777` bytes
- SHA-256: `3D9E193E6927BDE2487292B81ABF26CFEABB8F7C5CD51A052F2A84830EFA4C94`
- Product name: `BOGUNON DESK`
- Version: `2.0.0-beta.1`
- Isolated synthetic-profile GUI: PASS
- Window title: `BOGUNON DESK`
- Horizontal overflow: `0`
- Advanced diagnostics collapsed by default: PASS
- Graceful shutdown with empty stderr: PASS
- Authenticode: unsigned

The INT-06 candidate adds documentation only, so its executable product tree is identical to the verified INT-05B source. No new Portable or installer was produced in INT-06.

## NSIS per-user configuration and required QA

Current Builder 26 configuration:

- Target: Windows x64 `portable` and `nsis`
- `oneClick: false`
- `perMachine: false`
- `allowElevation: false`
- `allowToChangeInstallationDirectory: false`
- `runAfterFinish: false`
- `deleteAppDataOnUninstall: false`
- Shortcut/uninstall display name: `BOGUNON DESK`
- Installer artifact: `BOGUNON-DESK-Setup-2.0.0-beta.1-x64.exe`
- Executable signing disabled; icon/resource editing remains enabled

This is an assisted **per-user** installation design. It should install beneath the current user's local application area without elevation, use the existing appId/profile, and preserve app data on uninstall. These are configuration-level conclusions only; no installer was generated or executed in INT-06.

Fresh approval and a school-IT-permitted, non-administrator test account are required for:

1. Clean install and first launch with a synthetic profile.
2. Upgrade over the same appId from the approved prior beta candidate.
3. Verification that settings, widget layout, memo, and local work data survive upgrade.
4. Uninstall verification: binaries and shortcuts removed while `%APPDATA%\BOGUNON-DESK-ELECTRON-P0` remains intact.
5. Reinstall verification that the preserved profile is restored without migration or reset.
6. Start menu, desktop shortcut, Programs and Features entry, title, icon, tray, Alt+Tab, and file properties.
7. Failure/cancel paths and confirmation that no administrator prompt or machine-wide write occurs.

## Signing and school IT policy

The candidate is unsigned. Windows may display SmartScreen or unknown-publisher warnings, and school endpoint controls may block execution, download, installation, or child helper processes. No warning or policy should be bypassed.

Before distribution beyond controlled internal QA:

- obtain an approved Windows code-signing certificate and protected signing procedure;
- sign the final EXE/installer and verify Authenticode chain, timestamp, file hash, publisher name, and post-sign execution;
- obtain written school IT approval for installation scope, helper processes, local loopback callbacks, profile location, network destinations, and update policy;
- repeat package inventory and Portable/NSIS launch QA on the exact signed bytes.

## NOT RUN and release blockers

| Item | Status | Release impact |
| --- | --- | --- |
| NSIS install/upgrade/uninstall/reinstall | NOT RUN | Blocks installer release |
| Code signing and signed-byte QA | NOT RUN | Blocks normal school/public distribution |
| School IT policy approval | UNKNOWN | Blocks school deployment |
| Live server login/logout | NOT RUN | Blocks claim of production account readiness |
| External AI provider calls | NOT RUN | Blocks claim of live AI readiness |
| Physical tray clicks on final installed build | NOT RUN | Required in installer GUI QA |
| Native Attachment OPTION C | DEFERRED / NOT RUN | Not part of beta.1 gate |
| GitHub Release, main merge, public deployment | NOT RUN | Requires separate approval |

## Release decision

- **Internal unsigned Portable QA with synthetic data:** conditionally acceptable only for explicitly approved technical testers who understand the unsigned warning and school policy constraints.
- **School-user Portable distribution:** NO-GO until signing and school IT approval.
- **NSIS distribution:** NO-GO until approved install/upgrade/uninstall QA passes on the exact candidate.
- **Public beta/GitHub Release:** NO-GO until signing, policy, final package verification, and explicit release approval are complete.

No product source, schema, user data, protected branch, main branch, Release, or deployment was changed by this gate.
