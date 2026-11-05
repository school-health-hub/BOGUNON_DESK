# 연결 계약 및 증거의 한계

| 항목 | 격리 검증 | 실제 Hosted |
|---|---|---|
| Auth UUID → 학교 멤버십 / 현재 상태·epoch | 합성 auth.users/sessions, 실제 RLS/RPC | NOT RUN |
| JWT sub/role/session_id | 실제 local PostgREST13.0.4 HS256 검증 + 합성 발급자 | GoTrue/JWKS/실제 서명 설정 NOT RUN |
| 잘못된 서명·만료 JWT | local HTTP 401 검사 | NOT RUN |
| 익명/원시 테이블/private 경로 | local HTTP/SQL 거부 | gateway/schema 노출 NOT RUN |
| public invoker→private definer→비소유 RLS | LOCAL DB + LOCAL POSTGREST | 신규 역할 생성/SET ROLE/EXECUTE NOT VERIFIED |
| 멤버십 정지/세션 행 제거 후 이전 JWT | 현재 요청에서 local DB 재인가 | 실제 Auth 로그아웃·회수 시 행 유지/삭제 의미 NOT VERIFIED |
| 관리자·교사·지원강사 상한/마지막 관리자 | 원본 SCHOOL01~04 local 회귀 | Hosted NOT RUN |
| Electron Main token소유 / renderer 비노출 | 실제 어댑터 클래스, 암호화/네트워크는 MOCK | Windows safeStorage/공식 callback NOT RUN |
| Web BFF HttpOnly/Secure/SameSite/Origin/CSRF/refresh경합 | 실제 BFF 클래스, 메모리 저장소/합성 provider | 영구 서버 저장소/호스팅/실제 refresh NOT RUN |
| 학교/계정전환 stale 응답, 로그아웃 정리 | 기존 회귀로 MOCK+LOCAL DB | Hosted/Windows NOT RUN |
| Production Workspace Gate/합성 불가 | 현재 통합 소스의 경계 테스트 | 배포·Windows NOT RUN |

기존 사용자 Supabase Auth UUID를 재사용하는 계약이며 이메일·실명·개인 로컬 학교 프로필로 권한을 승인하지 않는다. 개인 DESK 실행은 Workspace 인증과 독립이다. 인증 서버 오류나 미설치 DB가 개인 데이터를 업로드하거나 개인 화면을 잠그지 않는다.

OAuth 운영 사전조건: 실제 provider 사용 허용, 공식 redirect 등록(정확한 scheme/host/path), PKCE callback/state/flow/replay검증, 안전한 시스템 브라우저/loopback 또는 등록된 deeplink 방식 확정, Main safeStorage Windows 실패 정책, BFF cookie domain/TLS/CSRF/origin, 영구 서버 세션 저장소·암호화키·회수/TTL·동시 refresh, 실제 JWT 만료·refresh/logout·auth.sessions 라이프사이클을 별도 승인 후 검증해야 한다. 이번 패키지는 실제 로그인/redirect 변경을 수행하지 않는다.

운영 JWT가 자체 만료 전이어도 DB 멤버십 인가는 매 RPC에서 수행한다. 단, Auth 로그아웃이 실제 hosted session row와 어떤 관계인지 로컬 행 삭제 테스트만으로 보장할 수 없다. 서버 Auth 세션 회수 실동작은 활성화 전 필수 Gate다.

## 과거 운영 감사 자료 — 최신 상태 아님

사용자 인계상 PostgreSQL17.6, public RLS232, SECURITY DEFINER20(19개 authenticated EXECUTE 경고), Workspace schema/역할 미설치, auth.users/sessions 소유자 supabase_auth_admin, anon/authenticated sessions 직접조회 불가, public 개인 tasks/events/medication 사용자별 RLS. 20개 함수 고정 빈 search_path. 함수 본문 내부 인가/신규 도달성 미검증. 최신 운영 직접 조회는 이번 작업에서 하지 않았다.

기존 19개 함수(owns_project/receive_medication 포함)를 신규 RPC에 재사용하지 않으며 권한을 철회/확장하지 않는다. 새 private namespace와 신규 테이블 ACL/FORCE RLS가 직접 경계를 제공한다. 하지만 기존 postgres 소유 함수의 동적 SQL/임의 호출/인가 결함 가능성은 함수 본문 READ-ONLY 감사 전에는 배제할 수 없다. 로컬 sentinel 보존 테스트는 실제 함수의 취약점 검증이 아니다. 운영 활성화 전 별도 기존 함수 도달성 감사가 남는다.

## 판정

- SQL 구조/로컬 권한·회귀: 실제 실행 로그에 한정.
- Managed Auth 최소권한 실현성: NOT VERIFIED; 미충족이면 core 적용 BLOCKED.
- 신규 디렉터리 신뢰/최초 관리자 운영 승인/보존·고지/백업: NEEDS DECISION.
- Hosted Auth/PostgREST/Windows: NOT RUN.
- 전체: 운영 적용 준비 후보 CONDITIONAL. 운영 준비 완료/배포 PASS 아님.
