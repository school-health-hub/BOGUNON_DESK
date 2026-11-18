# INT-03 출근 인계 상태 — 2026-11-18

## 학교 PC 최종 검증 및 원격 보존 후보 — 2026-11-18

**최종 기술 판정: PASS (승인된 INT-03 범위). 제품 통합·정식 패키징·배포는 NOT RUN.**

- 검증 브랜치/기준 HEAD: `integration/int-03-p2-hardening@772b5fa36ad4eba42c17b15db07b6b183ac33604`와 이 문서에 열거한 scoped diff.
- 검증 전 소스 기록: `F:/BOGUNON_DEV/build-cache/source-4946ec610b60/int03-final-regression-20261118/source-before.json`, SHA-256 `A481D770C058442FD5C21E000452AECE1035E55E79E0CBDB08B03155794677C9`. 전체 회귀와 패키지 검사 후 기록 대상 파일이 모두 동일했다.
- 공식 fixture 준비: Purchase Rust 59 PASS, Record Rust 16 PASS, Official Document/Record CLI 생성 PASS. 처음에는 전역 `CARGO_TARGET_DIR` 때문에 기존 스크립트가 기대하는 상대 경로를 찾지 못했으나, 소스가 있는 F: 안의 기본 target을 사용해 공식 스크립트를 다시 실행하여 PASS했다. 제품 결함이나 소스 수정은 없었다.
- 최종 Electron+Newsletter 전체 회귀: **233 test files / 1,520 PASS / 0 FAIL / 3 SKIP**, worker 1, 파일 병렬 실행 없음. JSON SHA-256 `10BE22E2710546C39BB479F5A9936F20D306FAE62F175DECCAEBE2D9B2ED287A`; 로그 SHA-256 `3291832D54FF7F592DB515446380CE093041048E911EB56D6E6714C698812ECB`.
- 기존 SKIP 동일성 확인: `rejects actual permission errors without extraction`, `reports actual denied directory access without invoking the opener`, `terminates only its owned extraction process on timeout/cancel and waits for close`. 새 SKIP은 없다. 관리자 권한 상승은 요청하거나 사용하지 않았다.
- 런타임 패키지 집중 검사: **3 PASS / 0 FAIL / 0 SKIP**. 로그 SHA-256 `C9FB12421EE7AFCA9437B22628299C6F9333298FFFFC84C63798EEA8E822F4A0`.
- 동일 소스의 학교 PC 선행 게이트: TypeScript 4/4 PASS, 관련 집중 검사 47/47 PASS, Electron 제품 build PASS(187 staging files), `git diff --check` PASS.

### 최종 실제 GUI/키보드 결과

- 실제 Electron 45.2.1, 합성 QA 프로필, 1440×900·1366×768·1280×720·980×700의 View/Edit 8개 상태를 검증했다.
- Floating Dock과 마지막 콘텐츠 간격, 빠른 메모 버튼 hit-test, 빠른 실행 내부 스크롤, 주간 일정 월~일 7일 표시, 13개 위젯 ON/OFF, 직접 drag/resize 저장, 무조작 좌표 저장 0회, 메모·설정·재실행 복원, 1280×720 초기/안정화 가로 overflow 0px를 확인했다.
- 위젯 콘텐츠 보고서: `int03-gui-fix-20261118/widget-content-3/report.json`(8 states, 32 captures, 122 focus measurements, 가시성·중앙 hit-test·focus 실패 0).
- 주간 일정 보고서: `int03-gui-fix-20261118/weekly-schedule/report.json`, SHA-256 `7D445D1095BBA4B3191F41EBAAC40A251BC79256B1CF35C73064770586E64F25`. 여러 합성 일정에서 실제 내부 스크롤 `scrollTop=88/max=88`, resize·재실행 상태 보존을 확인했다.
- **잔여 P2:** 주간 일정 위젯을 약 377×110으로 축소하면 텍스트가 압축된다. 내부 스크롤로 전체 내용에 접근할 수 있고 데이터 손실·조작 차단은 없어 INT-03 필수 완료 조건과 분리한다.
- 이번 최종 회귀 동안 GUI 소스 해시가 바뀌지 않아 동일 화면 QA를 불필요하게 반복하지 않았다. 실제 DPI 변경, 실제 계정 로그인, 외부 AI 호출, Native Attachment OPTION C, 정식 설치/패키징은 NOT RUN이다.

