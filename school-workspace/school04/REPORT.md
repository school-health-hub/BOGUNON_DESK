# BOGUNON DESK SCHOOL04 구현 및 검증 결과

최종 기능 판정: **CONDITIONAL**. 공동 일정·인수인계의 로컬 PostgreSQL/RLS/RPC·인증 클래스·화면 연결을 구현하고 검증했다. 운영 Auth·PostgREST·최소권한 GRANT와 실제 Windows 실행은 NOT VERIFIED이며 운영 준비 완료가 아니다. 일반 결함은 승인된 자율 정책으로 분석·최소 수정·재검증했다.

## 1 기준 SHA와 브랜치

- 저장소: school-health-hub/BOGUNON_DESK
- 작업 시작 원격 통합 SHA: `86f4fceed7b7a8774affc0c9db556f592eaa29ba`
- 전용 브랜치: `feature/school-04-events-handovers`
- 이전 SCHOOL03 소스 SHA: `166df05dd45402cb1a7526c9ae824ec11fcdb579`
- 두 기준 차이: 소형 창 grid 수정 커밋 1개, GridLayout.tsx/soft-rose.css/grid-content-width.test.tsx 3파일. 최신 파일을 그대로 보존했다. 독립 clone을 사용했고 기존 작업 트리·통합·다른 feature는 수정/병합/rebase/reset하지 않았다.

## 2 이전 자료 복원

SCHOOL03 ZIP SHA-256 `3cbcba3a8c2cc115612209ebcf79f9385e66a85fab1ab065eb537f1c58cc4cc1`, Manifest 359항목 모두 일치. 내부 A/B/C/02 원본 ZIP 4개도 Manifest 검증했다. SCHOOL03이 이전 모든 소스·SQL·테스트를 포함하므로 한 번만 복원했다. 이전 원본 ZIP 및 작업공간은 유지했다.

상속 소스 349파일이 원본과 일치하고 누락은0이다. 변경된 상속 경계는 P0App 개발 진입점, SCHOOL03 database/session 의존성 주입 3파일뿐이다. 과거 증거 파일은 원본 바이트로 복구하고 이번 재실행 로그는 SCHOOL04 evidence에 따로 보존했다. 원본 ZIP의 과거 commit 금지 문구는 당시 정책으로 남기며 이번 사용자 자율 Git 정책이 SCHOOL04 보존에 적용된다.

## 3 신규 테이블 RLS RPC

workspace 비노출 테이블6개: shared_events, shared_event_history, handover_notes, handover_targets, handover_revisions, handover_acknowledgements. 모두 ws_owner 소유, ENABLE/FORCE RLS이며 authenticated 원시 SELECT 불가. 새 RLS 정책16개. ws_runtime/ws_authz_reader 비소유자 NOBYPASSRLS·NOLOGIN을 실제 카탈로그로 확인했다.

공개 SECURITY INVOKER wrapper13개와 목적별 private SECURITY DEFINER 구현13개를 연결한다. private helper 포함28개는 고정 빈 search_path를 적용하고 목적별 구현 이외 helper는 authenticated/anon 실행 불가다. 실행 역할을 postgres/service_role로 우회하지 않는다.

일정 RPC: ws_v1_list_events, ws_v1_get_event, ws_v1_save_event, ws_v1_cancel_event, ws_v1_list_event_history.

인수인계 RPC: ws_v1_list_handovers, ws_v1_get_handover, ws_v1_create_handover, ws_v1_edit_handover, ws_v1_ack_handover, ws_v1_complete_handover, ws_v1_list_handover_history. 추가 context: ws_v1_get_activity_context.

기존 membership_permission_overrides의 허용 permission에 handover.complete(targeted 범위)를 호환 추가했다. 기본 지원강사 권한은 올리지 않으며 현재 epoch의 명시 allow/deny를 검사한다. 기존 handover.create/다른 permission을 제거하지 않는다. 모든 SQL은 로컬 DB 전용이며 운영 migration이 아니다.

## 4 공동 일정

관리자·교사 생성/수정/취소, 지원강사 조회만 가능하다. 서버가 학교·작성/수정자·epoch·시각을 결정하고 복합 FK로 연결한다. timestamptz 저장과 Asia/Seoul 표시, 종일 Seoul 자정/exclusive 종료, UI inclusive 마지막 날짜, 종료>시작을 검증한다. 월간·목록/조회 월/상세/수정/취소/구조적 변경 이력을 제공한다. 개인 캘린더와 저장소가 분리된다.

## 5 인수인계 읽음 처리

