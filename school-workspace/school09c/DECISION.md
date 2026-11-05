# Managed Auth 최소권한 모델 결정 초안

설계 권고: **A2 — 비소유 Workspace 실행 역할 + Auth 소유 boolean bridge**.
검증 수준: VERIFIED LOCAL. Hosted 실현성 NOT VERIFIED. 현재 운영 적용 BLOCKED.
운영자 정책·Hosted 권한 증거 없이 이 초안을 운영 확정/배포 승인으로 바꾸지 않는다.

## 후보 비교

| 기준 | A1 전용역할+기존4열SELECT | A2 전용역할+boolean bridge (권고 후보) | B authenticated+private 검사함수 | C Trusted BFF 세션검증 |
|---|---|---|---|---|
| Hosted 가능성 | 역할 생성/SET/소유권+Auth4열 grant 가능해야 함, 미검증 | 같은 Workspace 역할 필요. Auth 소유자가 private 함수2개 설치/위임할 수 있어야 함, 미검증 | public 호출역할은 기본 제공, 그러나 RLS helper owner/세션 live 검증 권한 문제는 남음 | 일반 Auth API 사용 가능하나 서버 영구세션/배포 미정 |
| RLS 우회 위험 | runtime/reader 비소유·NOBYPASS·FORCE RLS 유지 | 동일. Auth owner의 권한은 Auth 테이블에만 사용; Workspace content 권한을 새로 주지 않음 | authenticated 원시 DML을 주면 기존 원시 table 비공개 계약과 충돌. SD로 숨겨도 별도 최소권한 실행 문맥은 필요 | BFF를 service_role로 실행하면 불변조건 위반. 사용자 JWT/RLS 유지해야 함 |
| 세션 회수 | live session+Workspace revocation 매 요청 | 동일 검사, 원문 대신 boolean; 신호 캐시/TTL 없음 | JWT 단독이면 로그아웃 즉시 회수 보장 없음. live checker를 넣으면 A의 문제로 돌아옴 | getUser/JWT 검증만으로 세션 존재/다른 client logout을 즉시 보장한다고 볼 수 없음 |
| 필요한 권한 | ws_reader에 session id/user_id/created_at/not_after SELECT | ws 역할의 session SELECT0. reader에 고정 무인자 boolean함수2개 EXECUTE. Auth owner 설치 권한 필요 | 구체적 SD owner/GRANT 없으면 안전한 해법이 완성되지 않음 | 별도 online authority 또는 A의 bridge 필요; BFF proof 서명만으로 외부 로그아웃을 관측하지 못함 |
| Electron/Web | 동일54 RPC 사용 | 동일54 RPC 사용 | 클라이언트는 공통 가능하나 서버 인가 구조 재작성 증가 | Electron도 BFF 경유시 공통 가능, 호스팅 장애 의존성 증가 |
| 복잡도 | 운영 Auth4열 grant 관리 | 코드 경계는 좁아짐, Auth-owned bridge 배포/감사 책임 추가 | 기존 개인 서비스의 authenticated 역할 영향 관리, 회귀 위험 큼 | 서버 저장소/분산 lock/CAS·lifecycle·검증자 관리 증가 |
| 기존 변경 | 최소, 하지만 미해결 Hosted4열 grant 유지 | public54/업무함수 무변경, session_ok/recent_login2개 교체+bridge2개 | 테이블/RLS/함수 재작성 다수 가능, 정확한 변경량은 대안 구현 전 미확정 | 전체 요청 transport 및 운영 BFF 변경. 공개 계약은 유지 가능해도 연결 변경량 큼 |

A2는 **어떤 신뢰 경계도 Auth 세션 상태를 관측하지 않고 즉시 회수할 수 있다는 해법이 아니다**.
앱 실행 역할에 원시 Auth SELECT를 주는 것이 필수는 아님을 로컬에서 입증한다.
Auth 소유자라는 기존 신뢰 주체가 두 boolean만 위임한다. Hosted에서 그 위임을 지원하는지는 별도 증거가 필요하다.
호환성을 입증하지 못하면 A2 운영 적용은 중단한다. A1은 서비스가4열 위임을 명시 지원할 경우의 별도 검토 대안이다.
B/C를 JWT-only나 service_role로 약화해 자동 채택하지 않는다.

## 권한 경계

