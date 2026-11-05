# SCHOOL-09A/B 최종 사전검증 — CONDITIONAL

보고 기준: 2026-11-06 Asia/Seoul. 운영 변경·운영 연결·실계정 로그인 없음.

## 1. Git 기준과 보호 범위

원격 통합 HEAD `39c775cdd11509fdc6bc930ef62990acdd1e1315`에서 독립 worktree/branch
`feature/school-09-hosted-preflight`를 생성했다. SCHOOL08 `da1737589329b3c62647f926827839765adf12cd`는
기준 통합의 조상이며 통합은 그보다8커밋 앞선다. 차이는 Windows QA/workflow, Main 종료/logout 대기,
Finance provenance 검증 등11파일이다. 이 파일들을 덮어쓰지 않았다. 최종 Source SHA는 인계 ZIP의
`GIT_RECEIPT.json`과 원격 branch를 따른다(보고서 자신이 포함된 commit SHA를 본문에 순환 기록하지 않음).

변경은 `school-workspace/school09/**` 감사 query·테스트·증거·문서만이다. 제품 코드·기존 migration 수정0.
입력849파일 SHA-256 및 frozen SQL 원본 지문을 확인했다. `git-baseline.json`에 계보/변경 목록을 보존했다.

## 2. 설치 순서와 실제 개체 수

실행 순서: S08 frozen foundation → 외부 최소 Auth capability Gate → S08 cumulative app →54 CLOSED 확인.
격리 테스트에서만 synthetic Auth fixture/capability와 local activation을 사용한다. 상세 파일 순서와 복구는
`INSTALL_AND_RECOVERY.md`에 있다. S06 core와 S07을 cumulative 뒤에 중복 적용하지 않는다.

실제 카탈로그 결과:

| 개체 | 수 |
|---|---:|
| Workspace schema | 2 |
| ws_owner / ws_runtime / ws_authz_reader 역할 | 3 |
| 공개 목적 RPC | 54 |
| 그중 ws_v1_ | 46 |
| ws_c_membership_status / ws_s02_* 호환 RPC | 8 |
| private 함수 | 102 |
| 전체 관련 함수 | 156 |
| SECURITY DEFINER | 76 (runtime52 / reader24) |
| 공개 SECURITY DEFINER | 0 |
| 업무 table | 27 |
| private 설치/manifest table | 5 |
| 전체 table | 32 |
| RLS policy | 80 |
| 제약조건 | 168 |

따라서 ‘54개 RPC’는 맞지만 ‘ws_v1_ 함수54개’는 부정확하다. 운영에서 ws_v1_0개라는 메타데이터만으로
나머지 호환 이름8개 충돌까지 없다고 단정하지 않는다. `hosted-readonly.sql`이 public ws_ 전체를 조회한다.
정확한 모든 서명·입력 이름/기본값·반환은 `RPC_AND_GRANTS.md`, JSON manifest/catalog에 있다.

## 3. DEFINER·RLS·권한 감사

공개54개는 ws_owner 소유 INVOKER, private DEFINER76개는 runtime/reader 소유다.
156개 전부 search_path 고정 빈 문자열. runtime/reader는 NOLOGIN/NOBYPASSRLS/비super/비tableowner다.
32개 table 모두 ws_owner 소유 ENABLE+FORCE RLS이며 authenticated 원시 SELECT/UPDATE 없다.
앱 호출자는 privileged role membership/SET ROLE 권한이 없다. public wrapper 소유자 권한은 INVOKER 호출에 전달되지 않는다.

설치 직후 public+매핑 private54쌍은 authenticated/PUBLIC/anon 모두 CLOSED.
동일 app transaction 내부의 CREATE→REVOKE 순서라 커밋된 기본 PUBLIC EXECUTE 노출 창이 없다.
QA 활성화 뒤에는 목적별54쌍만 authenticated EXECUTE, 내부 generic dispatch/인가 helper 직접 실행은 거부한다.
학교/멤버십/epoch·역할 상한·현재 세션·마지막 관리자·대상/담당자·버전/멱등성·감사 원자성을 실제 DB에서 검사했다.

빈 DB 설치, 재실행/동시재실행, 앱 설치 중간 실패 rollback, legacy public 지문/합성 개인행 불변,
드리프트 시 install/activation 거부·비파괴 CLOSED도 확인했다. 기존 public sentinel은 실제 운영 함수 본문과 다르다.
기존 운영 DEFINER20개(경고19)의 내부 인가/동적SQL/미래 Workspace 도달성은 여전히 NOT VERIFIED다.
신규 함수에서 기존 경고 함수를 참조하거나 재사용하지 않는다. 원본 함수/실행권한 변경0.

## 4. Auth·PostgREST 결과와 한계

UUID/sub/session_id 소유자 연결, exp/anonymous claim, live membership, Auth session 삭제/만료는 VERIFIED LOCAL.
4개 session 열만 reader에 허용하고 runtime은 모든 session 열 SELECT 거부되는 것을 실행했다.
이 최소 GRANT가 Managed Auth owner 아래서 가능한지는 NOT VERIFIED. 불가 시 운영 적용 BLOCKED이며
postgres/service_role로 우회하거나 RLS를 끄지 않는다.

현재 누적 installer는 local-only다. 이 가드를 제거하여 운영 가능하다고 표시하지 않았다.
검토된 Hosted installer·역할/Auth capability 증거를 확보하기 전 **운영 적용은 BLOCKED**다.
7일 session.created_at /10분 recent-login과 실제 GoTrue 재인증/refresh·세션정리 동작의 호환성,
Google provider/redirect, 실제 JWT/JWKS·gateway/apikey·Data API exposed schema는 NOT VERIFIED다.
세부 근거와 대안/승인 조건은 `AUTH_API_REVIEW.md`에 있다.

