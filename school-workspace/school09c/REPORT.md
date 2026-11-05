# SCHOOL09C Managed Auth 최소권한 결정 — CONDITIONAL

기준일2026-11-06 Asia/Seoul. 운영 프로젝트 xxownwxxajzrviuvvfiu에 접속하거나 변경하지 않았다.
실제 사용자/학교 생성·OAuth 로그인·운영 DDL/DML/GRANT/Auth 설정·migration 적용0.

## 1. 기준·보존

원격 통합 HEAD `39c775cdd11509fdc6bc930ef62990acdd1e1315`,
SCHOOL09A/B `c41b60bf8da3537104dfdb7ba8a525fa0983de7d`를 확인했다.
후자를 기반으로 독립 worktree/branch `feature/school-09c-authz-decision`을 만들었다.
이전 브랜치/통합을 덮어쓰지 않았다. 이전 입력991파일 SHA-256을 보존·검증한다.
최종 commit/remote/clean/manifest는 다운로드 패키지의 `GIT_RECEIPT.json`을 기준으로 한다.

## 2. 권고 모델과 근거

**A2: 기존 비소유 Workspace 역할 + Auth-owned 무인자 boolean bridge**를 기술 권고로 선택했다.
A1(원시4열 전용 grant), B(authenticated 중심), C(BFF 중심)의 가능성/위험/회수/GRANT/복잡도/변경량은
`DECISION.md`의 비교표에 있다. B/C를 JWT-only 또는 service_role로 바꿔 기존 보장을 약화하지 않는다.

A2에서 Workspace 역할과 client는 auth.sessions 어느 열도 SELECT하지 못한다.
Auth owner의 새 비노출 함수2개만 요청의 UID/session_id를 live Auth row와 대조해 boolean으로 반환한다.
private session_ok/recent_login은 이 boolean과 기존 account/revocation 검사를 결합한다.
기존7일/10분/exp/not_after 조건과 실시간 멤버십/epoch/권한 상한을 보존했다.
따라서 Workspace 역할의 **auth.sessions 직접 SELECT가 필수라는 가정은 제거**했다.

다만 Auth owner의 private 함수 설치/위임이 실제 Managed 환경에서 가능한지는 **NOT VERIFIED**다.
Auth owner는 Auth table 소유권 때문에 높은 권한을 가진다. 고정 빈 search_path·무인자·동적SQL 없음·boolean 반환,
private 노출/ACL·정의 지문·소유자 통제와 Workspace content 접근권한0으로 경계를 제한한다.
Auth RLS나 owner를 바꾸지 않고, postgres/service_role 우회를 쓰지 않는다.
ws_owner의 auth.users.id REFERENCES 및 새 Workspace 역할 생성/SET/소유권 조건은 여전히 확인해야 한다.

## 3. 실제 SQL·54 RPC 영향

- CLI 생성 migration: `20261105161659_auth_bridge_bootstrap_prototype.sql`.
- 추가: Auth bridge2함수, bootstrap private command1함수, private control table4개, NOLOGIN/NOBYPASS 역할2개, 비노출 schema2개.
- 교체: workspace_private.session_ok/recent_login의 내부 구현2개. 해당 함수 소유자 reader 유지.
- 기존 public54의 서명/본문/소유자 변경0. 기존 업무 함수와 제품 DTO 변경0.
- 실제 최종 로컬 catalog: 함수159개(public54, workspace_private102, bridge2, operator1), table36개, Workspace/control RLS92개.
- 새 DEFINER3개 중 Auth2는 기존 Auth owner, operator1은 비소유 ws_bootstrap_executor. 기존 Workspace DEFINER owner/권한 의미 유지.
- 설치 직후54 RPC와 operator command는 CLOSED. PUBLIC/anon 차단, creator의 추가 default EXECUTE도 제거한다.