### 보존 범위

- 커밋 후보는 제품/테스트/설계 문서와 재현 가능한 QA 스크립트만 포함한다. 빌드 캐시, 임시 프로필, 캡처, 로그와 외부 증거는 Git에 포함하지 않는다.
- RC2, 다른 worktree/브랜치, 기존 사용자 프로필과 운영 앱은 변경하지 않았다. 이 절의 PASS는 INT-03 승인 범위에 한정하며 main/integration 병합이나 배포 승인이 아니다.

> 아래 `CONDITIONAL` 문단부터는 학교 PC 최종 검증 이전의 역사 기록이다. 현재 판정은 위 최종 검증 절을 따른다.

**당시 제품 판정: CONDITIONAL. 미완료 WIP이며 commit/push·통합·배포 승인 상태가 아니었다.**

- 원래 작업 브랜치/HEAD: `integration/int-03-p2-hardening@772b5fa36ad4eba42c17b15db07b6b183ac33604`.
- 이번 편집 모드 수정: 핸들34px 영역 분리, 메모/빠른 실행의 자연 높이와 내부 스크롤, 시계 가독성, 위젯 정보창 포커스 복귀, 세 위젯의 포커스 전체 표시. 저장/좌표/엔진/IPC/schema 수정 없음.
- 첫 수정본 관리자 전체 회귀: **1,527 PASS /1 FAIL /기존3 SKIP**,236 test files. 실패는 `design-07-style.test.ts`의 기존 candidate CSS 무강제우선순위 계약. 추가한 세 강제우선순위 선언이 원인이었다. 테스트를 수정/skip하지 않았다.
- 이후 CSS만 계약에 맞게 수정: 메모 fieldset은 `display: contents`로 비시각적 disabled 그룹을 유지하고, 편집기 자연 높이를 유지한다. 박스가 없는 조상은 clipping 계산에서 제외하며, 실제 중앙 hit-test/disabled 상속 검사를 QA에 추가했다.
- **최신 CSS 수정본**: TypeScript4 PASS, 집중22 files/149 PASS, Electron build PASS. 전체 회귀는 **NOT RUN**(사용자가 추가 관리자 회귀 보류). 실제 제품 GUI·DPI도 이 최신 CSS 변경 후에는 **NOT RUN**: 출근 인계로 신규 장시간 QA를 중단했다.
- 이전 수정본의 실제100% 키보드/콘텐츠80장 독립검토2건 PASS,13위젯/메모/좌표/재실행 및 마우스drag/resize PASS는 **변경 전 근거**로만 보존한다. 최신 CSS에 대한 성공으로 재사용하지 않는다. 최신 CSS QA-only 주입24장/DOM 측정은 진단 근거이며 제품 시각 PASS가 아니다.
- 마지막 실제 Windows 기록은100%/96DPI/1920×1080이며 이번 출근 인계 단계에서 배율을 변경하지 않았다. 학교 PC의 배율·해상도·권한은 별도 확인 대상이다. 집 PC의 관리자/DPI 승인은 학교 PC에 재사용하지 않는다.
- 원본6미커밋 파일은 `edit-gui-20261118/before`에 원본바이트/SHA로 보존했다. 실패 전체 회귀 소스9개는 `edit-gui-20261118/admin-qa/failed-source`와2515파일 manifest로 보존했다. 원본보고서 아래 내용은 이전 단계 기록이다.
- 원격 보존은 별도 WIP 인계 브랜치 예외 승인 전까지 금지. 기존INT-03/RC2/UX11/main refs를 바꾸지 않는다. 운영 앱/정식 설치/Native Attachment OPTION C는 NOT RUN/DEFERRED.

