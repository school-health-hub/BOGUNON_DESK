# 승인 후 적용 절차 / Cloud B 인계

## 적용 전 중단 조건

- 대상 project ID/리전/DB 운영자/현재 통합 SHA를 별도 확인. GUC marker는 승인 기록일 뿐 실제 프로젝트 신원 증명이 아니다.
- 백업/PITR 제공 여부, 복구 권한·연락 담당자·복구 목표, 최근 복원 훈련 증거 확보. 이 단계에서는 백업 생성/운영 복원도 실행하지 않았다.
- public/Workspace 이름 충돌, 신규 역할 선점, 기존 Auth 소유권/관리형 제한, grant option, auth.sessions RLS, postgrest schema/role 노출 확인.
- 관리형 역할 생성 및 SET ROLE 권한 미확인 시 foundation부터 실행 금지. postgres/service_role 우회로 인가 테스트를 통과시키지 않는다.
- Auth 최소권한 가능 여부 미확인/불가 시 core BLOCKED. foundation만 설치된 상태는 애플리케이션 데이터 없이 안전하게 남겨두고 원인을 검토한다.
- 기관 이용 근거/국외 저장 고지·보존기간·최초 관리자 운영 책임·directory 공급자 결정 전 운영 기능 활성화 금지.

## 최소 Auth 계약 — 자동 GRANT 없음

ws_owner: auth schema USAGE, auth.users.id REFERENCES만 필요. 사용자 목록 SELECT 불필요.
ws_runtime: auth schema USAGE, auth.uid()/auth.jwt() EXECUTE. auth.sessions SELECT 불허.
ws_authz_reader: 같은 함수 EXECUTE 및 auth.sessions의 id/user_id/created_at/not_after **열만** SELECT. table-wide 또는 추가 열 SELECT 불허. 세 역할 모두 NOLOGIN/NOBYPASSRLS/비슈퍼이며 ws_owner가 테이블 소유, runtime/reader는 비소유자다.

실제 관리형 소유자는 이전 감사상 supabase_auth_admin이었으나 최신 상태는 NOT VERIFIED. 기존 소유권 변경·auth.sessions GRANT·Auth RLS 변경은 이번 범위가 아니다. 사전검사는 가능성을 조회할 뿐 승인 또는 실현 가능성 증명이 아니다.

불가능할 때 대안은 연결을 닫아두고 별도 보안 설계 검토: Auth 소유자 관리의 좁은 boolean 검증 함수 또는 신뢰 BFF 세션 증명 계약. 이 대안은 구현/승인하지 않았다. JWT만 믿도록 완화하거나 service_role 요청 실행으로 우회하지 않는다. 기존 session_ok의 7일 세션 신선도 규칙도 그대로 보존하며 실제 refresh/만료 정책과의 적합성은 Hosted 검증 대상이다.

## 승인된 적용 실행 순서

아래는 절차 명세다. 이번 작업에서는 실행하지 않았다.

1. 변경 승인번호와 변경 창, 롤백 담당자를 기록한다. 백업/복원 가능성을 확인한다.
2. 읽기 전용 preflight 결과를 보관하고 기존 public 객체 정의/ACL 체크섬 기준을 만든다. 실제 사용자 행/토큰은 추출하지 않는다.
3. 직접 migration 세션에서 `bogunon.ws_target_project`를 정확한 project ID로, `bogunon.ws_change_ticket`을 승인번호(8자 이상)로 설정. 접속 대상은 운영자가 별도 검증한다. SET ROLE 상태로 설치하지 않는다.
4. foundation → 별도 Auth 최소권한 승인/검증 → core 순으로 psql ON_ERROR_STOP 상당의 중단 조건으로 실행한다. 절대 tests/fixtures를 운영 적용하지 않는다.
5. 아래 장부/카탈로그 검사로 CLOSED 상태 확인. public 신규39 함수와 private 목적별 진입점 authenticated EXECUTE가 없어야 한다. 기존 public 개체 정의/권한 변화가 없어야 한다.
6. 별도 승인된 Hosted Auth 테스트 계획/합성 테스트 계정 처리·삭제/감사·네트워크 조건을 확정한다. 이번 단계에서는 실제 계정을 생성하지 않았다.
7. 테스트 승인 후 `bogunon.ws_rpc_activation_ticket`을 별도 승인번호로 설정하고 activation을 검토한다. Production 클라이언트 Gate는 여전히 꺼둔다.
8. Hosted Auth/JWT/세션 회수/PostgREST/학교 격리 및 Cloud B Windows QA까지 통과 후 별도 제품 Gate 승인을 받는다. 단순 UI 플래그로 인가를 대체하지 않는다.

검사 예시(운영 실행은 별도 승인):
```sql
SELECT phase,digest,state FROM workspace_private.s06_install_manifest;
SELECT public_signature,private_signature FROM workspace_private.s06_rpc_manifest ORDER BY 1;
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls FROM pg_roles
 WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader');
SELECT schemaname,tablename,policyname,roles,cmd FROM pg_policies
 WHERE schemaname IN('workspace','workspace_private') ORDER BY 1,2,3;
```
앱 자격으로 장부를 읽도록 권한을 늘리지 않는다.

## 실패 및 복구

foundation 실패: transaction rollback. 같은 이름의 외부 개체를 삭제해서 해결하지 않는다.
core 중간 실패: core의 모든 앱 DDL/ACL/장부 변경 rollback, foundation 유지. 원인을 해결하고 동일 체크섬 재실행. 실패 테스트로 실제 검증한다.
설치 후 문제: 새RPC 차단(close) → product Gate 비활성 유지 → 증거 수집 → 새 호환 migration 검토. 기존 행과 audit를 삭제하지 않는다. DDL DROP/role 삭제/스키마 CASCADE는 자동 복구가 아니며 제공하지 않는다.
지문 드리프트: close는 새 호출을 닫고 closed_unverified로 남긴다. 코드가 변경된 상태를 새 정상 상태로 자동 채택하지 않는다. 승인된 원상복구 후 지문 검증/새 버전 적용이 필요하다. 이미 발생한 잘못된 사업 데이터 변경은 자동 되돌리지 않고 감사 기반 별도 복구한다.

## Cloud B

SCHOOL-06은 최신 통합 기준에서 새 폴더만 추가한다. Electron Main/Preload/Renderer, Account02B, Instructor 및 Windows 프로필 코드 변경 없음. Cloud B의 제품 변경을 덮어쓰지 않는다. Source SHA/최종 원격 차이는 최종 RECEIPT/보고서 참조. Cloud C는 integration/main을 병합하지 않는다.

실제 Windows 실행: 로그인 없이 개인 DESK, Workspace 미연결 안내, production 합성 인증 차단, renderer 토큰 비노출, 계정/학교 전환 정리, 980×700/900×680/모바일의 기존 기능 회귀. 이번 단계 WINDOWS REAL NOT RUN. Cloud B 기존 QA 결과를 이 단계의 새 PASS로 주장하지 않는다.
