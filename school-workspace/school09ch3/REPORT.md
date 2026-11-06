# SCHOOL-09C-H3 결과 — CONDITIONAL / 운영 적용 BLOCKED

2026-11-06 KST. 보고서만 작성한 작업이 아니다. **새 fresh 설치 SQL·최소권한 경계·실행 테스트를 구현했다.**
운영 xxownwxxajzrviuvvfiu 연결/DDL/DML/GRANT/Auth 변경/실계정/배포0.

## 1. 기준·Git

- H2 기준: `01647c13283b88e5a73b4c0542fe6d344129216f`
- 시작·종료 재확인 원격 통합: `39c775cdd11509fdc6bc930ef62990acdd1e1315`
- 독립 worktree/브랜치: `feature/school-09ch3-supported-auth`
- 변경은 `school-workspace/school09ch3/`에만 있다. 기존 브랜치/제품/통합 코드를 덮어쓰거나 병합하지 않았다.
- 최종 commit/원격 일치·0/0·clean은 ZIP `GIT_RECEIPT.json`과 채팅 완료 보고를 따른다.

## 2. 제거한 제약

[Supabase 공식 대안](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7)을 확인했다.
A2의 Auth 소유권 위임/역할 전환을 다시 시도하지 않았다.

| 이전 요구 | 새 후보 |
|---|---|
| Auth 소유 bridge·supabase_auth_admin SET/위임 | 별도 workspace_auth_bridge에서 postgres 소유 제한 boolean2 |
| custom role의 auth.uid/jwt/schema USAGE | Workspace 내부 INVOKER claims helper |
| 과거 S06 reader4열 SELECT를 먼저 설치 | 처음부터 Workspace 역할의 Auth SELECT/USAGE0 |
| 미설치 Hosted에 별도 core/H2 layer 조립 | 전체 업무 SQL을 새 fresh atomic transaction으로 설치 |
| 구 설치 장부를 다시 채택할 위험 | 새 release/정확한 source54 manifest/구조 지문, drift 거부 |

**공식적으로 막힌 Auth CREATE/owner SET 의존성은 후보에서 제거했다.** 실제 프로젝트에서의 설치 성공을 뜻하지는 않는다.
보안상 현재 세션을 실시간 검사해야 하므로 기존 권한을 가진 postgres의 좁은 Auth 읽기는 남는다.
Auth 원본 SELECT를 새로 GRANT하지 않는다. Workspace 역할5개는 Auth schema/테이블/열에 접근하지 못한다.

## 3. 실제 SQL과 설치 경계

- `01-fresh-local.sql`: 계정·학교·가입·권한·업무·일정·인수인계·Inventory·audit·receipts·C의 CLOSED bootstrap 포함.
- `02-activate-qa-only.sql`: 격리 QA에서만 public/private54쌍을 각 실제 함수 소유자로 활성화.
- `03-close-local.sql`: 데이터 삭제 없는54쌍 차단.
- `04-hosted-readonly.sql`: 추가 권한 카탈로그 SELECT. 운영에서 실행하지 않았다.

설치 접속자는 **NOSUPERUSER postgres**, auth CREATE/관리 owner SET 불가다.
Auth 세션 boolean2와 accounts의 FK DDL만 그 기존 신원의 권한을 사용한다.
업무 DDL은 임시 NOBYPASS 설치 역할/비BYPASS 소유자 문맥이며 임시 역할·CREATE·seed 정책은 commit 전에 제거한다.
모든 업무/제어 테이블의 ENABLE+FORCE RLS를 유지한다. 원시 클라이언트 테이블 접근 없음.
PUBLIC/anon/default EXECUTE는 같은 transaction에서 제거한다. public54·operator 명령 기본 CLOSED.
재실행은 release/manifest/구조 및 외부 Auth capability drift 검증 후 no-op. 실패는 전체 rollback이며 원래 public/Auth를 수정하지 않는다.
기존 Workspace 설치가 있으면 fresh 충돌로 중단한다. 과거 raw-grant/A2 SQL은 설치 순서에서 제외한다.

새 객체: schema4, 영구 역할5, 업무/제어 table33, RLS policy87,
public RPC54 + private function107(bridge2/bootstrap1/claims helper2 포함).
전체 목록과 owner/ACL/search_path/정의 해시는 evidence/installed-functions.json 및 installed-roles.json에 있다.

## 4. 세션·54개 계약·사용자 삭제

공개54의 인자·반환형·전체 함수 정의 MD5·소유자·DEFINER/INVOKER·search_path가 C 카탈로그와 동일하다.
bridge 두 본문은 그대로, private 두 helper는 uid/jwt를 동일 request JSON 의미의 Workspace helper로 치환했다.
현재 사용자/session_id 결합, JWT exp/anonymous, 기존7일·10분 정책, not_after, app revoked_sessions,
계정 상태·멤버십/epoch/학교·현재 권한을 검사한다. user_metadata 인가·service_role 요청 없음.
읽기 전용 함수에는 타인 UUID 인자가 없고 boolean만 반환한다. 외부 역할의 직접/임의 UUID 호출을 거부했다.

