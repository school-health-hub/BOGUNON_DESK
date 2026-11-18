# INT-04 — Windows x64 Portable candidate QA report

## Verdict

**PASS — persistent loading-state fix verified within the approved INT-04 Portable QA scope; product distribution NOT APPROVED.**

The unsigned x64 Portable candidate was rebuilt from the minimally corrected source and started and stopped normally with both an existing and a new isolated synthetic QA profile. The fully rendered dashboard now reports `PoC 설정 준비됨`; the persistent exact `불러오는 중` label is absent. Package inventory, icon resources, ASAR contents, required helpers, and the Newsletter protocol/worker files remain verified.

## Source identity

- Repository: `school-health-hub/BOGUNON_DESK`
- Branch: `integration/int-04-windows-package-qa`
- Git HEAD: `8f1eb06654899e796f590d23c0f4ae09fd19f323`
- INT-03 parent source: `a64066df2b91c2d4c772e7168d6750179904425e`
- Build source state: HEAD plus the uncommitted builder change, one-line product fix, focused test, E2E expectation updates, and this report
- Package build metadata reports `dirty: true`; therefore this candidate is identified by HEAD plus the exact builder configuration hash, not by a clean commit alone.
- `electron-p0/builder.json` SHA-256: `FFF8BC3FFB325CF241FC7635DF0367895B8EC12F055AFB441BCFCFBC287200FF`
- `electron-p0/renderer/P0App.tsx` SHA-256: `A77D3760EBBE20BC2BA71E0AEDCDC31A0618E5A00A2A8B53489F514FBE220F3F`
- `electron-p0/tests/settings-bootstrap.test.tsx` SHA-256: `77131BFA09D706F2A9E765DDD9D8F5C36754DA086F2271F1F6E267CE237585A7`
- `electron-p0/e2e/dashboard.e2e.ts` SHA-256: `FE776C3496F1C37749537FC0DA8BCBABCB09627BE2F9547D8A20B3BF18E39D79`
- `package-lock.json` SHA-256: `DE950E78BF719EC3279187AAA52B847880F2D87AFB28081B1087BE00D50ED3A3`
- Source-before manifest SHA-256: `E42F1CF7EE55A927633E3351D33646B2B8F406066921FC3F5DE18D5DE88EA6DB`

## Packaging configuration

To preserve Windows resource editing while disabling code signing, the Windows builder option was changed from:

```json
"signAndEditExecutable": false
```

to:

```json
"signExecutable": false
```

With electron-builder 26, the former disables both signing and executable resource editing, while the latter disables signing only. The official package command was:

```powershell
npm run electron:p0:package:win
```

The script explicitly selected `portable`, `x64`, and `--publish never`. No NSIS installer was generated or installed. No `npm install` or `npm ci` was run, and the lockfile did not change.

Build and dependency caches were isolated below:

`<INT04_F_BUILD_CACHE>/int-04-windows-package-qa`

`TEMP`, `TMP`, npm cache, Electron cache, and electron-builder cache were directed to that F: path. Crate-local Rust targets remained on F: under the independent source tree.

## Portable artifact

- File: `<INT04_F_BUILD_CACHE>/int-04-loading-fix/new-portable/BOGUNON-DESK-ELECTRON-P0-0.0.1-win-x64-loading-fix.exe`
- Size: `196,084,070 bytes`
- SHA-256: `17EF2A7FB4FC520869F92E12ED242220C106F9F9C9A6D9ABAF5AA3613A6EBBB8`
- Superseded pre-fix EXE SHA-256: `89EAA2833E9DB8BFBBEE46C9B904BB54DAE71FA193198C9D16AF4EC7FDC6D02E`
- Authenticode: `NotSigned` (intentional for this isolated QA candidate)
- Product name: `BOGUNON DESK ELECTRON P0`
- File/product version: `0.0.1`
- Build log SHA-256: `3E70692FD21B165D20D0DD6329FE403FC2D0034051E33828A123C605D98D79CD`

