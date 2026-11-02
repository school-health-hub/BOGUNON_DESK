# BOGUNON DESK 2.0 Electron 기능 통합 기록

> 최신 기준은 아래 **CLOUD-G0** 절입니다. 앞부분은 이전 통합 당시의 이력입니다.

## 기준과 계보

- 통합 브랜치: `codex/electron-feature-integration`
- 선택 기준: `codex/electron-official-document`의 `f76253ee84f21b38dc6f14cfedf105f71e2cff28`
- Finder 기준: `441998419a2362d2aba4f74662d3e3145de9bae7`
- 공통 조상: `441998419a2362d2aba4f74662d3e3145de9bae7`
- Finder SHA는 공문작업실 SHA의 직계 조상이다. 별도 cherry-pick이나 충돌 해결 없이 두 변경이 모두 포함된다.

## 포함 영역

| 영역 | 통합 상태 | 확인 근거 |
| --- | --- | --- |
| Dashboard / Dock | 포함 | Electron renderer 진입점, dashboard/dock 핵심 테스트 |
| Quick Memo | 포함 | Electron IPC와 widget 진입점, memo IPC 테스트 |
| Purchase Helper | 포함 | `PurchaseSession` 진입점과 세션/도메인 테스트 |
| 보건소식지 제작소 | 포함 | lazy entry, JSON/project/export 핵심 테스트 |
| 교육영상 Finder | 포함 | `4419984`, lazy entry, Finder model/library/UI 테스트 |
| 공문작업실 | 포함 | `f76253e`, lazy entry, 생성/요약/privacy/clipboard 테스트 |

기존 Tauri 교육영상 Finder와 공문작업실 소스는 삭제하거나 대체하지 않았다. Electron은 검증된 TypeScript 계약을 선택적으로 재사용한다.

## 2026-11-02 검증 결과

- Electron TypeScript(main/renderer/tests) 및 프로덕션 빌드: **PASS** (`npm run electron:p0:build`)
- 선별 핵심 테스트: **233 PASS / 9 FAIL**. 39개 파일 PASS, 3개 파일 FAIL.
- 9개 실패는 `tools/purchase-excel-cli/target/qa-fixtures`의 생성 fixture가 이 worktree에 없는 Purchase Excel/PDF 실제 파일 연동군이다. 통합 변경으로 제품 코드를 수정하지 않고 미완료로 유지한다.
- 저장소 전체 `npx tsc --noEmit`: **FAIL**. Electron 외 기존 Newsletter global bridge 타입과 Tauri 공문 session/reference 상태 타입 불일치가 남아 있다. Electron 전용 3개 TypeScript 구성은 위 빌드에서 PASS했다.
- Windows 격리 실행: UUID `fd39b7a7-e8c9-4377-bea1-41c86c07d44e`로 앱 프로세스 시작까지 확인. Computer Use 초기화가 `failed to write kernel assets`로 두 번 실패하여 단일 실행본의 6개 화면 진입은 **NOT RUN**. 격리 프로세스만 종료했다.
- Finder와 공문작업실의 개별 Windows 기본 실행 PASS 증거는 각 원본 브랜치 검증 결과를 재사용하며 반복 QA하지 않았다.

## 미완료 범위

- Purchase PDF 실제 GUI 요약 행 재검증
- Purchase Excel/PDF 생성 fixture 기반 연동 테스트
- Newsletter 긴 제목 실제 출력과 이미지 승인 정책
- 공문작업실 ODT, PDF/HWPX/ODT 가져오기, 승인 reference, Google/AI adapter
- 통합 실행본 6개 화면의 단일 Windows 진입 확인

상세 결함 상태는 `docs/INTEGRATED_DEFECTS.md`를 기준으로 한다. PR, main 병합, 설치, 운영 배포는 수행하지 않는다.


## CLOUD-G0 — 2026-11-02 통합 안정화

