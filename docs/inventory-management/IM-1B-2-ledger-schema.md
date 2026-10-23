# IM-1B-2 재고 변경 원장 스키마

## 구현 범위

로컬 QA migration [`20261023033015_inventory_ledger_foundation.sql`](../../inventory-management/qa/supabase/migrations/20261023033015_inventory_ledger_foundation.sql)에 세 객체를 추가했다. 기존 `medication_*` 객체는 생성·수정하지 않았다.

### `inventory_stock_movements`

- UUID PK `movement_id`, tenant 키 `school_id`, `item_id`, `lot_id`
- 유형: `INITIAL_BALANCE`, `RECEIVE`, `USE`, `DISPOSE`, `ADJUST`, `REVERSAL`
- `quantity_before + quantity_delta = quantity_after`, 전후 잔량 0 이상, delta 0 금지
- `(school_id,item_id,lot_id)` 복합 FK로 lot와 item의 학교·품목 일치를 동시 검증
- `(school_id,related_movement_id)` 자기참조 FK와 한 원본당 하나의 reversal unique index
- 동일 `(school, actor, request, lot, movement_type)` 중복 방지
- UPDATE/DELETE를 SQLSTATE `55000`으로 거부하는 append-only trigger

복수 lot 업무는 lot별 한 행을 남긴다. 전후 수량은 item 총계가 아니라 해당 lot 잔량이다.

### `inventory_audit`

업무·보안 행위를 `action_type`, `target_type`, `target_id`, `request_id`, `reason`, 최소 JSON object `details`로 기록한다. actor 삭제는 제한하므로 사용자 비활성화 후에도 이력이 남는다. UPDATE/DELETE는 append-only trigger가 거부한다.

### `inventory_idempotency_requests`

요청 범위 unique key는 `(school_id, actor_user_id, operation, request_uuid)`다. `payload_hash`는 소문자 SHA-256 64자리 형식만 허용한다. 상태는 `PROCESSING` 또는 `COMPLETED`이며 완료 상태에서만 응답과 완료 시각을 요구한다.

후속 RPC가 `PROCESSING`을 `COMPLETED`로 바꿔야 하므로 이 테이블에는 append-only trigger를 적용하지 않았다. 대신 클라이언트 역할에는 SELECT 포함 모든 권한을 부여하지 않았다.

## 인덱스·검증

movement는 item/lot/actor/time과 중복·reversal을, audit는 school/actor/request를, idempotency는 상태와 unique scope를 인덱싱한다. clean reset 후 세 테이블, RLS/FORCE RLS 3/3, 정책 2개, 제약조건 30개, 인덱스 14개를 실제 catalog에서 확인했다.