The executable icon was extracted and compared with the source ICO at 32×32. Pixel difference was zero, similarity was 100%, and alpha was preserved. The icon is the official mint B/coral sparkle symbol.

## Package inventory and static checks

- `app.asar`: present; 7,273 entries
- Main: `main/main.mjs`
- Preload: `preload/preload.cjs`
- Newsletter protocol: `newsletter-ai-protocol.js`
- Newsletter storage: `main/newsletter-ai-asset-storage.js`
- Worker files: `main/instructor-workbook-worker.js`, `renderer/export-worker.html`
- Brand resources: `tray.png`, `app-icon.png`
- Required helper packages present: ChatGPT auth, Finance, Official Document, Purchase Excel, Purchase OCR, Record helper
- Compiled Main test files in ASAR: 0
- Runtime package test: 3 PASS / 0 FAIL
- OCR integrity check: PASS
- `git diff --check`: PASS

The standard electron-builder `elevate.exe` is present in unpacked resources but was not executed. No administrator elevation or school security-policy bypass was attempted.

## Persistent loading-state correction

The status is a settings-persistence status, not the required application bootstrap indicator. `P0App` already waits for Electron identity and `loadBootstrappedSettings()` before it mounts `P0Dashboard`. `P0Dashboard` nevertheless initialized its separate status state to `불러오는 중`. When the loaded layout and dock were unchanged, the persistence effect correctly returned without writing, so nothing replaced that initial string.

The minimal product change initializes the already-bootstrapped dashboard status to `PoC 설정 준비됨`. Real bootstrap failure behavior remains unchanged: identity, settings read, invalid settings, or first-run write failures keep the dashboard unmounted and show the existing explicit error UI. Saving still transitions through `저장 중`, `PoC 설정 저장됨`, or the existing save-failure text. No account, network, authentication, layout, widget, or storage contract changed.

Failing-first evidence:

- Before fix: focused test reported 1 FAIL / 12 PASS; expected `PoC 설정 준비됨`, received `불러오는 중` after dashboard mount.
- After fix: settings-bootstrap test reports 13 PASS / 0 FAIL.
- Related focused regression: 51 PASS / 0 FAIL across settings bootstrap, account service/UI, DESIGN-07 style, and 13-widget layout tests.
- TypeScript: root plus all three Electron configurations PASS.
- Electron product build: PASS.
- Runtime package test during packaging: 3 PASS / 0 FAIL.
- `git diff --check`: PASS.

## Isolated development and Portable runtime QA

The first manual attempt used an invalid human-readable `ELECTRON_P0_TEST_RUN` value and a QA root outside the required temporary-root containment. It correctly failed with `Invalid PoC test run`. This was a QA environment input error, not a package defect. The owned failed process tree was stopped without touching unrelated processes.

The pre-fix corrected run used a UUID run ID and a user-data directory strictly inside the isolated F: temporary root. The rebuilt candidate then used the same existing profile plus a new UUID profile.

- Run ID: `f03433cb-109a-4032-9c86-3180b202164f`
- Source SHA reported by app: `8f1eb06654899e796f590d23c0f4ae09fd19f323`
- Window title: `BOGUNON DESK ELECTRON P0`
- Core navigation: rendered
- Horizontal overflow: `0px`
- Shutdown: graceful
- stderr: empty
- Owned residual Portable processes: 0
- Development Electron result SHA-256: `D9936AD14BB07295E94D7AD3D8A882B2492FA6B247318D9A8B94DB4DB63AB0FB`
- Development screenshot SHA-256: `827E9D40C7C43E5AF6945B7B47DEDE36159688D5D46A9A5044B1B0FFA1D20F04`
- Existing-profile Portable result SHA-256: `8ECF7E5EFE46A488FF62D00BF479A06F645F376A1928975D9B5B7FE3F891458B`
- Existing-profile screenshot SHA-256: `3C0EAFA19694B3484328ED3AEE6B3D1B1C3ACA7CB2AB856F4E5B34B4FFAFFBE0`
- New-profile Portable result SHA-256: `E9688110AF781EDF3A4AF84BCE1B41BEBEEA4E2D8F08BBC87768BDCACA812B87`
- New-profile screenshot SHA-256: `FEC29C7EF422873D36D08F55252DC9B58C4FE80696F94B44E7EA08853FE7DF1B`