- 기준/원격 확인: `codex/electron-official-document-files-integration` = `d167c934c1281cbfd9927fa94e8cc02b66d44b2f`. 변경 시작 시 clean. 별도 Cloud worktree/브랜치 `codex/cloud-g0-integration-stabilization` 사용.
- 포함 계보: P0/P1 Dashboard·Dock/창·트레이, P2 메모·Purchase CSV/Excel/PDF/품목·정산·에듀파인 출력, Newsletter JSON/이미지/출력/revision, Finder, 공문작업실, Inventory. `8f0044cd…` 7기능 기준 + `b0d3545…` 공문 파일 IPC/CLI + `d167c93…` 인계/패키징 준비가 포함된다. Tauri/기능 원본 브랜치는 병합·변경하지 않는다.

### 실패 재현과 최소 조치

| 항목 | 재현/분류 | G0 조치/판정 |
| --- | --- | --- |
| 기존 9 FAIL | 새 worktree에서 Excel UI 1, Excel service 1, PDF 7건 실패 재현(3파일 9 FAIL/8 PASS). `target/qa-fixtures` 미생성, 제품 결함 근거 없음 | `electron:p0:test`에 원본 Rust 계약 테스트의 fixture 생성과 두 fixed CLI 빌드를 선행. 테스트 삭제/skip/약화 없이 해당 17건 모두 포함한 Electron 225 PASS |
| Dashboard·Dock | 기존 pure/UI 테스트 | 10파일 47 PASS. Electron 41파일 225 PASS와 합계 **51파일 272 PASS** |
| Rust Purchase 계약 | 원본 fixture 생성·PDF 합계 행 회귀 포함 | **55 PASS**. 공문 Rust core/Windows 파일 QA는 기존 검증 재사용; 실행에 필요한 CLI만 빌드 |
| Electron 타입·빌드 | main/renderer/tests 3개 구성 및 닫힌 renderer 검사 | PASS. Tauri/auth/Supabase/MY FINANCE 금지 경계 유지; `officialDocumentSession`은 bundle에 없음 |
| 전체 `npx tsc --noEmit` | **26 오류**: Electron bridge ambient 선언이 root 범위에 없는 파생 오류 24건 + 기존 공문 session/reference 2건 | 분리 확인용 `/tmp` tsconfig에서 bridge 선언만 포함하면 기존 2건만 남음. Electron 전용 구성은 PASS. Tauri 원본/전역 타입을 억지 수정하지 않아 root 검사는 여전히 FAIL |
| 과거 Dashboard E2E bridge key 단정 | 새 `officialDocument` API를 반영하지 않은 기대값 | 승인된 명시 API를 포함한 정확한 key 집합으로 갱신. 범용 IPC 허용이나 단정 삭제 없음 |

`npm run electron:p0:test`는 Cargo·Node가 설치된 새 worktree에서도 원본 생성 자료를 준비하고 Electron/Dashboard/Dock 테스트를 실행한다. 다른 worktree의 target/fixture를 복사하지 않는다. 개별 `vitest` 직접 실행 전에는 `node scripts/electron-p0/prepare-tests.mjs`가 필요하다. 데이터 파일은 합성 fixture와 UUID PoC 프로필만 사용한다.

### 통합 진입 현황

| 진입점 | 코드 포함/Cloud 근거 | 단일 Windows 실행본 진입 |
| --- | --- | --- |
| Dashboard | 기존 위젯·설정/레이아웃 테스트 PASS | **PASS** (G0 Windows CI) |
| Dock | 기존 UI/저장 테스트 PASS | **PASS** (G0 Windows CI) |
| Quick Memo | memo IPC 및 기존 테스트 PASS | **PASS** (G0 Windows CI) |
| Purchase | fixture 준비 후 가져오기·출력·편집 테스트 PASS | **PASS** (G0 Windows CI) |
| Newsletter | 프로젝트/JSON/출력 경계 테스트 PASS | **PASS** (G0 Windows CI) |
| Finder | model/library/UI 테스트 PASS | **PASS** (G0 Windows CI) |
| 공문작업실 | 기존 파일 처리 CI `41401980509` PASS, **Windows 실기기 QA PASS(사용자 보고, 이번에 재실행하지 않음)** | **진입 PASS**; 파일 대화상자 QA 재실행 아님 |
| Inventory | store/model/workspace 테스트 PASS | **PASS** (G0 Windows CI) |