관리자는 학교 범위, 교사는 본인 작성 또는 대상, 지원강사는 현재 revision 대상으로만 조회한다. 작성 시 유효한 membership+epoch와 역할 대상을 스냅샷으로 기록한다. 신규·재가입자에게 과거 읽음 책임을 자동 부여하지 않는다. 과거 수정 이력도 revision별 권한을 검사한다.

읽음은 현재 대상 본인만 저장하며 관리자 대행도 거부한다. 중복 ack는 한 행이다. 처리 완료는 별도 상태/권한이고 읽음을 자동 생성하지 않는다. 내용 수정 시 새 revision과 대상 snapshot을 생성하고 완료를 열며 새 읽음을 요구한다. 열린 상세도 수동/포커스 재조회 시 새 revision으로 교체한다.

지원강사는 기본 작성·수정·처리 불가. handover.create 명시 allow가 있으면 본인을 포함한 대상으로 작성만, handover.complete targeted allow가 있으면 본인 대상 처리만 가능하다. 지원강사 편집 상한은 유지한다. 교사는 현재 대상 전달사항을 처리할 수 있고, 관리자는 관리 범위에서 처리/다시 열기가 가능하다.

## 6 권한 학교 격리

현재 계정·학교·승인 멤버십·유효기간·epoch·세션을 매 요청 DB에서 확인한다. 다른 학교 ID/대상/인수인계 ID, pending/정지/회수/만료, 타인 읽음, 비허용 지원강사 쓰기를 거부한다. expected_version과 request_id를 모든 쓰기에 요구하며 NULL expected_version도 직접 SQL에서 차단한다. 같은 nonce의 다른 payload와 stale version은 충돌이다. 수정·이력·대상·receipt·audit는 하나의 트랜잭션이며 audit 오류 시 전부 rollback된다.

제목100자, 내용400자/줄바꿈3개 이하와 서버 개인정보 패턴 검증을 적용한다. 차단 원문은 audit/receipt/AI로 보내지 않는다. 탐지 완전성은 보장하지 않으므로 짧은 운영 내용만 허용하고 첨부/이미지는 제외한다.

## 7 Electron Web 화면

기존 우리 보건실에 한눈에 보기/공동 업무/공동 일정/인수인계를 추가했다. 기존 SCHOOL03 업무 UI를 재사용한다. 공동 기능에는 학교 공유, 개인 자료에는 이 PC에 저장 구분을 유지한다. 밝은 배경·네이비·로즈 카드·Lucide·48px 터치 영역을 사용한다. 목록100/이력50 제한을 화면에 안내한다.

Electron 진입점은 DEV+SCHOOL04_LOCAL 조건으로만 켜며 운영 Main/Preload 등록은 하지 않는다. 전용 IPC localOnly·sender/frame/origin 검증을 유지하고 Renderer에는 토큰을 주지 않는다. 실제 Main 클래스/React/모의 IPC→실제 로컬 DB 연결을 테스트했다. Chromium 980×700과 모바일 캡처/가로 넘침/터치 영역을 확인했다. WINDOWS REAL은 NOT RUN이다.

Web은 loopback HTTPS 정적 UI + 실제 BFF + 합성 Auth + 로컬 DB다. Cookie HttpOnly/Secure/SameSite, CSRF/Origin, refresh 동시성 등 기존 Auth 회귀를 실행한다. 테스트용 메모리 세션 저장소와 가상 provider를 운영용으로 사용하지 않는다.

## 8 테스트

| 구분 | PASS | FAIL | 근거 |
| --- | ---: | ---: | --- |
| 신규 LOCAL DB 계약 | 16 | 0 | contracts.test.ts, 실제 RLS/RPC |
| 신규 React/Main/LOCAL DB | 3 | 0 | ui-db.test.tsx, Auth/IPC/cipher MOCK |
| 신규 MOCK 상태 | 3 | 0 | state.test.ts |
| 신규 BROWSER + LOCAL DB | 15항목 | 0 | browser-results.json, 실제 BFF·합성 Auth |
| 기존 SCHOOL03 확장 스키마 회귀 | 21 | 0 | 같은 SCHOOL04 스키마 DB |
| 기존 SCHOOL02 확장 스키마 회귀 | 22 | 0 | 같은 SCHOOL04 스키마 DB |
| 기존 인증 회귀 MOCK | 59 | 0 | auth-regression.json |
| 기존 제품 집중 회귀 | 102 | 0 | 기존101 + 최신 grid 테스트1 |
| 기존 SCHOOL03/02 화면 | 13/14항목 | 0 | 각 원래 로컬 스키마에서 재실행 |
| LOCAL DB 카탈로그 불변조건 | PASS | 0 | catalog-verification.json |
| WINDOWS REAL | NOT RUN | — | 실제 Windows GUI/암호화 미검증 |
| HOSTED SUPABASE | NOT RUN | — | 운영 연결/호출 없음 |

