# SCHOOL09C-H Hosted Auth 실현 가능성 — BLOCKED 유지

기준일2026-11-06 Asia/Seoul. 이 보고서는 운영 프로젝트 xxownwxxajzrviuvvfiu에 연결하지 않고,
사용자가 전달한 ChatGPT Hosted READ-ONLY metadata와 실제09C SQL을 대조한 결과다.
운영 DDL/DML/GRANT/REVOKE/Auth 변경·계정 생성·migration·RPC·로그인 시험은 모두0이다.

## 1. A2 판정

**현재 자료로 A2 Hosted 설치 가능성은 NOT VERIFIED이며 운영 적용 BLOCKED를 해소할 수 없다.**
‘구현 불가능 확정’도 아니다. 필요한 SET/소유권/서비스 지원 정보가 아직 없다.

Auth 테이블 owner와 그 owner의 SELECT 권한은 검증된 읽기 신뢰 주체를 보여준다.
그러나 postgres의 BYPASSRLS는 schema/function OWNER나 Auth role SET 권한을 뜻하지 않는다.
설치 주체의 실제 current_user/session_user·DB CREATE·역할 SET/INHERIT·Managed Auth 지원 정책이 필요하다.
이 구분을 실제 비슈퍼유저 LOGIN의 PG17 반례/조건부 성공으로 확인했다. Hosted 권한을 추정해서 부여하지 않았다.

## 2. 함수 생성·소유·호출 경계

`ROLE_AND_INSTALL_MATRIX.md`에 단계별 권한표가 있다.

- schema 생성자: DB CREATE와 Auth owner SET가 있는 승인 배포 신원(현재 Hosted 미확인).
- boolean2 함수 생성 실행 role/최종 OWNER: supabase_auth_admin.
- boolean 직접 caller: ws_authz_reader만. 무인자·고정 빈 search_path·boolean만 반환·동적SQL 없음.
- public54 caller: 승인 후 authenticated, INVOKER→private purpose→reader→Auth bridge. 기본 CLOSED.
- 기존 helper2 소유자는 reader 유지, 업무 실행 역할은 비소유 NOBYPASSRLS·기존 RLS/epoch 유지.
- Workspace/client auth.sessions 원시 SELECT0. broad Auth GRANT·service_role 우회 없음.

proowner는 최종 소유자이지 원래 생성자 로그가 아니다. Hosted에서 이 새 함수는 설치·실행하지 않았다.

## 3. Hosted 확인 사실

제공된 사실: PG17.6, users/sessions owner=Auth admin, authenticated 해당 table SELECT 없음,
Auth owner table SELECT 있음, ws_runtime/reader 없음, postgres BYPASSRLS 있음, Workspace RPC 없음.
이는 **VERIFIED HOSTED READ-ONLY (사용자 인계)**이며 Cloud 직접 관측이 아니다.
column ACL·RLS/FORCE·role SET·schema CREATE·현재 배포 신원·새 함수 허용 정책을 의미하지 않는다.
원본 인계 사실과 추론 한계를 `reference/hosted-handoff.json`, `HOSTED_FEASIBILITY.md`에 보존했다.

## 4. 추가 Hosted SELECT와 해소 조건

`sql/hosted-capabilities-readonly.sql`은 Q1~Q10으로 구분한 정확한 읽기 전용 SQL이다.

- Q1~4: 실제 배포 경로 신원, Auth/Workspace role MEMBER/USAGE/SET와 membership options, DB CREATE.
- Q5~6: Auth owner/SELECT column ACL/RLS/FORCE와 session/user FK 삭제 동작.
- Q7~9: schema/function 충돌·OWNER·search_path·ACL·default EXECUTE.
- Q10: 비밀값을 제외한 Data API DB 설정 projection. 실제 gateway/Dashboard 설정은 별도 확인.

Auth owner SET=false면 그 신원으로 현재 단일 설치 경로는 불가다.
필요 조건이 모두 true여도 Managed DDL 제한·custom Auth-owned object의 지원/업그레이드 정책은 별도 문서/운영 확인이 필요하다.
새 role SET 권한이나 broad Auth 권한을 운영에 GRANT해서 억지로 통과시키지 않는다.
현재 메타데이터 관측 신원이 실제 deploy identity와 다르면 그 결과도 대체 증거가 아니다.
실제 Hosted DDL/함수/RPC·OAuth 성공은 별도 승인 전 NOT RUN이다.

## 5. 09C SQL 문제와 수정 후보

원본 설치자는 로컬 postgres superuser였다. 새 focused 검증에서 다음을 재현했다.

1. BYPASSRLS만 있고 Auth SET가 없는 installer는 CREATE SCHEMA AUTHORIZATION/ALTER FUNCTION OWNER가 실패한다.
2. Auth SET만 있고 NOINHERIT인 installer는 원본의 Auth-owned schema ACL 명령에서42501로 실패한다.
3. 그 문맥만 고쳐도 RESET ROLE 후 workspace_private의 reader-owned helper 교체에 권한이 부족하다.

새 **LOCAL-only Auth 경계 후보** `sql/auth-install-local.sql`은 schema ACL을 Auth owner로,
private helper 교체를 reader로 수행한다. ws_owner가 reader에게 같은 transaction 동안만 CREATE를 부여하고 회수한다.
새 PUBLIC/default EXECUTE는 같은 transaction 안에서 차단한다. late failure를 주입해 bridge/helper/권한 전체 rollback,
54 CLOSED·기존 상태 보존을 확인했다.