- Public54: 기존 ws_owner 소유 INVOKER/서명/본문 그대로. 기본 authenticated/anon/PUBLIC CLOSED.
- Workspace private: 기존 ws_runtime/ws_authz_reader nonowner, NOLOGIN/NOBYPASSRLS와 FORCE RLS 유지.
- Auth bridge: 새 비노출 schema `workspace_auth_bridge`, Auth owner `supabase_auth_admin` 소유.
  `session_valid()`·`recent_login()`은 고정 빈 search_path, 무인자, 동적SQL 없음, boolean만 반환.
  임의 사용자/세션 ID를 받지 않고 요청의 auth.uid()/auth.jwt()와 현재 Auth 행을 결합한다.
- ws_authz_reader만 bridge schema USAGE+두 함수 EXECUTE. runtime/owner/client는 직접 실행 불가.
- Auth owner에게 Workspace content 권한이나 앱 역할 membership을 부여하지 않는다.
- 기존 Auth 함수 정의·Auth owner·Auth RLS 자체는 변경하지 않는다. **새 private 함수의 소유권**만 그 신뢰 경계를 따른다.
- Auth owner는 원래 Auth 전역 권한을 갖는 높은 신뢰 주체다. Auth 테이블 소유자의 RLS 우회 가능성은 이 작은 bridge 안의 세션 존재/시간 판정으로만 한정하며, Auth RLS 자체를 끄지 않는다. FORCE RLS나 managed 제약 때문에 읽을 수 없으면 거부하고 Hosted Gate로 남긴다. A1의4열 전용 reader보다 그 함수가 변조됐을 때의
  잠재 권한은 크므로, 소유자 제어·CREATE 권한·정의 SHA-256·고정SQL·노출/ACL 검사를 운영 Gate로 둔다.
  이를 막연히 ‘DEFINER이므로 안전’이라 설명하지 않는다. postgres/service_role 소유 우회가 아니다.
- accounts.user_id의 auth.users FK와 ws_owner의 id REFERENCES는 **여전히 설치 선행조건**이다.
  bridge가 그 FK 권한/역할 생성 문제까지 제거했다고 주장하지 않는다. Auth 삭제 시 계정 user_id NULL, 학교 기록 유지 계약도 그대로다.

## 세션 의미 보존

기존 JWT exp/anonymous/sub↔session_id, session.created_at7일, not_after, 최근10분 조건을 그대로 유지한다.
Workspace account/멤버십/유효기간/epoch/역할/개별권한은 기존 live DB 검사다. user_metadata는 사용하지 않는다.
로그아웃으로 Auth session이 제거되거나 Workspace revocation이 기록되면 기존 JWT도 다음 요청에서 거부된다.
진행 중인 transaction 강제종료를 보장하지 않는다. DB 조회 단위의 최신 committed 상태 기준이다.

Google 재인증이 실제 새 session.created_at을 발급하는지, Auth timeout이 언제 정리되는지, 어떤 signOut scope인지,
Hosted JWKS·JWT·PostgREST 문맥은 NOT VERIFIED다. 7일/10분을 iat/사용자 주장으로 대체하지 않는다.
Supabase 세션 문서는 signOut 제거와 timeout 정리 지연을 구분한다.
https://supabase.com/docs/guides/auth/sessions

## 이번 SQL의 위치

새 migration은 기존 S08 CLOSED 설치 위의 **one-shot LOCAL 실험 패치**다. Auth bridge와 bootstrap-control을
하나의 transaction으로 설치한다. 운영용 migration으로 자동 조합/활성화하지 않는다.
이 변경은 S08 구조 지문을 의도적으로 바꾸므로 부모 장부를 재기록하지 않는다. S08 installer/activation은 drift를 거부해야 한다.
09D에서 승인된 fresh 누적 설치본·새 release fingerprint·Auth capability checker를 작성/검증해야 한다.
반복 패치 실행은 안전하게 거부한다. 운영 deployment-ready migration을 완성했다고 선언하지 않는다.

## 런타임 증명과 fresh 설치의 구분

이번 시험은 기존 S08 baseline을 보존하기 위해 합성 환경에서만 과거4열 fixture grant로 먼저 설치한 뒤,
동일 transaction의 실험 patch로 bridge 설치와 원시 grant 철회를 수행한다. **처음부터 그 GRANT 없이 설치 가능한
Hosted 누적 migration을 검증한 것은 아니다.** 09D fresh installer는 이전 Auth checker와4열 권한 선행조건을
교체하고 bridge/기존 helper 교체를 CLOSED app transaction 안에서 조합해야 한다.
부모 checker가 실패한다고 GRANT를 몰래 먼저 부여했다 철회하는 운영 절차를 권고하지 않는다.