이것은 **one-shot LOCAL 설계 실험**이다. 기존 S08 CLOSED 설치 이후 patch로 검사했다.
S08 baseline은 합성4열 fixture grant로 설치한 뒤 patch transaction에서 bridge로 전환·원시 grant를 철회한다.
처음부터 GRANT 없이 설치 가능한 Hosted fresh 누적본을 만들었다고 주장하지 않는다.
09D에서는 과거 capability checker/설치 선행조건을 바꾸고 새로운 CLOSED 누적 migration·fingerprint/lifecycle를 검증해야 한다.
기존 S08 장부를 새 구조 지문으로 재기록하지 않았으며, 부모 installer/activation은 의도된 drift를 거부한다.
반복 patch는 안전하게 거부한다. 실패 주입 시 helper/권한 변경까지 transaction rollback됨을 확인했다.

## 4. 최초 관리자 정책 초안

NEIS 교육청+학교코드·신뢰 directory → 신청 pending → 담당자A의 재직/위임·계정 통제·신청자 동의 확인 →
담당자B 독립 확인 → 서버 현재 상태/학교/대상/만료/버전 재검증 → 최초 관리자와 학교 활성·감사 동시 기록을 권고한다.

일반 사용자는 학교코드·Google email/metadata·개인 학교 프로필만으로 관리자가 될 수 없다.
운영자 권한은 별도 DB principal role+allowlist이며 기존 학교 관리자 또는 authenticated 요청에 부여하지 않는다.
운영자도 raw table을 수정하지 않고 목적별 command만 호출한다. 실제 operator identity로 감사한다.
증빙 원문 대신 case/consent 참조와 hash만 보관한다. 이 역시 제한된 운영 데이터다.

로컬 fixture는 운영자가 **외부 검증을 완료했다고 가정한 합성 입력**이다. 실제 재직/위임/동의를 검증한 것은 아니다.
운영 책임기관·담당자·증빙·독립 승인·기간/복구 절차는 최종 운영 결정이 필요하다.
추가 관리자는 기존 propose→accept, 지원강사 상한·복수 관리자·마지막 관리자 보호·학교 분리·감사 계약을 유지한다.
복구 잠금 학교를 최초 개설로 재처리하는 경로는 제공하지 않는다.

## 5. 개인정보·보존 결정

학교 공동 업무/일정/전달/물품/감사만 허용하고 학생 이름·건강·상담·투약·처치·일지 원문은 금지한다.
개인 DESK/Finance/Inventory는 업로드하지 않는다. 인증 token/비밀번호를 Workspace 업무/audit에 저장하지 않는다.
Main 암호 vault와 BFF 비밀 store는 별도 인증 경계다.
자유 입력은 기존 서버 길이/금지 검증과 안내를 유지하지만 완전 탐지는 보장하지 않는다. 원문 AI 전달·첨부는 없다.
퇴직/전근/계약종료/탈퇴 때 접근은 종료하고 학교 기록은 학교 소유로 남긴다.
목적별 보존기간, 삭제/백업 처리, 국외저장 고지, 검증 책임·복구 SLA는 `POLICY_DECISIONS.md`의 NEEDS DECISION이다.

## 6. 실행 검증

| 스위트 | 환경 | 결과 |
|---|---|---|
| 새 Auth/설치/권한·bootstrap·감사·멱등성/버전 | LOCAL DB | 47 PASS /0 FAIL |
| 기존 계정/RLS 불변조건 | LOCAL DB |34 PASS /0 FAIL |
| 기존 가입·승인 | LOCAL DB + MOCK Auth |22 PASS /0 FAIL |
| 기존 공동 업무 | LOCAL DB + MOCK Auth |21 PASS /0 FAIL |
| 기존 일정·인수인계 | LOCAL DB + MOCK Auth |22 PASS /0 FAIL |
| 기존 Inventory domain | LOCAL DB |31 PASS /0 FAIL |
| 실제 API/JWT·회수·CLOSED54·bridge/operator 노출 차단 | LOCAL PostgREST13.0.4 |23 PASS /0 FAIL |
| 기존 Auth/Main/Preload MOCK69 | 동일 입력 c41b60b 증거 재사용 | REFERENCED, 신규 실행으로 합산 안 함 |
| Hosted Auth/PostgREST/실계정·Windows·Chromium | REAL | NOT RUN |