## 학교에서 다음 단계

새 독립 clone과 승인된 QA 증거 복원/해시 확인부터 한다. 이전 관리자 명령 파일을 그대로 실행하지 않는다. 새 환경·자원·toolchain을 확인한 뒤 일반권한 GUI/타입/빌드를 준비하고, 전체 회귀 또는 실제 DPI 조작은 학교에서 새 승인을 받아 새 source manifest/명령 파일로 실행한다. 필수 게이트가 모두 통과하기 전 제품 통합이나 최종 PASS를 선언하지 않는다.

---

## 아래는 출근 전 이전 단계의 원문 보고서
# INT-03 P2 hardening — implementation and verification report

## Verdict

**CONDITIONAL — implemented, automatic regression PASS, remaining GUI/accessibility findings. No commit or push.**

- Branch: `integration/int-03-p2-hardening`
- HEAD / remote HEAD checked 2026-11-18: `772b5fa36ad4eba42c17b15db07b6b183ac33604`
- Independent source: `E:/BOGUNON_DEV/int-03-home/source`
- INT-02 remains `fcfb180b3b7eccc89a42044c94b3d6cd45573a36`; UX-11 remains `be3b6ac35dcb07bb2a9976497b39241f343ab411`.
- Tested source: 2,513 existing file SHA-256 entries in `../admin-qa/source-before.json`; manifest SHA-256 `6C84A1DCA1E00FA58B0CD6C37708AA8DFCFB370D54EFFE12FE00595E8353D7E6`. Build metadata records HEAD above plus dirty=true; no future commit is claimed tested. This report is added after validation.
- All evidence paths below are relative to `E:/BOGUNON_DEV/int-03-home`, outside Git. They have not been transferred or published. This report is not a cross-PC handoff-ready assertion.

## Changes (five implementation/test/design files plus this report)

1. `electron-p0/renderer/design-07.css`: disable outer React Grid Layout placement interpolation only. Widget interaction surfaces and Dock motion remain unchanged.
2. `DESIGN.md`: document viewport reflow motion and saved-layout protection.
3. `electron-p0/builder.json`: exclude exactly `main/newsletter-ai-asset-storage.test.js`; keep source tests and production runtime includes.
4. `scripts/electron-p0/runtime-package.test.mjs`: reject compiled Main test leaks, assert required runtime files, permit separate evidence output and explicit runtime-root QA input.
5. `scripts/qa/int03-dashboard-scroll.mjs`: actual Windows Electron resize/View/Edit regression with elapsed timing, screenshots, output/profile guards and unchanged settings assertion.
6. This report.

No auth, Electron Main/preload/IPC, business engines, storage schema, save/merge transforms or user coordinates were modified. No blanket overflow:hidden fix.

## Root cause and before/after evidence

### Horizontal scroll

Actual INT-02 build with an isolated synthetic profile reproduced transient horizontal overflow, rather than permanently wrong saved coordinates. At980 View, width excess went569→133→0 while RGL transform interpolation settled. Existing transition covered transform/width/height for200ms. Historical delay labels represented incremental waits; final regression records actual elapsed time.

- Baseline RED:8 View/Edit states,13 overflowing samples (`qa-output/scroll-red` and baseline timeline records).
- QA-only transition intervention:32 samples, zero overflow.
- Fresh final build: `qa-output/scroll-final/report.json`,8 states/32 samples, zero page/workspace horizontal overflow, settings unchanged,8 rendered captures.
- Exact100% viewports:1440×900,1366×768,1280×720,980×700.

### Packaging test exclusion and archive limits