accounts.user_id의 FK/ON DELETE SET NULL은 유지했다. 권한 있는 postgres가 FK를 만들고 즉시 비BYPASS ws_owner로 이관한다.
Auth schema에 사용자 함수/테이블/trigger 생성 없음, Workspace 역할로의 Auth 권한 위임 없음.
기존 사용자 삭제 tombstone/학교 소유 기록/마지막 관리자 시험도 그대로 통과했다.

## 5. 검증 결과

| 검증 | PASS | FAIL | 의미 |
|---|---:|---:|---|
| 새 설치/권한/복구·계약 집중 LOCAL DB |25|0|fresh·중간/최종 실패 rollback·재실행·CLOSED·변조 거부 등|
| 기존 도메인 영향 회귀 LOCAL DB |137|0|S01 34, Inventory31, bootstrap25, S02 16, S03 15, S04 16|
| LOCAL PostgREST13.0.4 |15|0|실제 HTTP, 합성 HS256/Auth, live 세션/역할 회수,54 차단|
| MOCK |1|0|실패 예외에 서명재료 비노출|
| 합계 |178|0|스위트 체크 합계. 새로운 업무 시나리오178개라는 뜻 아님|
| Hosted OAuth/Auth/API·Windows·Chromium |NOT RUN|—|운영/제품 소스·UI 변경 없음|

최종 evidence/results.json/final-run.log가 기준이다. 중간28/174 PASS 및 schema-only 반복은 합산하지 않는다.
별도 schema-only 보강에서54 public/private 양쪽 CLOSED와 인자·반환·정의 일치를 확인했으며 역시 합산하지 않는다.
원본 C177/23·H26·H2 39는 기존 증거로만 보존한다.
Node 계약은 실제 Main/BFF 클래스·사용자별 DB 호출을 사용하되 Auth/cipher는 MOCK이다. 실제 OAuth 성공이 아니다.
Fixture DBA와 실제 authenticated RPC 역할을 분리했다. 원래 테스트 단언/제품 소스를 약화하지 않았다.

세션 삭제 후 동일 UID의 다른 session은 허용하고 삭제된 session만 거부했다.
not_after·app revoke·멤버십 정지/만료·타 학교·역할 강등·임의 직접 호출을 차단했다.
재고 동시 출고·멱등성·version·audit rollback, 일정·handover 읽음/재확인·개인 데이터 불변을 검증했다.
원래 public sentinel의 정의/ACL/RLS와 개인 행, Auth schema/함수/테이블/열 권한 지문도 유지됐다.

## 6. 자율 수정·기존 제품

역할 ADMIN 재부여·schema owner 문맥·임시 생성/DDL 권한·변수 충돌·replay/lifecycle 소유자 문맥·fixture 순서·Node 파일 선택 오류를 수정했다.
삭제 tombstone 보존 및 외부 Auth ACL/manifest drift 검사도 강화했다. 결함별 실질 수정1회,3회 상한 이내.
실패/중간 로그는 삭제하거나 PASS로 바꾸지 않았다. QA_FIX_LOG.md 참조.

새 제품 TS/JS/화면/DPAPI/개인 Inventory/Finance/기존19 함수 변경0.
Python/Bash 문법·입력/SQL/본문 해시·secret pattern·Git diff 검사를 수행한다.
제품 빌드·기존13타입오류/xlsx403/Cargo 재현·Windows QA는 범위 영향이 없어 NOT RUN이다.
기존 Windows PASS는 해당 역사적 Source SHA에만 유지하며 H3 Hosted PASS로 승계하지 않는다.

## 7. 남은 Hosted·운영 승인

아래만 외부 증거와 별도 승인이 필요하다. 로컬 성공으로 대체하지 않았다.

1. 실제 postgres의 기존 Auth4열 SELECT/USAGE·uid/jwt EXECUTE·users.id REFERENCES 및 Workspace 역할/schema/public 생성 권한.
2. 실제 Hosted의 Workspace FK 생성·소유권 이관·제한 postgres function 설치 및 Data API/private schema 경계.
3. 실제 JWT/JWKS·claims 문맥·Google provider/redirect·서버 refresh·로그아웃/전역회수·삭제의 세션 처리 시점.
4. 최초 관리자 책임·독립 승인자2인·증빙/보존/국외저장·백업/복구·실계정 시험 동의와 절차.
5. 정확한 운영 후보 SQL/해시/guard·Feature Gate 활성화에 대한 별도 승인.

운영 적용 guard는 여전히 school01a/isolated이다. Hosted 실계정 로그인·세션 회수 검증 전 운영 적용 BLOCKED.
광범위 Auth GRANT, RLS 해제, 세션 검사 삭제, 사용자 service_role 실행, 정책 하향 대안은 사용하지 않았다.
Trusted BFF 대체가 필요하지 않아 런타임 모델을 추가로 바꾸지 않았다.

## 8. 보존

feature commit/push 및 원격 일치·0/0·clean을 확인한다. 인계 ZIP에는 소스·SQL·테스트·실패/최종 로그·카탈로그·상대경로 복원법·SHA-256 검증기를 포함한다.
패키지는 새 디렉터리에 풀어 해시·원본 입력·재생성 SQL 동일성을 검증한다. 실제 키/토큰/사용자·학생 정보 없음.
검증된 로컬 대체 설치 후보 **CONDITIONAL**, 운영 적용 **BLOCKED**. main/통합 병합과 운영 배포는 수행하지 않는다.