로컬 DB 핵심 스위트 합177, 로컬 HTTP23. 별도 fresh CLOSED catalog 검증1개는 아래와 중복 합산하지 않는다. results.json의70 = DB47+HTTP23이며 별도표와 중복 합산하지 않는다.
S01~04 회귀99는 Auth bridge 최종 본문/ACL 기준으로 재실행했다. 이후 bootstrap의 NULL 버전 검사만 최소 수정해
기존 회귀99는 재사용하고 새47/Inventory31/HTTP23을 재검증했다. 결과 반복 횟수를 고유 시나리오로 세지 않는다.

실제 검사: ws/client의 raw Auth SELECT 거부, public/default EXECUTE 차단, 승인·학교/role/epoch,
관리자 셀프승격/본인승인 차단, operator 독립성·권한 철회·증빙/동의 불일치/24h 만료,
첫 관리자1명·마지막 관리자 보호, request_id payload/버전NULL·충돌·중복,
audit 실패 시 승인 전체 rollback, 실제 HTTP JWT 서명/만료/학교/세션회수,
54 CLOSED108요청(한 묶음), private schema 비노출, 조작 operator JWT role 거부를 실행했다.
합성 JWT는 Hosted Supabase JWT 검증 결과가 아니다.

## 7. 자율 수정·기존 제품

fixture account UUID 고정 가정, PL/pgSQL receipt 변수 해석, default ACL 추가 grantee,
NULL expected_version 비교 오류를 최소 수정했다. 위 네 결함은 각각 실질 수정1회다. 별도 catalog exporter 시작 실패는 로그 분석 후2가지 수정으로 해결했다. 실패 로그/원인·검증은 QA_FIX_LOG.md에 보존한다.
CLI 설정은 지원 SUPABASE_HOME만 분리했다. Auth 세션/학교 격리·권한 상한을 약화하지 않았다.
제품/Electron/Web/DPAPI/Finance/개인 자료/기존 SQL 변경0. 인증 실패와 개인 기능의 분리 계약도 변경하지 않는다.
Python 문법·Bash 문법·입력/SQL hash·git diff 검사를 수행한다.
새 TypeScript/제품 코드가 없으므로 제품 빌드·UI 재검증은 NOT RUN이다. 기존 type13/xlsx403을 이번 새 실패/PASS로 재분류하지 않는다.
기존 Windows PASS는 기존 통합 SHA의 역사적 증거로 보존한다.

## 8. Hosted 확인·09D 승인 범위

이번 Hosted 추가 관측0. 과거 제공 metadata를 현재 실검증으로 확대하지 않았다.
`sql/hosted-readonly.sql`에 Auth owner/role SET/REFERENCES/schema/함수/열/default ACL 추가 SELECT를 준비하고 로컬에서 실행했다.
필요한 조건/승인 단계는 `OAUTH_AND_09D_GATES.md`를 따른다.

1. Auth owner bridge 설치 위임과 managed 역할/FK 권한의 실현 가능성, 기존 SD20/경고19 내부 도달성 확인.
2. 최초관리자 담당/증빙/동의·신뢰 directory·보존/국외저장·복구 정책 결정.
3. 검토된 Hosted용 새 누적 SQL·새 lifecycle/CLOSED·backup/rollback 문서 및 로컬 재검증.
4. 정확한 SHA/SQL/hash와 권한 변경 목록에 대한 별도 운영 변경 승인.
5. 별도 실계정 Hosted 시험 승인 후 Google provider/redirect·PKCE·JWT/JWKS·refresh/logout·세션수명/PostgREST 부정 시험.
6. 보안/정책/Windows 영향 Gate 충족 후 별도 product 공개 승인.

**운영 적용은 BLOCKED**, 로컬 설계·증거 패키지는 **CONDITIONAL**이다.
09D의 준비·추가 감사는 가능하지만 운영 migration/로그인 시험·배포 승인 준비 완료는 선언하지 않는다.