- Original builder file selection archived one compiled Main test; RED inventory185 entries.
- After exact exclusion:177 selected regular files,184 archive entries including directories,118 relative runtime modules, zero Main test leaks. Required Newsletter protocol/storage, Main/preload and app/tray icons retained. Node packaging checks3 PASS.
- `qa-output/package-final/app.asar` was generated by the test's builder-file-filter and relative-import graph path. It is NOT a complete electron-builder package: bare production dependencies are outside that test graph.
- Its optional cold launch FAILED with missing `zod` and no application window (`qa-output/asar-cold-launch/report.json`). The error screenshot and failure records are retained. This failure must not be described as a confirmed shipping regression.
- Installed builder26.18.0 production collection independently found root-project `zod`4.6.7 (`qa-output/production-dependency-collection/inventory.json`).
- A separate QA reconstruction used actual builder production collection/filter/copy APIs, preserved all177 original application bytes, included production dependencies, verified bare imports within staging and zero Main test leaks (`qa-output/package-with-dependencies/inventory.json`).
- Corrected QA reconstruction cold launch PASS: `qa-output/asar-with-dependencies-cold-launch/report.json`; actual archived app path, isolated UUID profile,13 widget settings, Newsletter preload bridge and980 horizontal-overflow checks. This is QA reconstruction, not full builder prepack/native resource packaging or an installed application.
- Full native bundle, installer creation/installation, signing and deployed GUI: **NOT RUN**. No release/deployment claim.

## Automatic validation (serial)

| Gate | Actual result |
|---|---|
| TypeScript root/Main/renderer/tests | All4 PASS |
| Approved prepare-tests | PASS; Purchase Rust59 / Record Rust16 PASS |
| Related focus |20 files /131 PASS /0 FAIL |
| Fresh approved admin symlink focus |14 PASS; other filtered tests are not new skips |
| Expanded Electron + Newsletter |233 files /1,516 PASS /0 FAIL /3 unchanged SKIP |
| Electron product build |PASS,109.23s |
| Packaging Node tests |3 PASS |
| Source hash comparison after full run |2,513 match |
| diff whitespace |PASS |

Node22.23.3, npm10.9.9, Electron45.2.1, Vitest5.0.1. Fresh INT-03 admin approval covered only focused14 followed by expanded full regression. Codex, preparation, Rust, TS, build and Git remained normal privilege. No extra privileged rerun.

Unchanged skips (exact names):

- rejects actual permission errors without extraction
- reports actual denied directory access without invoking the opener
- terminates only its owned extraction process on timeout/cancel and waits for close

Primary records: `admin-qa/full-results.json`, `admin-qa/full.log`, `admin-qa/focused-results.json`, `control/final-full-summary.json`, stage receipts and logs.

## Actual GUI and preservation

-100% widget flow:26 captures;13 IDs, both library entry points, keyboard Space, OFF/ON/restart, memo, layout/settings and Dock preservation PASS (`qa-output/widgets-100/attempt-1/report.json`).
- Actual pointer drag/resize and restart:PASS (`qa-output/manual/evidence/electron-manual.json`).
- Synthetic cross-feature GUI:24 captures/9 checks PASS: Newsletter draft/settings return and pending-output restriction, account logout cancellation, Official/Record cancellation draft preservation, native menu/window hide/show lifecycle (`qa-output/integration-gui/attempt-1/report.json`). Boundary dialog responses are controlled fixtures; this is not live authentication, a physical tray click or real third-party output approval.

### Actual Windows DPI (fresh approval)

| Scale | Measured | Actual content sizes | Results |
|---|---|---|---|
|125% |120DPI,zoom1,no forced scale |1440×736 and980×700; auxiliary560×700 |14 widget +8 dashboard captures; state/overflow assertions PASS |
|150% |144DPI,zoom1,no forced scale |1248×591 and980×591; auxiliary560×591 |14 widget +8 dashboard captures; state/overflow assertions PASS |
| Restored100% |96DPI,1920×1080,zoom1 |Fresh process probe |PASS; app closed |

