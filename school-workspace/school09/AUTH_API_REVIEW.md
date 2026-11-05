# Managed Auth·Data API 검토

## 계정과 현재 인가

Auth UUID(`auth.uid()`/JWT sub) → Workspace account → school_membership/epoch/validity가 기본 경로다.
JWT의 user_metadata 또는 이메일/실명/개인 학교 프로필을 권한 근거로 사용하지 않는다.
JWT role='authenticated'는 Data API DB 역할일 뿐 SCHOOL_ADMIN 증거가 아니다.
민감 RPC는 현재 계정 활성·학교 상태·승인 멤버십·유효기간·역할/permission을 DB에서 검사한다.
멤버십 정지/만료와 세션 행 삭제/만료는 이전에 서명된 토큰에도 새 요청에서 적용된다(VERIFIED LOCAL).
진행 중인 기존 transaction까지 즉시 중단한다는 보장은 하지 않는다. 학교별 command lock 이후 새 statement 기준 인가다.

`session_ok()`는 sub↔session_id 소유자 일치, JWT exp, is_anonymous=false, live auth.sessions 및
workspace.revoked_sessions, account status를 검사한다. 세션 created_at 7일 이내, not_after 미래 조건이 있다.
`recent_login()`은 동일 세션 created_at 10분 이내를 요구한다. refresh timestamp나 JWT iat를 재인증 증거로 바꾸지 않았다.
GoTrue의 장기 세션·재인증 후 session ID/created_at 갱신과 이 정책의 제품 적합성은 **NOT VERIFIED**다.
7일 후 무조건 재로그인이 필요한 정책·10분 관리자 재인증의 운영 행동을 실제 승인된 테스트로 확인해야 한다.

공식 session 문서는 session_id가 auth.sessions PK와 대응하며 sign-out 시 해당 세션 행이 제거된다고 설명한다.
시간 제한/비활성 timeout은 refresh 시 검사되고 정리 지연이 있을 수 있다. row 존재만으로 모든 관리형 timeout 조건을
동일하게 재현했다고 주장하지 않는다. 이 구현의 exp/not_after/7일 조건과 실제 프로젝트 설정을 별도로 대조해야 한다.
공식 문서: https://supabase.com/docs/guides/auth/sessions (문서 검색으로 확인; 프로젝트 실험 아님).

## 최소 Auth 권한과 소유권

| 역할 | 필요한 경계 | 금지 / 상태 |
|---|---|---|
| ws_owner | Workspace schema/table owner, auth schema USAGE, auth.users.id REFERENCES | NOLOGIN/NOBYPASSRLS, FORCE RLS. Auth users row SELECT 불필요 |
| ws_runtime | workspace schema/table의 목적별 DML+RLS, private helpers EXECUTE, auth.uid/jwt EXECUTE | Auth session 어떤 열 SELECT도 금지, owner/reader SET ROLE 없음 |
| ws_authz_reader | authorization metadata SELECT, auth schema USAGE, auth.uid/jwt EXECUTE, sessions **id/user_id/created_at/not_after 열 SELECT만** | tablewide SELECT/다른 session 열/auth.users SELECT/업무 content DML 금지 |
| authenticated | public/private schema USAGE(함수 해석), 활성화한 public INVOKER+매핑 private DEFINER EXECUTE | 원시 table SELECT/쓰기, 내부 generic helper 실행, privileged 역할 membership 없음 |
| anon / PUBLIC | Workspace 함수 EXECUTE 없음 | 모든54 기본 CLOSED; authenticated도 초기 CLOSED |
| migration runner | 역할 생성·SET/소유자 변경 및 ledger 관리에 필요한 승인 권한 | trusted installer이며 앱 호출자 아님. Hosted에서 가능 여부 NOT VERIFIED |

별도 reader는 인가 메타데이터를 학교 전체에서 읽는 정책을 갖는다. 이는 학교 간 업무 content 읽기 권한이 아니다.
DEFINER 실행 역할 runtime/reader는 tableowner가 아니며 NOSUPERUSER/NOBYPASSRLS다.
따라서 SECURITY DEFINER라는 이유만으로 이 구현이 RLS를 자동 우회하지는 않는다. 실제 owner/role/RLS 정책을 함께 검증했다.
public wrapper owner ws_owner는 **INVOKER**이므로 caller privileges로 실행하고 소유자 권한을 전달하지 않는다.

Managed Auth owner는 제공된 과거 감사에서 supabase_auth_admin이다. 그 계정의 권한을 Cloud C가 대체하지 않는다.
운영 auth.sessions RLS/열/grant-option, 실제 migration identity의 CREATE ROLE/SET ROLE와 소유권 전환 가능성은
READ-ONLY 증거와 운영자/서비스 지원 확인이 필요하다. 실제 GRANT는 이번에 실행하지 않았다.
불가능하면 현재 auth.sessions 의존 계약의 Hosted 적용은 BLOCKED이며, JWT-only/service_role/postgres 우회는 허용하지 않는다.
대안(보안 정책 변경 승인 필요): 운영자 승인 Auth bridge 또는 앱 자체 revocation ledger를 포함한 새 freshness 설계.
기존 ledger만으로 다른 Auth client의 로그아웃을 즉시 감지한다고 주장할 수 없다.

## DEFINER·함수 체인