22개 신규 Vitest와15개 브라우저 항목은 계층이 중복되므로 고유 시나리오37개라는 의미가 아니다. 과거 결과·재실행·재복원 반복도 신규 고유 테스트 수로 합산하지 않는다. 필수25항목 대응은 VALIDATION_MATRIX.md에 있다.

## 9 회귀 빌드 자율 수정

깨끗한 기준86f4fce와 현재 루트 npm run build 모두 동일 타입 오류13개로 실패한다. error 비교 문자열이 전부 일치하고 신규 오류0이다. 기존 무관한 타입 오류는 수정하지 않았다. 루트 lint/typecheck 스크립트는 없어 NOT RUN이며 별도 SCHOOL04 strict tsc, SCHOOL04 UI/서버 빌드, Electron p0 빌드는 통과했다. 실제 Portable/Windows 빌드·배포는 수행하지 않았다.

자율 수정9항목은 모두 실질적 수정1회다: 읽음 SELECT FOR UPDATE의 과잉 UPDATE RLS 요구, strict 타입/테스트 옵션 오류, 메뉴 진입 시 낡은 목록, deny override 우선순위 누락, NULL 버전 비교, 열린 상세 미갱신, 실행 중 runner 수정에 따른 Bash 읽기 오프셋 오류, 980×700에서 일정 등록이 첫 화면 아래로 밀리는 여백. 상세 원인·파일·검증은 QA_FIX_LOG.json이며 실패 원인을 숨기지 않고 수정 후 빈 DB로 재검증했다. RLS 비활성화나 광범위 GRANT를 사용하지 않았다.

기존 개인 일정 문서 불변 및 네트워크 장애 중 개인 캘린더 저장을 확인했다. 개인 일정/업무/메모/Finance/Inventory/공문/Purchase/보건소식지/Finder/포털/NEIS/eVPN/AI 연결 코드는 변경하지 않았다. Dashboard/Dock/최신 grid 수정과 WorkerW 제외를 유지한다.

## 10 운영 미검증

기존 BogunOn 프로젝트 xxownwxxajzrviuvvfiu에는 연결·RPC 실행·DB/Auth/RLS/GRANT/Realtime 변경을 하지 않았다. 기존 SECURITY DEFINER20/경고19개를 변경·재사용하지 않았다. 사용자 인계의 운영 메타데이터 VERIFIED 판정은 유지하되 함수 내부 인가·신규 도달성은 별도 검토다.

실제 Auth provider/redirect, JWT 서명·만료·회수, hosted PostgREST wrapper/private 호출, auth.sessions 최소권한 GRANT, 운영 세션 저장소/호스팅, Windows safeStorage/GUI는 NOT VERIFIED다. 다른 Supabase 프로젝트를 사용하지 않았다. 보존 기간·운영 승인 책임·국외 저장 고지 등 선결정은 기존 NEEDS DECISION을 유지한다.

## 11 Git와 인계 ZIP

신규·상속 SCHOOL 소스/SQL/테스트/증거와 개발용 P0 경계만 전용 feature에 누적 보존한다. commit/push는 관련 검증 완료 후 일반 push로 수행한다. 정확한 commit SHA·원격 HEAD·divergence·working tree 최종 상태는 ZIP 루트 GIT_RECEIPT.json을 확인한다. main/통합 병합·PR·운영 배포는 하지 않는다.

ZIP은 source_files 전체 overlay와 증거, 복원법, SHA-256 Manifest 및 검증기를 포함한다. node_modules/build/임시 TLS·실제 토큰·비밀키·사용자 자료는 포함하지 않는다. 원래03 ZIP에 포함된 이전 단계 소스를 다시 중복 복원하지 않는다. 원본03 ZIP과 이전 원본 ZIP은 기존 위치에서 보호하며 새 ZIP은 실행 가능한 누적 소스·provenance를 담는다. Git 파일과 ZIP 소스 경로/해시는 같고 ZIP 전용 루트 복원도구·최종 Git receipt는 별도로 명시한다. 압축 해제 후 해시 및 빈 DB 재현 결과는 RESTORE_VALIDATION.json에 남긴다.

## 12 SCHOOL05 인계

SCHOOL05의 격리 통합 개발과 Cloud B 충돌/Windows QA 인계는 착수 가능하다. 실제 Windows Electron GUI, 운영 Auth/DB/PostgREST/GRANT, 기존 SECURITY DEFINER 영향, 운영 보존/복구·승인 책임을 확인하기 전 운영 출시나 통합 브랜치 반영 준비 완료로 판정하지 않는다. 이번 작업은 SCHOOL04로 종료하며 SCHOOL05 구현은 시작하지 않는다.