Exact1440×900 at125/150 and980×700 at150: **NOT RUN**, exceeded physical work area/frame. Do not conflate native DPI with DPR emulation. Evidence under `qa-output/widgets-125`, `widgets-150`, `dashboard-125`, `dashboard-150`. Restore probe attempt1 failed because its external QA profile directory was absent; corrected separate attempt2 passed, original retained (`qa-output/dpi-restore/attempt-2/report.json`).

## Remaining GUI gates / P2 findings

**Zero horizontal overflow does not prove all internal content fits.** Two independent reviewers directly opened the fresh PNGs and found remaining edit-mode internal-card issues:

- Native125%,980×700 Edit: Quick Launcher fragments 업무포털 and clips the lower 이 기기 subtitle; clock branding also truncates.
- Native125/150 narrow Edit bottom: memo actions overlap textarea/placeholder; lower launcher content clips.
- Native150 Edit top: clock date clips at card bottom; wide edit weather explanation clips its final line.

Paths: `qa-output/dashboard-125/attempt-1/screenshots/dashboard-edit-bottom-980x700.png`, `dashboard-edit-top-980x700.png`; corresponding150 files at980×591/1248×591. No matched earlier DPI capture establishes whether these findings are new regressions. No demonstrated data loss or P1 blockage, but edit-mode internal-control usability remains unaccepted. Widget library visuals PASS in both review lanes; findings must not be hidden by its passing layout metrics.

### Keyboard diagnostic

- Strict1280 View focus-border assertion FAIL: textarea2px beyond workspace lower edge. Matched actual INT-02 baseline reproduces identical geometry (`qa-output/keyboard-baseline/attempt-1/report.json`), so this particular border condition is pre-existing.
- Extended text/caret-region estimate FAIL at1280:41px textarea,48px scrollHeight, second20px line box ends3px below estimated clip; actual Korean glyphs/period look readable in screenshot, but that alone does not verify caret bounds (`qa-output/keyboard-content/attempt-1`, `attempt-2`).150ms stabilization did not clear it.
- Diagnostic continuation preserved the original strict failures. View-mode all4 viewports completed actual keyboard typing/Save/return and target reach. It then FAILED in1440 Edit because textarea y739..821 exceeded visible bottom780, leaving the rest of Edit keyboard matrix incomplete (`qa-output/keyboard-diagnostic/attempt-1/report.json`). Five memo-save proofs exist; this is not eight-state keyboard PASS. Timing/measurement versus actual clipping remains unresolved.
- Do not relabel these FAILs, add skips, reset layout to defaults or claim completed accessibility. No additional product patch was applied to chase these results.

## Protection / resources / security

- Independent E: clone, normal independent node_modules (no shared link), E: caches/temp/Cargo targets and serial builds/tests. No original dependency/cache changes.
- All46 protected paths (original44 plus INT-02 and audit clone): HEAD, status, index SHA and MERGE_HEAD SHA matched checkpoint (`control/protection-after-checkpoint.json`); final check recorded separately.
- All owned successful GUI controllers report cleanup. Failed cold-launch controller completed cleanup; no unrelated process was terminated. User admin terminal itself may remain open/idle; do not assume it closed.
- Public dependency metadata only in local collector records; no source/env credentials were copied into QA output intentionally. No dedicated gitleaks/trufflehog executable available; scoped best-effort pattern scan and manual diff review are recorded separately. This is not a comprehensive secret/PII scanner guarantee.
- Existing QA evidence, profiles, ignored files and reports preserved. No remote artifact upload, Git add/commit/push, main/existing integration/RC2/UX branch modification, native attachment work or deployment.

## Next step

Keep this independent dirty branch intact. Investigate actual Edit keyboard scrolling/focus and narrow-card content with matched baseline before changing more product CSS. A further product change requires refreshed TS/build/focus/full regression, and fresh permission before any additional administrator test. Full packaged/native runtime QA remains a separate explicit scope. Only after required GUI/accessibility gates pass may the approved scoped commit/normal push be performed. No integration or main merge is authorized.