### 검증 범위와 잔여

- 새 Windows CI는 이 자동 테스트·타입/production build와 **8개 진입만** 수행한다. 설치/제거·반복 파일 처리·전체 심층 Windows QA를 수행하지 않는다. 단일 인스턴스/UUID 프로필, sandbox/contextIsolation 유지, 범용 IPC 노출 없음.
- Cloud에는 GUI 세션이 없어 실제 Electron GUI는 NOT RUN. 이를 Windows/단위 테스트 PASS로 대체하지 않는다.
- 실제 제품 실행 코드 변경은 **없음**. 확인된 9건은 준비 경로 결함이므로 개발 검증 경로만 수정했다. Windows 진입 중 제품 결함이 재현되면 별도 기록한다.
- 전체 저장소 Tauri 타입 2건, Newsletter 실제 출력/자산 승인 검증, Purchase PDF 실제 GUI 요약 행 재검증 등 기존 잔여를 미검증 상태로 유지한다. 승인 reference/AI, Calendar 운영 연계, Inventory↔Purchase 자동 입고, 계정/운영 DB/MY FINANCE는 신규 구현하지 않는다.
- 다음 우선순위: 통합 진입 CI 잔여 → Newsletter 승인된 합성 자산/실제 출력 계약 검증 → Purchase PDF 실제 GUI 요약 행 확인 → 기존 기능의 다음 이식(공문 reference는 별도 승인·계약 확인 후). Calendar/운영 동기화는 데이터/인증 전략 확정 전 DEFER.


### CLOUD-G0 최종 증거와 판정

- 검증 코드 SHA: `dd987b1`(정확한 SHA는 아래 remote/최종 보고로 확인). [Windows CI 41405828621](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41405828621) **SUCCESS**: fixture 준비·통합 자동 테스트, Electron TypeScript/production build, 8개 진입 smoke 모두 통과. `CLOUD-G0-entry-evidence-<검증 SHA>`에 스크린샷/실패 시 trace를 보존한다(7일).
- 실제 Electron 하나의 UUID 격리 프로필에서 8개 화면/내비게이션 및 Dashboard 복귀를 확인했다. 승인된 preload key 집합, Node require 비노출, no-sandbox 우회 없음, renderer pageerror 없음도 확인했다. 파일 열기/저장/학교 자료/원고/이미지 출력·설치/제거는 이 smoke에서 실행하지 않았다.
- Cloud 자동: **272 PASS(51파일)**, Rust Purchase **55 PASS**, Electron 전용 3개 TypeScript 구성·production build PASS. 처음의 9 FAIL은 모두 준비 경로 문제로 해소했다. 테스트를 삭제·skip·disable하거나 assertion을 제거하지 않았다. 실제 제품 로직 수정은 없으며 `src/`·`src-tauri/` diff는 비어 있다.
- 전체 root TypeScript **FAIL 26건**(Electron ambient 범위 24 + 기존 Tauri 상태/동작 계약 2)은 별도 결함으로 남긴다. bridge 선언을 포함한 임시 진단에서는 2건으로 줄어드는 것을 확인했으며 임시 설정을 저장소에 반영하지 않았다.
- **G0 통합 진입·회귀 검증 PASS / Electron 전체 CONDITIONAL**. Newsletter 실제 출력·승인 자산, Purchase PDF GUI 요약 행 등 기존 잔여를 완료로 승격하지 않는다. 공문 파일 Windows 실기기 QA PASS는 사용자 보고와 기존 증거를 재사용하며 재실행하지 않았다.
- 마감 커밋은 문서만 갱신하고 `[skip ci]`로 불필요한 반복을 피한다. 신규 기능/의존성/QA 프레임워크/운영 데이터 접근/PR/main 병합/배포는 없다. 후속 이식은 위 우선순위와 결함 목록을 기준으로 새 승인 범위에서 진행한다.

## CLOUD-G1 — 통합 안정화 및 Windows QA 인계 (2026-11-02)

