# A2 생성자·소유자·호출자·설치 권한

| 대상/단계 | 생성·변경 실행 역할 (계약) | 최종 OWNER | caller/필요 권한 | Hosted 판정 |
|---|---|---|---|---|
| 새 bridge schema | 승인된 배포 신원 | supabase_auth_admin | 배포 신원 DB CREATE + Auth owner로 SET 가능 | NOT VERIFIED |
| bridge schema ACL | SET LOCAL ROLE supabase_auth_admin | 동일 | 실제 schema owner 문맥에서 REVOKE/USAGE 부여 | NOT VERIFIED |
| session_valid / recent_login | SET LOCAL ROLE supabase_auth_admin | supabase_auth_admin | Auth owner schema CREATE·Auth 함수 실행·Auth 세션 행 읽기 | 소유 테이블 SELECT는 인계 VERIFIED, 실제 함수 설치/실행 NOT VERIFIED |
| bridge 호출 | ws_authz_reader | 변경 없음 | bridge schema USAGE + 두 함수 EXECUTE만 | 구현 LOCAL만 VERIFIED |
| 기존 private helper2 교체 | SET LOCAL ROLE ws_authz_reader | ws_authz_reader 유지 | 기존 함수 소유권 + workspace_private CREATE(동일 transaction 안에서만 임시 부여 후 회수) | NOT VERIFIED |
| 임시 CREATE 부여/회수 | SET LOCAL ROLE ws_owner | schema는 ws_owner | 승인된 installer의 ws_owner/reader SET 권한 | NOT VERIFIED |
| public54 INVOKER | 기존 계약 그대로 | ws_owner | 승인 후 authenticated에 목적별 EXECUTE; 기본 CLOSED | Hosted 설치/호출 NOT RUN |
| private purpose 함수 | 기존 계약 그대로 | ws_runtime 등 | 비소유 NOBYPASSRLS + 기존 RLS/멤버십 | 기존177/23 LOCAL 증거 보존 |
| 원시 Auth 데이터 | Auth 신뢰 경계 안에서만 | 기존 Auth owner 유지 | Workspace/client 직접 SELECT0 | 현재 ws 역할 없음, 설치 후 미검증 |

PostgreSQL catalog `proowner`는 **최종 소유자**를 보여준다. 누가 처음 생성했는지/session_user는 거기 기록되지 않는다.
DDL 실행 로그·승인된 배포 신원·코드의 SET ROLE 단계를 함께 검증해야 한다. 이번 실제 Hosted 생성자 관측은 없다.

## 09C 원본의 권한 가정

원본 `school09c/sql/auth-bridge.sql`은 전체 migration의 transaction 안에 들어가는 **fragment**다.
그대로 autocommit으로 실행하는 운영 절차가 아니다.

1. CREATE SCHEMA AUTHORIZATION supabase_auth_admin은 해당 owner로 SET할 능력이 필요하다.
2. 그 다음 schema ACL 작업은 아직 installer current_user에서 실행된다. SET-only/NOINHERIT installer는 schema owner 권한을 자동 상속하지 않는다.
3. Auth 역할에서 함수를 만들면 OWNER는 Auth 역할이다. RESET ROLE 후 기존 reader 소유 함수를 교체하려면 또 그 함수 소유권/namespace CREATE 권한이 필요하다.
4. 09C 로컬 설치자는 postgres superuser였으므로 이 DDL 권한 차이를 드러내지 못했다. 앱 RPC 인가 테스트를 superuser로 우회했다는 뜻은 아니다.
5. postgres의 BYPASSRLS나 Auth owner의 SELECT만으로 위 권한을 추론할 수 없다. MEMBER/INHERIT/SET도 서로 다르다.

새 **LOCAL-only** 후보는 2를 Auth owner 문맥으로, 3을 reader 문맥으로 명시한다.
임시 namespace CREATE는 한 transaction 안에서만 부여·회수하므로 커밋된 권한 확장이 남지 않는다.
설치 역할에 Auth owner의 SET를 새로 GRANT하는 SQL은 제공하지 않는다. 그 역할은 Auth 전체 권한으로 전환할 수 있어
단순 오류 수정으로 운영에 추가할 수 있는 권한이 아니다. 이미 승인된 권한/서비스 제공자의 설치 경로가 없으면 STOP이다.

## PUBLIC EXECUTE와 실패 보호

새 private 함수의 CREATE와 PUBLIC/anon/불필요 grantee REVOKE는 같은 미커밋 transaction이다.
프로시저 body·OWNER·고정 빈 search_path·Auth bridge EXECUTE는 09C 의미를 유지한다.
public54+매핑 private54는 CLOSED에서 시작해 그대로 끝난다. 테스트용 목적별 grant도 마지막에 회수한다.
단계 중간 오류는 bridge schema/helper 교체/권한 변경 모두 rollback한다. 임시 CREATE나 부분 공개를 남기지 않는다.
SQL 파일의 끝에 오류가 나면 ON_ERROR_STOP과 transaction rollback으로 중단해야 한다. 실패를 무시한 COMMIT은 금지다.

이 후보는 Auth 경계 단독 실험이다. 기존 S08 release fingerprint를 새 구조로 덮어쓰거나 운영 fresh 설치본으로 가장하지 않는다.
기존 Auth4열 capability checker를 바꾸는 09D 누적 설치본·새 lifecycle는 여전히 별도 작업이다.
