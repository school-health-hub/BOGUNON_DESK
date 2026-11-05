# Google OAuth 요구사항과 SCHOOL09D 승인 경계

## 로그인 연결 요구사항 (이번 실제 시험 없음)

- 기존 프로젝트 xxownwxxajzrviuvvfiu / Sydney 유지. 운영 Google provider 활성 상태·client 설정은 READ-ONLY 확인 대상.
- Google OAuth console의 승인 redirect는 Supabase provider callback, 앱의 Supabase redirect allowlist는 별도다.
  일반 hosted 예시는 `https://<project-ref>.supabase.co/auth/v1/callback`이지만 custom auth domain 여부를 먼저 확인한다.
  예시를 실제 확인된 운영 URI로 표시하지 않는다.
- Electron은 Main PKCE SDK/state/flow/replay 검사, 정확한 승인 custom protocol callback 또는 승인된 OS 경로만 사용한다.
  OS 등록/단일 인스턴스 인계/복수 창/취소/재사용/공식 provider query 유지 실제 동작은 Windows+Hosted 별도 시험.
- Web은 승인 HTTPS BFF callback, origin, Secure/HttpOnly/SameSite __Host handle cookie, CSRF/Origin 검증을 유지한다.
- 동일 Auth UUID를 사용한다. email/실명/user_metadata는 학교 인가 근거가 아니다.
- Main refresh token은 Windows safeStorage/DPAPI와 인증 전용 경로에 저장하고 Renderer 토큰 반환 금지.
- Web refresh token은 서버 비밀 저장소에만, browser에는 무작위 session handle. 운영 저장소·다중 인스턴스 pending flow/lock/CAS·암호화·백업 책임을 확정해야 한다.
- production에서 메모리 test store/합성 토큰/가상 학교를 활성화하지 않는다. 일반 요청 service_role 금지.
- logout은 로컬 세션/학교 상태부터 제거하고 공식 Auth signOut(local) 결과를 확인한다. 원격 실패는 unconfirmed, 회수 성공을 가장하지 않는다.
- 계정/학교 전환은 generation 증가/이전 요청 취소/지연 응답 폐기. 이전 학교 cache·구독·업무 상태 제거.
- 새 요청은 서버 live school membership/epoch와 Auth session을 재검증한다. JWT role/app_metadata에 학교관리자 상태를 캐시하여 승인하지 않는다.
- 최근10분 정책이 요구하는 새 로그인과 Google 계정 선택은 동의어가 아니다. 실제 session.created_at과 provider 재인증 행동을 별도로 검증한다.

## Hosted 추가 READ-ONLY 증거

`sql/hosted-readonly.sql`을 ChatGPT에 전달한다. 기존09A/B SELECT와 함께 사용한다.
확인 목적: Auth owner/함수/테이블 RLS/권한, 현재 observer의 SET ROLE 가능 여부, 이름 충돌,
기존 public DEFINER 도달성, Data API 노출 설정이다. 키/JWT/사용자/세션 행은 수집하지 않는다.
권한 거부/미노출은 NOT VERIFIED로 남긴다. 다른 프로젝트/인증정보로 우회하지 않는다.

## SCHOOL09D 진행 조건

| Gate | 필요한 완료 증거 | 이번 상태 |
|---|---|---|
| D0 설계 선택 | A2 Auth-owner bridge를 운영에서 위임 가능한지 운영자/서비스 지원 확인 | NOT VERIFIED |
| D0 Auth users FK | ws_owner REFERENCES(auth.users.id), 새 역할 생성/SET/owner 변경 가능성 | NOT VERIFIED |
| D0 기존 함수 | 기존 SD20(경고19) 내부 인가·동적SQL/Workspace 도달성 READ-ONLY 감사 | NOT VERIFIED |
| D0 정책 | 최초관리자 담당·독립 승인·directory·보존/국외저장·복구 책임 결정 | NEEDS DECISION |
| D1 SQL 후보 | 기존 설치본을 덮어쓰지 않는 새 fresh 누적 migration·최소권한 checker·새 fingerprint/lifecycle·승인 배포 신원의 operator allowlist provisioning RLS/권한 작성 및 PG17 재검증 | NOT IMPLEMENTED;09D 범위 |
| D1 CLOSED | public54 및 bootstrap-control 기본 CLOSED, bridge private nonexposed, grant matrix/소유자/비파괴 close 확인 | LOCAL 실험 검증만 |
| D1 운영 변경 승인 | 정확한 SHA/SQL/hash·역할/함수/GRANT 목록·담당/변경창·백업/복구 증거를 검토한 명시적 승인 | NOT APPROVED |
| D2 Hosted 시험 승인 | 테스트 계정/학교 범위·책임·데이터 정리·provider/redirect·JWT/refresh/logout 시험 계획 | NOT APPROVED / NOT RUN |
| D3 공개 승인 | 실 Auth/PostgREST 부정 시험·Windows 영향 QA·개인정보/운영 Gate 완료 후 별도 product Gate 활성화 | NOT READY |

이번 작업은 D0의 로컬 설계 증거를 제공한다. **D1 운영 migration·Auth 변경·사용자 생성/로그인은 승인하지 않았다.**
09D 착수는 위 미결정/Hosted 증거를 해소하는 준비 작업부터 가능하지만 운영 적용 승인 준비 완료가 아니다.
현재 프로토타입을 운영 SQL Editor에 붙여넣거나 local guard/DB 이름을 바꿔 적용하지 않는다.

## 안전한 적용·복구 원칙

- 운영 적용 전 최신 metadata·public 정의/ACL/RLS 지문·백업/PITR 및 실제 복원 책임 확인.
- 승인된 새 foundation→Auth-owner bridge 선행조건→단일 app transaction→CLOSED 검증 순서를 정한다.
- Auth bridge 생성/소유 위임은 현재 auth.users/sessions의 소유권/RLS 변경이 아니다. 그 작업도 별도 운영 승인 대상이다.
- 설치 중 CREATE 함수의 PUBLIC 기본 EXECUTE는 같은 transaction에서 REVOKE. 미완성 앱/권한 노출 커밋 금지.
- 실패하면 gate CLOSED 유지·transaction rollback·데이터 삭제 없는 endpoint 폐쇄 우선.
- 기존 S08 장부를 변경해 실험 patch를 정상 릴리스로 위장하지 않는다. 새 version의 fingerprint와 복구 경로를 재검증한다.
- Auth bridge를 설치할 권한이 없으면 STOP. ws_runtime을 postgres로 바꾸거나 service_role로 BFF 요청을 보내지 않는다.