기준/원격은 `codex/cloud-g0-integration-stabilization@27ffc44cc9986984af0a7e4500b626fb7edc9b6e`, 시작 시 clean·차이 없음. 별도 브랜치/worktree `codex/cloud-g1-windows-qa-handoff`에서 작업한다. 이 절이 과거 현황보다 우선한다.

### 실제 진입과 저장/IPC 매트릭스

업무·대시보드 화면은 **7개**(Dashboard/Memo/Purchase/Newsletter/Finder/Official/Inventory), 보조 패널 **2개**(설정/업무 도구)다. Dock은 별도 화면이 아닌 공통 내비게이션이다. G0의 8개 검증 대상은 업무 화면 7개+Dock을 센 것이다. 진입 수를 신규 기능 수로 표시하지 않는다.

공통 프로필은 `%APPDATA%\BOGUNON-DESK-ELECTRON-P0`, QA는 그 아래 `test-runs/<UUID>`다. 아래 경로는 이 프로필 기준이다.

| 실제 진입 | 현재 연결/저장 | 명시 API/미이식 범위 |
| --- | --- | --- |
| Dashboard / Dock | 홈·위젯/배치·편집; `poc-settings/layout.json`, 창/트레이 `desktop.json` | `electronP0.info/readSettings/writeSettings`; 운영 일정·업무 데이터는 빈 adapter, 실제 바탕화면 부착 제외 |
| Quick Memo | Dock 빠른 메모; `work-data/quick-memo/memo.json` | `memo.read/write`, 8천자 검증·안전 저장; 계정 동기화 없음 |
| Purchase Helper | 업무 도구/기존 Purchase action; 품목·품의·정산 **세션 전용**; 선택한 외부 CSV/XLSX | `purchase.pick/map/cancel*`, export/preview/clipboard; 기존 Rust CLI 재사용. 영구 품목 이관/계정·Inventory 자동 입고 제외 |
| Newsletter Studio | 설정→보건소식지; `work-data/newsletter-projects/<id>.json` revision, 사용자 선택 JSON/PNG/PDF | `newsletter.projects.*`, saveJson/exportOutput; pending 자산 출력 차단, 원본 이미지 재연결 필요. 실제 승인 자산/출력 QA 잔여 |
| Education Video Finder | 업무 도구; `work-data/education-video/library.json` 및 backup | `educationVideo.load/save/import/export/recover`; 합성 Mock 중심, 운영 검색/계정 연계 없음 |
| Official Document | 업무 도구 및 선택 Dock ‘공문 작업실’; 원고 세션 전용, `work-data/official-import-tmp` 정리 후 사용자 선택 새 ODT | `officialDocument.pick/save/cancel`, PDF/HWPX/ODT 텍스트 반입·내장 home-v1·원고 보존·no-clobber·구조 검사. 수동 템플릿/제목 기반 파일명/reference·AI 제외 |
| Inventory | 업무 도구; `work-data/inventory/inventory.json` 및 backup | 기존 `inventory.load/save` 합성 로컬 최소본만 포함. **Cloud B RPC/RLS/migration/신규 기능 미통합·인계 대기**, 임의 merge 없음 |
| 설정 | Dock 설정, 앱 정보·합성 IPC 진단·Newsletter 연결 | 기존 설정 API·`sample.summarize`만 사용; 운영 로그인/업데이터 없음 |
| 업무 도구 | Dock 업무 도구에서 기존 4개 도구 연결 | 별도 업무 데이터 저장 없음; 공유된 전용 상태/브리지로 연결 |
| 나머지 Dock action | 온라인 보건실/BOGUNON/업무 폴더 등은 미지원 안내 | 운영 앱/웹·계정에 연결하지 않음. 이를 동작 기능으로 세지 않음 |

저장소 루트/파일명은 위와 같이 서로 다르며 자동 이관/공유 운영 DB가 없다. 외부 저장 대화상자는 사용자 지정 위치이므로 QA 자료는 별도 합성 폴더만 사용한다. renderer build의 닫힌 의존성 검사에서 Tauri/auth/Supabase/MY FINANCE 모듈 혼입을 거부한다. Tauri app ID `kr.sungandi.schoolhealthdesk`와 Electron `kr.sungandi.schoolhealthdesk.electronp0` 및 프로필을 구분한다. 기존 Electron PoC 설치/설정과의 교체를 피하려고 이번 실기기 인계는 **설치 없이 Portable+UUID 프로필**을 우선한다.