`evidence/catalog-active.json`의 156개 전부 고정 빈 search_path이며 54 public INVOKER, 76 private DEFINER,
26 private INVOKER다. DEFINER52개 runtime, 24개 authz_reader. 나머지 private INVOKER에는 helper/trigger가 있다.
RLS80개와 제약/복합FK는 카탈로그로 기록했다. 목적별 인가가 들어간 public→private만 authenticated에 열린다.
private generic dispatch/helper는 직접 EXECUTE되지 않으며 raw tables는 API에 노출하지 않는다.
CLOSED 상태는 public와 매핑 private 모두 권한 제거. CREATE/REVOKE가 동일 app transaction에 있어 중간 기본 PUBLIC EXECUTE를 커밋하지 않는다.

`reference/function-call-edges.json`은 실제 prosrc의 qualified references와 동적 EXECUTE 표시를 보존한다.
PL/pgSQL은 pg_depend에 모든 실행 관계를 남기지 않는다. 텍스트 그래프만으로 완전한 비간섭 증명을 주장하지 않는다.
신규 코드에서 기존 경고19 함수/service_role로 연결되는 경로가 없는지는 정적검사와 direct-helper/role/RLS 공격으로 확인했다.
**기존 운영 postgres-owned DEFINER20개의 내부 SQL/동적 SQL/미래 Workspace 도달성은 NOT VERIFIED**다.
로컬 sentinel20개는 실제 함수 본문이 아니므로 해당 감사의 대용이 아니다. 일괄 revoke/수정하지 않았다.

## PostgREST

로컬 PostgREST13.0.4 authenticator는 NOINHERIT·NOBYPASSRLS, anon/authenticated membership만 가진다.
노출 schema는 public 하나다. public invoker→private purpose definer는 각 schema USAGE+EXECUTE가 필요하다.
private schema USAGE는 테이블 SELECT나 Data API exposure를 뜻하지 않는다.
LOCAL HTTP에서 서명·만료·role escalation·anon·pending·A/B·private profile·raw tables·live회수를 실제 검사한다.
54 CLOSED는 익명54+authenticated54 실제 HTTP 요청으로 실행했다. 108요청을108개 고유 시나리오로 세지 않는다.
로컬 JWT는 임시 HS256 issuer이며 Auth tables도 합성이다. 실제 Supabase gateway/apikey/JWKS/GoTrue PASS가 아니다.
운영 exposed schemas, schema cache reload 방식, JWT issuer/audience/algorithm/JWKS, provider/redirect는 **NOT VERIFIED**다.
DB pgrst.db_schemas 카탈로그 설정만으로 실제 Hosted gateway 설정이 확인된 것은 아니다.

## Electron/Web

Electron Main이 세션+Windows safeStorage를 소유하며 목적별 Preload만 노출한다. callback은 main-only,
code/state/flow 검증·재사용 방지, refresh generation과 logout cleanup, 암호화 불가 시 평문 fallback 없음.
`SupabaseIdentityProvider`는 공식 PKCE SDK를 사용하지만 기본 transport는 차단되며 승인된 fetch 주입이 필요하다.
Google provider, 정확한 bogunon-desk callback/HTTPS BFF callback allowlist·OS 등록·query 유지/공식 OAuth 동작은 NOT VERIFIED.
동일 Supabase Auth UUID를 양쪽에서 사용하며 publishable key만 허용한다. 일반 요청에 service_role을 쓰지 않는다.

BFF는 HttpOnly/Secure/SameSite=Lax __Host cookie의 무작위 handle만 브라우저에 주고 token은 서버에 둔다.
Origin+CSRF 검증, per-session lock/CAS refresh, 학교 generation 및 logout revoke를 갖는다.
메모리 store는 testOnly로 production constructor에서 거부한다. 운영 영구 store/다중 인스턴스 lock/CAS,
OAuth pending-flow의 다중 인스턴스 공유/재시작 처리, TLS/hosting 책임은 운영 선행조건이다.
로컬 logout은 즉시 메모리/세션을 지우되 원격 revoke 실패 시 unconfirmed다. 원격 회수 완료를 가장하지 않는다.
프로덕션 합성 경로는 packaged/production/isolated/runId gate가 다중 조건으로 차단한다.

## 별도 승인된 Hosted 시험 계획 (이번 NOT RUN)

1. 최신 metadata/보안·개인정보·운영 책임 승인 후 Hosted 최소 역할/Auth 권한 및 설치본 승인.
2. 합성 용도의 승인 테스트 사용자/학교 범위와 정리 책임 확정. 실제 학생 데이터 금지.
3. Google PKCE의 Desktop/Web 동일 UID, redirect/state/flow/replay, JWT sub/session_id/exp/JWKS 확인.
4. public RPC 기본 CLOSED 익명/인증 부정 시험 후, 승인된 목적 함수만 단계적으로 공개.
5. 2학교·교사/지원강사·pending, 가입/승인, 업무/일정/전달/재고 및 직접ID 부정 시험.
6. refresh 동시성·세션 만료·원격 logout 후 기존 access JWT·멤버십 회수·재인증10분·장기7일 경계 확인.
7. Hosted gateway와 BFF CSRF/Origin, DPAPI Windows 실환경은 분리하여 증거 저장.
8. 실패 시 feature gate CLOSED, 비파괴 endpoint 폐쇄/증거 보관. 권한 확대로 통과시키지 않음.
