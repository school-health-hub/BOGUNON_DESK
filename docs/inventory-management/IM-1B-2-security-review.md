# IM-1B-2 보안 검토

## 권한 경계

- 세 신규 테이블 모두 RLS와 FORCE RLS 활성화
- `authenticated`는 movement와 audit SELECT만 보유하며 정책이 행을 제한
- idempotency는 `authenticated`와 `anon`에 SELECT/DML 권한 없음
- movement와 audit는 클라이언트 INSERT/UPDATE/DELETE 권한 없음
- append-only trigger helper는 PUBLIC, anon, authenticated EXECUTE 없음
- 신규 업무 RPC와 SECURITY DEFINER 함수 없음

teacher_admin은 활성 membership 학교의 movement·audit 전체를 읽는다. instructor는 본인이 actor인 movement만 읽고 audit는 읽지 못한다. 비소속·비활성·타학교 사용자는 읽지 못한다. actor와 역할은 user metadata가 아니라 `auth.uid()`와 membership helper로 판정한다.

## Data API와 격리

public schema 노출에 대해 GRANT와 RLS를 함께 적용했다. API key 없이 실제 local REST endpoint를 호출했을 때 세 테이블 모두 HTTP 401이었다. SQL role 테스트에서는 authenticated client의 직접 write privilege가 모두 false였다. 실제 로그인 JWT E2E는 아직 수행하지 않았고 Postgres role + `request.jwt.claims` 테스트와 구분한다.

config의 project ID는 `inventory_qa`이고 운영 ref·URL·key를 포함하지 않는다. 기존 `bogunon` 컨테이너와 volume에는 명령을 보내지 않았다. Windows Docker가 56321-56327 일부를 `0.0.0.0`에 publish하므로 검증 종료 후 Inventory QA stack만 중지했다. 전용 DB·Storage·Edge Runtime volume은 재현용으로 보존했고 56320-56327에는 새 LISTENING socket이 남지 않았다.

## 잔여 위험

- 업무 RPC의 actor/school 검증과 고정 `search_path`는 IM-1B-3에서 검증 필요
- 실제 JWT 로그인 E2E 미완료
- 운영 Supabase schema, backup, PITR 미확인
- 운영 재고 권위 원본 미결정
