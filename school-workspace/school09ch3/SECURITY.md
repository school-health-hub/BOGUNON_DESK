# 인증 경계와 공식 근거

2026-11-06 KST 검토. 공식 링크와 관측 출처는 reference/official-sources.json에 기록한다.

- [관리형 스키마 제한 공지](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025)
- [전용 역할의 Auth 접근에 대한 공식 대안](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7)

공식 문서는 사용자 소유의 비노출 스키마에서 제한된 postgres SECURITY DEFINER를 사용하거나 신뢰된 request claims를 직접 읽도록 안내한다.
문서의 사용자 UUID 입력 예시는 이 제품에 사용하지 않는다. 함수는 인자를 받지 않고 현재 sub/session_id에만 결합된다.
기존 H2 bridge도 별도 스키마였으나 소유자가 Auth 관리 역할이어서 SET/소유권 위임에 의존했다. H3는 그 소유권 의존성을 제거한다.

| 객체/호출 주체 | 소유자·실행 문맥 | 접근 경계 |
|---|---|---|
| public54 wrapper | 기존 ws_owner/INVOKER 그대로 | QA 승인 후 authenticated 목적별 EXECUTE, 기본 CLOSED |
| 업무 목적 구현 | 기존 ws_runtime/NOBYPASSRLS | 현재 membership/epoch/권한/RLS 재검증 |
| session_ok/recent_login | ws_authz_reader/NOBYPASSRLS | Auth bridge와 Workspace 계정/회수 상태 확인 |
| request_uid/request_jwt | ws_owner/INVOKER | Data API의 request.jwt.claims JSON만 읽음. user_metadata 인가 없음 |
| bridge boolean2 | postgres/SECURITY DEFINER | STABLE·고정 빈 search_path·완전 수식 Auth 참조·인자 없음·boolean만 반환 |
| bridge EXECUTE | ws_authz_reader만 | PUBLIC/anon/authenticated/ws_runtime/ws_owner 직접 실행 불가 |
| 업무 테이블 | ws_owner/NOBYPASSRLS | ENABLE+FORCE RLS, 원시 클라이언트 권한 없음 |
| bootstrap command | ws_bootstrap_executor/NOBYPASSRLS | 별도 비노출 스키마, operator EXECUTE도 기본 CLOSED, 사용자 자기승격 불가 |

postgres의 BYPASSRLS를 숨기지 않는다. 이 역할로 일반 업무 RPC를 실행하거나 Workspace RLS를 우회하지 않는다.
상시 postgres 소유 함수는 Auth 세션을 읽는 boolean2개뿐이다. SQL 동적 실행·학교 데이터 반환·사용자 지정 UUID 인자가 없다.
Workspace 역할은 authenticated를 상속하지 않으며 Auth USAGE·원시 테이블/열 SELECT도 없다.
원시 Auth 읽기는 기존 설치 신원에 이미 있는 권한을 이 두 함수가 좁게 캡슐화한다. 신규 SQL이 그 권한을 부여하지 않는다.

## 유지한 인증 의미

C의 bridge 두 본문은 그대로다. private helper 두 본문은 auth.uid/jwt 접근을 같은 JSON claims 식별 helper로 치환한다.
현재 UID/session 일치, JWT exp, anonymous 차단, 기존7일 age/10분 recent-login,
not_after, Workspace revoked_sessions, accounts 상태, 현재 학교 membership·유효기간·epoch는 유지한다.
새 공개 RPC·토큰 저장소·BFF 우회·service_role 요청을 만들지 않는다.
실제 Hosted auth.uid/jwt 문맥, 서명/JWKS, refresh/logout/전역회수 시점은 별도 승인 시험 전 NOT VERIFIED다.
이전 요청 진행 중인 transaction까지 강제 취소한다고 주장하지 않는다. 다음 요청의 현재 DB snapshot에서 회수를 검사한다.

## 사용자 삭제 계약

accounts.user_id의 Auth FK와 ON DELETE SET NULL을 보존한다. 이를 제거하면 삭제된 관리자를 유효 관리자처럼 셀 수 있다.
권한 있는 기존 postgres가 자기 Workspace의 accounts 테이블과 FK를 생성하고, 바로 ws_owner로 소유권을 이관한다.
Workspace 역할에는 Auth REFERENCES/USAGE/SELECT를 부여하지 않는다. 나머지 업무 DDL과 seed 정책은 임시 NOBYPASS 설치자/소유자 문맥이다.
Auth schema/테이블에 사용자 trigger나 함수를 만들지 않는다. Hosted의 FK/Workspace 소유권 이관 허용은 실제 적용 전 확인한다.

## 변경하지 않은 사항

개인 자료·제품 UI·인증 어댑터·DPAPI·개인 Inventory·기존19 경고 함수는 수정하지 않는다.
최초 관리자 실재직 확인 책임·독립 승인자2인·증빙/업무 보존기간은 승인되지 않은 기존 초안 상태다.
bootstrap 설치는 운영자 등록/승인을 의미하지 않는다. 합성 fixture 외에 사용자·학교 데이터를 만들지 않는다.