## 5. 실행 테스트 (중복 합산 없음)

| 스위트 | 환경 | PASS | FAIL | 증거 |
|---|---|---:|---:|---|
| installer·기존 lifecycle | LOCAL DB | 20 | 0 | install-results.json의 S09/HTTP 제외 |
| 신규 보안 catalog/DEFINER/Auth/query probe | LOCAL DB | 18 | 0 | security-audit-results.json; install-results의 부분집합 |
| Inventory domain | LOCAL DB | 31 | 0 | db-results.json |
| 원본 계정/RLS 불변조건 | LOCAL DB | 34 | 0 | school01-invariants.json |
| 가입·승인 | LOCAL DB + MOCK Auth | 22 | 0 | school02-regression.json |
| 공동 업무 | LOCAL DB + MOCK Auth | 21 | 0 | school03-regression.json |
| 공동 일정·인수인계 | LOCAL DB + MOCK Auth | 22 | 0 | school04-regression.json |
| 빈 Workspace metadata query | LOCAL DB | 1 | 0 | empty-metadata.log |
| 실제 HTTP/JWT/API 보안 | LOCAL PostgREST | 19 | 0 | install-results.json의 LOCAL POSTGREST |
| 인증 어댑터 | MOCK provider/cipher/RPC | 59 | 0 | auth-regression.json |
| 제품 IPC/production gate/generation | MOCK actual Main/Preload | 10 | 0 | product-boundary.json |

install-results.json 총57 = DB20+신규18+REST19다. 별도 security-audit18은 그57의 부분집합이며 또 합산하지 않는다.
HTTP CLOSED54 익명/인증108요청은 한 묶음의 테스트다. 반복 실행 횟수를 고유 시나리오로 세지 않는다.
첫 실행의 DB 회귀99는 동일한 frozen 입력/PG17.6에서 유효해 재사용했다. 이후 감사 harness만 수정하고
installer/domain/새 보안/REST를 재실행했다. 최종 실행 FAIL0. 중간 harness 실패는 별도 로그에 보존했다.

## 6. 기존 제품·빌드·Windows

새 TypeScript/제품 소스 변경0. npm scripts를 확인했고 root lint/typecheck script는 없다.
이번에는 문서/SQL SELECT/Python/Bash만 추가했으므로 Electron/UI/root product build는 NOT RUN이다.
기존13 type 오류와 xlsx403을 최신 SHA에서 재현하지 않았으므로 새 baseline PASS/FAIL로 단정하지 않는다.
Python 구문검사·입력 해시·git diff check와 실제 로컬 SQL/Node 테스트는 실행했다.

Actions42046879758의 head_sha39c775c/conclusion success를 GitHub API로 확인했다.
기존 Windows/DPAPI/개인기능 QA는 그 Source SHA의 역사적 증거로 보존한다.
이번 실제 Windows / Chromium UI / Hosted / 실제 OAuth는 NOT RUN. UI 소스가 바뀌지 않아 재구현·재빌드하지 않았다.
개인 Finance/업무/일정/Inventory/Dashboard/Dock/DPAPI 및 기존 인증 경계 변경0, 자동 업로드0.

## 7. Hosted 증거 분류

| 항목 | 분류 | 출처/제한 |
|---|---|---|
| PG17.6, public RLS232, ws schema0, 신규역할0, ws_v1_0, auth/public/extensions 존재 | VERIFIED HOSTED READ-ONLY | 사용자가 전달한2026-11-06 감사. Cloud C 직접 관측 아님; 현재 실호출 증거 아님 |
| 설치/격리/권한/멱등성/버전/원자성/로컬 API | VERIFIED LOCAL | synthetic Auth+PG17.6+PostgREST13.0.4 |
| managed auth.sessions 최소권한·role 생성/SET/소유권 | NOT VERIFIED | metadata 추가 조회와 운영자/서비스 검토 필요 |
| 실제 Hosted OAuth/JWT/refresh/logout/RPC/Data API | NOT VERIFIED / NOT RUN | 운영 접속/실계정 시험 금지 준수 |
| 기존 postgres DEFINER 내부 인가·미래 도달성 | NOT VERIFIED | source 본문/동적SQL 별도 READ-ONLY 감사 필요 |
| 현재 local-only 후보의 운영 실행 | BLOCKED | hosted 설치본/권한 증거/승인 전 실행 금지 |

## 8. 운영 적용 전 승인·인계

ChatGPT용 카탈로그 SELECT와 목적: `sql/hosted-readonly.sql` (실행 가능한 local 검증 완료).
실제 provider/redirect/Data API 설정은 비밀값 없이 별도 Dashboard READ-ONLY 확인이 필요하다.
백업/복구 책임과 증거, 최소권한 실현성, 운영용 설치본, 최초 관리자/학교 directory/보존/국외저장 정책,
실계정 Hosted 시험 범위 및 단계별 기능 gate 공개를 승인해야 한다. 이번 보고는 그 승인을 요청하거나 적용하지 않는다.

Cloud B에는 새 코드 제품 재통합 없이 source diff0과 기존 Windows SHA 증거, DB/권한 패키지 및
Hosted HOLD 목록을 전달한다. 통합/main 병합·운영 배포는 하지 않는다.

최종 **CONDITIONAL**: 로컬 사전검증 패키지는 검증했으나 Hosted 설치·Auth·운영 RPC 안전성 전체를 확정할 수 없다.
운영 준비 완료/배포 PASS를 선언하지 않는다.