All three corrected-source runs reported `PoC 설정 준비됨`, 13 widgets in the saved layout, 12 currently visible widgets, empty stderr, and graceful shutdown. The existing profile's layout file SHA-256 remained `DEE45F25092CF6C94D2518378C2D1EEEC81072170094B3D1033B092677E74E3B` before and after execution. The new profile created the same verified initial layout hash once.

The run used synthetic mode and an isolated profile. No real account, student data, AI call, installation, auto-update, or external deployment was used.

## Visual review

Two independent read-only passes reviewed the same live-capture evidence.

1. Korean/CJK and layout pass: PASS with high confidence. No Korean clipping, tofu glyphs, lost descenders, card overlap, dock collision, or horizontal overflow was found. The exact ready text is visibly rendered at bottom-left.
2. Source-to-render integrity pass: PASS with high confidence. The screenshot was confirmed to be a real React/Electron dashboard with live widgets and dock; source, focused test, development result, and Portable result all agree on the ready state.

The pre-fix and post-fix screenshots have identical 1424×835 dimensions. The image diff reports 1,404 changed pixels out of 1,189,040 (`diffRatio 0.0012`, similarity 100, alpha intact). The intended bottom-left status replacement and the advancing live clock account for the visible hotspots; no structural regression was found.

## Existing validation reused

The product source came from the INT-03 candidate previously validated with 1,520 PASS, 0 FAIL, and 3 existing SKIP, plus actual Electron GUI QA. The INT-04 product change is one status-initialization line, locked by a failing-first focused test and corrected E2E expectations. The full development regression was not repeated; the affected focused suite, four TypeScript configs, product build, package contract tests, development Electron, and two Portable profiles were run.

The INT-03 `1,520 PASS / 0 FAIL / 3 SKIP` result is historical parent-source evidence only. It is **not** reported as an INT-04 latest-source full-regression result.

## Final verification matrix

| Gate | Result |
| --- | --- |
| Persistent loading-label regression test | PASS — 13/13 in the focused settings-bootstrap file |
| Related focused regression | PASS — 51/51 |
| TypeScript configurations | PASS — 4/4 |
| Electron product build | PASS |
| Runtime package checks | PASS — 3/3 |
| Development Electron GUI | PASS |
| Existing-profile Portable GUI | PASS |
| New-profile Portable GUI | PASS |
| Independent visual reviews | PASS — 2/2 |
| Latest INT-04 source full regression | **NOT RUN** |
| NSIS creation and installation | **NOT RUN** |
| Live-server login | **NOT RUN** |
| External AI call | **NOT RUN** |

## Resource and protection results

- Repackaging started with approximately `1.71 GiB` free physical RAM and `16.58 GiB` free commit capacity; Windows remained responsive.
- Repackaging gate: C: approximately `18.17 GiB` free and F: approximately `220.08 GiB` free; no concurrent Electron, Cargo, Rust, or Vitest job was detected.
- INT-03 source/branch and other worktrees were not modified.
- No main/integration merge, commit, push, installer execution, distribution, admin elevation, or production deployment occurred.
- No residual owned Portable QA process remained after graceful shutdown.

## Residual conditions before release

1. Decide and apply final release product naming/versioning; this QA candidate still identifies itself as `ELECTRON P0` version `0.0.1` while the repository root version is different.
2. Establish the intended signing policy and produce a signed distribution candidate if required. This artifact is intentionally unsigned.
3. Perform any separately approved installer/managed-school-PC policy QA. NSIS creation and installation were NOT RUN.
4. Commit the exact builder configuration, product fix, tests, and report before relying on a commit SHA as the complete build identity.

This artifact is suitable only as an independently verified **Portable QA candidate**. It is not approved for product integration, school-wide installation, external sharing, or deployment.
