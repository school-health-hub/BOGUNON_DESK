# IM-1B-3 보안 검토

## 권한

- 함수 소유자 권한이 필요한 쓰기 경계를 단일 RPC로 제한
- `SECURITY DEFINER` + `search_path=''` + 모든 객체 fully-qualified
- PUBLIC/anon EXECUTE false, authenticated true
- membership role은 DB 테이블과 `auth.uid()`만 사용
- user metadata는 권한 판단에 사용하지 않음
- lot UPDATE, movement/audit/idempotency 직접 DML은 authenticated false 유지

Catalog 확인값은 `EXECUTE true|false|false`, 직접 DML `false|false|false|false`였다. 로컬 `medication%` 객체 수는 0으로 기존 medication 영역을 생성·변경하지 않았다.

타학교 school/item 요청은 membership 단계에서 동일한 `PERMISSION_DENIED`를 반환해 객체 존재 여부를 감춘다. SQL은 정적이고 동적 SQL을 사용하지 않아 입력값이 SQL 구문으로 해석되지 않는다.

## 실제 JWT E2E

로컬 Auth에 `@example.invalid` 합성 계정을 생성하고 실제 access token으로 `/rest/v1/rpc/inventory_use_stock`을 호출했다. 최초 2개 차감, 동일 요청 replay, 변경 payload HTTP 409 및 `IDEMPOTENCY_CONFLICT`, DB 잔량 3과 movement 1건을 확인했다. local anon key와 access token은 출력·문서·report에 저장하지 않았다.

## 잔여 위험

- 운영 Supabase의 PostgREST 버전과 실제 migration 적용 상태 미확인
- 운영 backup/PITR 미확인
- 사용자 세션 즉시 취소 정책 미확정
- application 계층의 serialization/deadlock 제한 재시도 미구현

검증 종료 후 clean reset을 다시 적용해 학교 0건, `@example.invalid` Auth 사용자 0건을 확인했다. 세 migration과 RPC만 남긴 뒤 `inventory_qa` stack만 중지했고 전용 volume은 보존했다. 기존 `bogunon` 컨테이너 ID와 상태는 유지됐다.