Auth 함수2개와 private helper2개의 **본문은09C와 byte-identical**이다. 공개54 서명/본문/소유자 변경0,
제품 코드·기존 migration 변경0이다. 설치 권한 문맥과 사전검사만 수정했다.
이 후보는 Hosted/fresh 누적 migration이 아니며 S08 지문을 덮어쓰지 않는다.
09D의 새 cumulative lifecycle/Auth capability checker·보존/복구 검증은 여전히 필요하다.

## 6. 세션·우회·유지보수

같은 UID의2세션을 구분해 하나의 session_id 삭제 후 그 세션만 거부되고 다른 세션은 계속 허용되는 것을 로컬에서 확인했다.
not_after 만료, Workspace revoked_sessions, Auth 사용자 삭제+세션 정리·Workspace tombstone도 집중 검사했다.
이는 실제 Hosted signOut/전역회수·삭제 cascade/API timing/JWT/JWKS 검증이 아니다.
7일/최근10분 정책과 Google 재인증 의미·관리형 timeout 정리 지연은 기존 NOT VERIFIED를 유지한다.

private bridge EXECUTE는 reader만 가지며 authenticated/PUBLIC/anon·ws_runtime은 직접 호출하지 못한다.
함수 소유 역할의 권한은 Auth 신뢰 경계에서 쓰고 Workspace content 권한을 추가하지 않는다.
Auth 내부 column/session 의미, 관리형 role·복원·업그레이드 정책 의존은 유지보수 위험이다.
비Auth schema에 뒀다는 이유로 지원/업그레이드 호환성이 보장되지는 않는다.
문자열 SQL body의 의존성을 pg_depend만으로 완전하게 파악할 수도 없다.

## 7. 대안

`ALTERNATIVES.md`에 신뢰 서버+목적별 gateway, 지원되는 session-live primitive, 별도 제한 계층을 비교했다.
공식 API의 특정 session 회수 의미와 직접 RPC 우회 차단이 검증돼야 한다. user JWT로 동일 공개 RPC를 호출하는 BFF만 추가하면 우회를 막지 못한다.
외부 client의 회수를 관측하지 못하는 자체 ledger만 쓰거나 JWT 만료/캐시 TTL까지 허용하는 방식은 단독 대체로 선택하지 않는다.
새 verifier role 이름만 붙여 Auth SELECT 금지를 회피하거나 일반 요청을 service_role로 실행하지 않는다.

Auth role SET가 불가하더라도 서비스 제공자가 승인된 별도 Auth-owner 설치 경로를 지원한다고 확인하면
Auth bridge와 Workspace 설치를 나누는 경로를 검토할 수 있다. 그런 서비스 지원이 존재한다고 확인한 것은 아니다.
어느 경로든 설치 중 public54는 CLOSED로 유지하고 부분 실패를 공개 상태로 남기지 않아야 한다.

## 8. 운영 정책

`OPERATIONS_APPROVAL_FORM.md`는 책임기관·검증자A/독립승인자B·분리 기준, 최소 증빙,
원본/검증결과 보존·삭제, 전보/퇴직 멤버십 종료, 학교 기록 기간·탈퇴/폐쇄·관리자 부재·audit 접근을 승인할 수 있는 초안이다.
실제 책임자·기관 근거·기간은 미정이고 모든 승인 칸은 **미승인**이다. 임의의 운영 동의/실제 재직 확인을 부여하지 않았다.

## 9. 검증·기준 보존

- 새 focused LOCAL PostgreSQL17.6: **26 PASS /0 FAIL**. 진짜 NOSUPERUSER NOINHERIT LOGIN 연결을 사용했다.
- Hosted 추가 SELECT는 권한 없는 Auth schema를 직접 읽지 않는 catalog 쿼리로 작성하고 로컬 관측자/비슈퍼 설치자에서 구문 검증했다.
- 원본09C LOCAL DB177 /PostgREST23은 **a16245d의 기존 증거 그대로 보존·참조**, 재실행/신규 합산하지 않았다.
- Hosted DDL/Auth/PostgREST/실계정·Windows/Chromium·제품 빌드는 NOT RUN. 새 제품 코드가 없다.
- 실패 원인: 에러 문구를 일반화한 테스트 assert, guard의 불필요한 Auth namespace regclass 조회를 최소 수정했다. 권한 확대 없이 catalog OID 조회로 바꿨다.
- 함수 본문4개 동일성, 입력 해시·Python/Bash 문법·diff·비밀정보 패턴 검사를 보존한다.

## 10. Git·09D

기준 통합39c775c, 기반09C a16245d를 원격 재확인하고 독립 `feature/school-09ch-hosted-feasibility`에서 작업했다.
변경은 school-workspace/school09ch 아래 문서·SELECT·LOCAL 수정 후보·focused 테스트/증거뿐이다.
최종 SHA/원격 일치/clean은 ZIP의 GIT_RECEIPT.json 및 완료 보고를 따른다.
main·통합·09C 브랜치 변경/병합·강제 push·운영 배포는 없다.

**최종 BLOCKED(운영 해제 기준)**. 로컬 설치권한 수정 후보는 검증됐으나 Hosted A2 지원 가능성은 아직 미입증이다.
다음 단계는 Q1~Q10과 관리형 지원 정책·운영 승인안의 해소다. 이후 정확한 SQL/SHA·백업/복구·새 CLOSED 누적본을 검토하고
별도 운영 변경/실계정 시험 승인을 받아야 한다. 현재 자료만으로09D 운영 적용 승인 준비 완료를 선언하지 않는다.