### 확인/최소 수정

- **WIN-QA-04 파서는 이미 해결됨**: `03e31e260d1edad656e704d63283544926a455a0`, `engine.rs:is_total_row`와 기존 `skips_win_qa_04_labeled_summary_without_dropping_legitimate_names`가 포함된다. 합계표 보관함/소계용 계산기 같은 정상 품목은 남긴다. 파서 제품 코드는 수정하지 않았다.
- 실제 Unicode 합성 PDF `win-qa04.pdf`(4개 합성 품목 + `예상 합계: 23,500원`)를 기존 생성기로 추가했다. 기존 필터를 실제 PDF→Rust CLI→품목 UI로 검증한다. 정확히 4개/23,500원, 다섯 번째 품목 없음. 배포 candidate에 이 합성 PDF를 함께 보존한다.
- 실제 연결 결함 두 곳만 수정: optional Dock `official-document`가 미지원 안내로 빠지던 라우팅을 기존 화면에 연결; Windows 개발 실행 Purchase CLI 경로를 원래 test 준비의 native `target/debug`와 일치시키고 dev 스크립트에서 두 CLI를 선행 빌드한다. release target/서명/운영 경로는 변경하지 않는다.
- 공문 home-v1 원본·구조/취소·원고 보호는 그대로. Tauri DOC-V2-P11 (`6f26310…`, Actions `41318375451`, 사용자 제공 GUI EXE SHA256 `C1F244633B21993B344577632F41D6AF9E8E4BB2A381CF73B6D36EC4D5B8971E`)은 **Tauri 독립 증거**이며 Electron PASS로 전환하지 않는다. 최신 Tauri GUI ODT의 K-에듀파인 재검증과 Electron 생성 ODT의 확인을 자동 PASS 처리하지 않는다.

Cloud 결과: **273 PASS(51파일)**, Rust Purchase **56 PASS**, Electron TypeScript(main/preload/renderer/tests)·production build PASS, 실제 CLI smoke PASS. Windows 결과·최종 SHA/후속 실기기 항목은 [G1 QA 인계](qa/CLOUD_G1_WINDOWS_QA_HANDOFF.md)에 기록한다. 기존 공문 실기기 QA는 반복하지 않으며 전체 Windows GUI/설치·제거 QA도 재실행하지 않는다.

### G1 최종 결과

[Windows Actions 41409674837](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41409674837) **SUCCESS**, 검증 구현/후보 SHA **`571ac15e5600251e7140a21c7938d6d5e6a2ff37`**. Portable/NSIS 생성·fixed CLI 포함 및 smoke, packaged EXE의 기존 8개 대상/보조 패널과 optional 공문 Dock·WIN-QA-04 PDF→UI(4개/23,500원) PASS. native 파일 선택창은 test double이므로 실기기 native dialog QA는 NOT RUN이다. 기존 합계 행 파서 변경은 필요 없었고, 두 실제 연결 결함(Dock/개발 CLI 경로)만 최소 수정했다. root 타입 26건은 G0와 동일하게 남는다. **전체 CONDITIONAL / 실기기 QA 후보 확보**이며 설치/제거·전체 GUI·공문 파일 독립 QA는 반복하지 않았다. 아티팩트/격리 실행/실기기 확인 항목은 G1 QA 인계 문서를 따른다. Inventory Cloud B는 최종 계약/검증 인계를 기다리며 이번에 병합하지 않았다.

## Cloud A Inventory Preview 통합 (2026-11-02)

