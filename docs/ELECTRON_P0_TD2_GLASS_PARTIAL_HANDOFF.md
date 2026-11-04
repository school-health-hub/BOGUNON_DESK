# Electron P0 TD2 Soft Rose Glass PARTIAL 체크포인트

작성일: 2026-11-04 (KST)
판정: **PARTIAL — 검증된 체크포인트 보존 완료, 전체 위젯 콘텐츠 표시와 실제 OS DPI 검증은 미완료**

## 1. 범위와 고정 기준

이 문서는 Electron P0의 현재 검증 상태와 다음 기능 개발의 재개 지점을 기록한다. 제품 코드, [`DESIGN.md`](../DESIGN.md), 기존 QA 증거를 변경하거나 Workflow SUCCESS를 제품 GUI 전체 PASS로 승격하지 않는다.

- Repository: `school-health-hub/BOGUNON_DESK`
- 제품 브랜치: `codex/td2-glass-portable-layout-fix`
- 검증 제품 Source SHA: `3440dd119225280a949d9a9f2a05d79c463f798b`
- QA 제어 브랜치: `codex/td2-soft-rose-windows-gui-qa`
- QA 제어 SHA: `ac7ec539376bac99269103f08a472bd2873a20ce`
- Windows Run: [41767487237](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41767487237) — Workflow `SUCCESS`
- Portable EXE SHA-256: `18610c4295ee2061c26ae8bd97b2d9619615b3679b076fde6863dcf435eee3f8`
- 공식 디자인: [`DESIGN.md`의 TD2 Soft Rose Glass](../DESIGN.md#td2-soft-rose-glass--approved-electron-p0-standard)

문서 전용 체크포인트가 추가되어도 위 제품 SHA와 QA 제어 SHA가 검증 기준이다. 문서 커밋 HEAD를 제품 검증 SHA로 대체하지 않는다.

## 2. 검증 판정

### PASS

- TD2 Soft Rose Glass 디자인 승인 기준 유지: 로즈·모브 배경, 18px Glass blur, 반투명 카드, 상단 하이라이트, 다층 그림자, 유리 Dock과 기존 위젯 정체성.
- 승인 SHA 기반 Windows Portable 빌드·실행과 F: QA 전용 `userData` 격리.
- 실제 content viewport 1424×835(1440×900 native bounds), 1264×735(1280×800 native bounds)에서 document/dashboard/workspace 세로 overflow 없음.
- 두 viewport에서 월간 달력 내부 스크롤 없음, Dock 표시·접근 가능, Dashboard/Dock 겹침 없음.
- Quick Memo·업무 도구 버튼 actionability, 정상 종료, 잔여 QA 프로세스 0개.
- 집중 테스트 30/30 PASS 및 Electron renderer build PASS. 이는 기존 실행 기록이며 이 문서 작업에서 재실행하지 않았다.

### PARTIAL / 미해결

- 일부 작은 카드의 내부 스크롤이 남아 있다.
- 1280×800에서 Quick Memo 보조 동작과 Quick Launcher 하단 콘텐츠 일부가 즉시 보이지 않는다.
- 따라서 [`DESIGN.md`](../DESIGN.md)의 엄격한 전체 위젯 콘텐츠 표시·nested card scroll 금지 계약은 아직 충족하지 않는다.
- Actions Workflow 자체는 SUCCESS지만 제품 GUI 전체 PASS와 동일하지 않다.

### NOT VERIFIED

- 실제 Windows OS DPI 125%와 150%. `deviceScaleFactor`, CSS zoom 또는 캡처 확대 결과로 대체하지 않는다.

## 3. 증거와 무결성

- GitHub Actions artifact: Run 41767487237의 `td2-soft-rose-portable-gui-41767487237-1`
- 학교 PC 보존 경로: `F:\BOGUNON_QA\qa-output\td2-layout-fix-actions-run-41767487237\td2-soft-rose-portable-gui-41767487237-1`
- 증거 구성: 10 files, 1,584,153 bytes
- `SHA256SUMS.txt` SHA-256: `b2c9855f6b4e7c409f0024a201767710e1d920c363aa96fb52ca04d5a9634dea`
- 핵심 파일: `portable-gui-result.json`, `portable.json`, `process-cleanup.json`, `provenance.json`, `windows-dpi.json`, 두 viewport PNG, 로그와 SHA inventory.
- manifest 항목 9개의 로컬 재계산 결과 mismatch 0. 원본 artifact와 기존 승인 캡처는 덮어쓰지 않았다.

학교 PC의 F: 경로는 machine-local이다. 다른 PC에서는 GitHub Actions artifact를 내려받아 `SHA256SUMS.txt`부터 검증한다.

## 4. 현재 Electron 기능 인벤토리

아래는 현재 제품 SHA에서 확인한 사실이다. 상세 계보와 기존 검증 한계는 [`ELECTRON_FEATURE_BASELINE.md`](ELECTRON_FEATURE_BASELINE.md)와 [`ELECTRON_FEATURE_INTEGRATION.md`](ELECTRON_FEATURE_INTEGRATION.md)를 따른다.

| 기능 | 현재 구현과 Electron 연결 | 기존 근거 / 남은 경계 |
| --- | --- | --- |
| 메인 화면 | `electron-p0/renderer/P0App.tsx`가 Dashboard, Dock, 설정과 업무 도구를 구성 | TD2 Portable layout은 본 문서의 PARTIAL 판정 유지 |
| 공문작업실 | `src/official-document`, Main 파일 IPC/CLI, lazy route와 optional Dock 연결 | `e23ccff…`, `b0d3545…`, `571ac15…`; PDF/HWPX/ODT 반입·새 ODT 저장 경계 포함. reference/AI 및 최신 K-에듀파인 재검증은 별도 |
| Purchase Helper | `electron-p0/renderer/purchase`, Main import/export·Rust CLI, 업무 도구 route | `84198b5…`, `c6a31e0…`; 세션 품목·품의·정산·출력과 Inventory handoff 포함. 운영 재고 자동 입고 금지 |
| Inventory | local JSON store, synthetic Preview, Local QA 경계와 `InventoryHost` route | `8f0044c…`, `a8f8dc1…`, `c6a31e0…`; Preview는 `persisted:false`, 실제 DB/Auth/RLS와 분리 |
| 보건소식지 | `src/newsletter`, Main project/JSON/export 경계, 설정의 lazy route | `bd22237…`, `6ad9818…`; B안·revision·PNG/PDF 계약 포함. 승인 asset과 실제 출력 잔여는 완료로 승격하지 않음 |
| 교육영상 Finder | `src/education-video`, Main library/export, 업무 도구 lazy route | `4419984…`, `84198b5…`; 합성 검색·보관함·JSON 입출력 포함. 실제 YouTube 검색은 미연결 |
| Finance | `electron-p0/renderer/finance`, Main IPC/process와 암호화 Rust 엔진 route | `5c1cfde…`; 로컬 SQLCipher/DPAPI 경계. 실제 금융정보 입력 및 cross-PC 운영 검증 전까지 개발 검증 단계 |

위 기능들은 이미 구현돼 있으므로 새 화면으로 다시 만들지 않는다. 개별 과거 테스트나 QA는 현재 제품 SHA의 새 검증으로 자동 승계하지 않는다.

## 5. 다음 기능 추천

**교육영상 Finder 실제 검색 provider 연결**을 다음 단일 작업으로 추천한다.

- 근거: Finder UI, 결과 model, 보관함, Main-owned JSON export와 Electron route가 이미 있어 재사용 범위가 크다. 현재 미완료 경계가 “실제 검색 미연결”로 명확하고 다른 업무 모듈·DB에 미치는 영향이 작다.
- 목표: 기존 Finder 화면을 유지하고 Main-owned typed provider adapter를 통해 실제 교육영상 검색 결과를 읽되, renderer에 secret을 노출하지 않는다.
- 수정 범위: Finder provider 계약, Electron Main/Preload 최소 IPC, 기존 결과 model로의 정규화, 합성 fixture 기반 테스트와 별도 Windows 단계 검증. Dashboard, TD2 재질, 저장 데이터 schema, 다른 모듈은 변경하지 않는다.
- 완료 조건: provider 미설정/오류 시 fail-closed 안내, 검색·보관함·JSON export 회귀, key/token 비노출, 합성 데이터 자동 검증, 별도 승인된 Windows GUI 검증. 실제 외부 API 자격증명·이용약관·비용 정책은 구현 전에 사용자 승인을 받는다.

이는 추천일 뿐이며 이번 체크포인트에서는 구현을 시작하지 않았다.

## 6. 다음 작업 제약과 재개 절차

1. 새 세션에서 이 문서, [`DESIGN.md`](../DESIGN.md), 제품 SHA `3440dd1…`, QA 제어 SHA `ac7ec53…`와 Run 41767487237 artifact manifest를 확인한다.
2. 제품 브랜치에서 문서 커밋과 제품 검증 SHA를 구분한다. 새 기능은 별도 `codex/` worktree/branch에서 `3440dd1…` 기반 여부를 명시한다.
3. 로즈·모브 배경, 18px blur, 반투명 rim/highlight, 다층 그림자, 유리 Dock을 유지한다. 화이트 카드형 웹 Dashboard로 되돌리거나 미해결 UI 때문에 DESIGN 기준을 완화하지 않는다.
4. P0의 profile fail-closed 격리, sandbox/contextIsolation, typed IPC, 운영 데이터·Tauri·Finance 분리와 no-clobber 저장 경계를 유지한다.
5. 남은 내부 스크롤/DPI 항목을 해결하지 않은 채 PASS로 바꾸지 않는다. 디자인 변경, 외부 API credential, 운영 연동은 별도 승인을 받는다.
6. 승인된 다음 기능만 구현하고, 관련 집중 테스트 → Electron build → 별도 Windows QA 순서로 검증한다. 기존 PASS 항목을 불필요하게 반복하지 않는다.

## 7. 보존 상태

작성 전 제품·QA 제어 worktree는 각각 clean, upstream divergence `0/0`, 진행 중 merge/rebase/cherry-pick/revert 없음으로 확인했다. 관련 제품·QA 브랜치의 PR은 확인되지 않았다. 다른 worktree와 기존 QA 자료는 수정하지 않았다.
