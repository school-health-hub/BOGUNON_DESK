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