- 기준: A `codex/cloud-g1-windows-qa-handoff@723e301446b06af9690a91df6cbd724549710d8d`, B `codex/inventory-im2b1-cloud-b@ef0ba64cae5c0a6ccbba05a8821a80730dcfc087`. 시작 시 두 원격 SHA 일치·A clean 확인. 독립 로컬 worktree/브랜치 `codex/cloud-a-inventory-preview` 사용. **원격 push/PR/병합/배포는 승인되지 않아 실행하지 않는다.**
- 업무 도구에 **물품관리 — 로컬 저장**과 **물품관리 — 미리보기**를 독립 메뉴로 제공한다. 기존 메뉴·Dock 구성은 유지한다. 기존 로컬 화면은 원본 InventoryWorkspace/model과 inventory.load/save·JSON 저장소를 그대로 사용한다. Preview 화면 안에서는 합성 adapter만 사용하며 `preview_only`, `persisted:false`, 실제 저장/DB 기능 없음이 표시된다.
- B의 합성 의존성 4개+기존 Panel/WorkflowDialog 2개, CSS만 선별 재사용했다. 원본 import 관계·해시·변경 내역은 `electron-p0/renderer/inventory-preview/PROVENANCE.md`와 `source-hashes.json`을 따른다. B 전체 merge/cherry-pick, connection/**·인증·RPC·운영 설정 복사는 하지 않았다.
- Preview 기능: 재고 요약/품목·검색·필터/상세·로트·유효기간/등록·입고·사용·폐기·정정·구매 후보 입력 확인. 결과는 미리보기 검증이며 서버 저장 성공을 표시하지 않고 재고도 바꾸지 않는다. 기존 로컬 저장과 B Preview의 의미가 다르므로 데이터를 섞거나 자동 변환하지 않는다.
- 격리: 별도 타입·fixture·adapter, Local/Preview 별도 lazy mount로 UI 상태 폐기. Preview 입력값을 inventory.save로 전달하지 않는다. 전환 후 기존 JSON·backup 바이트 보존, 로컬 입고 저장 및 재조회 PASS. Preview 최초 진입 시 inventory.load/save와 fetch/XHR/WebSocket 호출 없음. source scan과 renderer boundary에서 B connection/transport·Supabase·Tauri 혼입을 차단한다.
- CSS: 동일 클래스 충돌을 확인해 Preview selector를 모두 한정했다. 기존 CSS/디자인/로컬 소스는 변경하지 않는다. B의 900/620px 반응형 규칙을 유지하고 작은 창 header wrapping을 추가했다. **실제 좁은 창 렌더링은 NOT RUN**이며 DOM/CSS 검증을 시각 QA PASS로 표시하지 않는다.
- 검증: Inventory/B UI 재사용/격리·경계, 기존 JSON/store·IPC/policy/settings/memo, Dashboard/Dock 관련 **101 PASS / 20파일**, Electron TypeScript(main/preload/renderer/tests)·production build PASS. 비밀키/JWT/private key/한국 전화번호·주민번호 고확신 패턴의 best-effort 검사와 git diff --check PASS. 전용 외부 DLP 도구를 설치하지 않았다.
- GUI: sandbox를 유지한 headless Electron 1회 시도는 **BLOCKED / NOT RUN**. 마지막 오류 `Process failed to launch!`, 화면은 실제 시작되지 않았고 해당 작업의 실행 중 Electron 프로세스도 발견되지 않았다. 원인은 확정하지 않았다. 추가 설치/권한 확대/no-sandbox/재시도 없음. 새 Preview E2E와 기존 메뉴 명칭 기대값은 준비했으나 GUI 실행 성공을 주장하지 않는다. 이전 G1 Windows CI PASS는 이번 변경의 PASS로 대체하지 않는다. Windows CI/패키징은 이번에 NOT RUN(미푸시).
- **최종 CONDITIONAL**: Preview 구현·집중 자동 검증 완료, GUI/실제 좁은 창 확인 대기. Cloud B 추가 변경 요청 없음. 실제 PostgreSQL/Auth/RLS 검증 및 향후 Electron transport/origin 계약은 별도 후속 단계이고, Local QA·운영 연결은 계속 차단한다. Inventory B 파일·기존 JSON·Finance/Desktop Surface/Purchase/공문/Finder/Tauri는 변경하지 않았다.
- 현재 G1 인계 아티팩트에는 이 Preview 변경이 들어 있지 않다. 이번 결과는 로컬 체크포인트만 보존하며 원격 공유·CI는 별도 승인 후 진행한다.
