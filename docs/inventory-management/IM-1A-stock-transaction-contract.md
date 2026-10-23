# IM-1A 재고 트랜잭션 계약

## 공통 DTO

요청: `request_id UUID`, 선택 school, 업무별 payload, `reason`, 클라이언트 시각(감사용, 권위 없음). 응답: `request_id`, `status=applied|replayed`, movement IDs, lot별 전후 잔량, item 가용/총재고, server timestamp.

멱등 범위는 `(school_id, actor_user_id, operation_type, request_id)`다. 서버가 정규화한 업무 payload의 hash도 저장한다. 동일 범위·동일 hash는 저장된 결과를 반환하고, 다른 hash는 `IDEMPOTENCY_CONFLICT`다.

## RPC 후보

| 업무 | RPC | 역할 | 핵심 검증/잠금 |
|---|---|---|---|
| 입고 | `inventory_confirm_receipt` | teacher | purchase link, 실제수량, lot 정보; request→purchase row→item 순 |
| 사용 | `inventory_consume_item` | teacher/instructor | 기본단위 양수, 가용량; request→item→FEFO lots 순 |
| 폐기 | `inventory_discard_stock` | teacher | lot 상태·잔량; request→item→lot UUID 순 |
| 정정 | `inventory_adjust_stock` | teacher | 사유 필수, 목표/증감 명시; 동일 순서 |
| 취소 | `inventory_reverse_movement` | teacher | 원 movement, 미취소, 역변경 가능성; 원본 삭제 금지 |
| 초기재고 | `inventory_set_initial_balance` | migration role/승인 teacher | source와 기준일, 중복 key, migration batch |

## 원자성·FEFO

모든 검증, lot balance 갱신, movement, audit, idempotency 결과는 하나의 DB 트랜잭션이다. 외부 호출은 트랜잭션 안에서 하지 않는다. item을 먼저 잠그고 대상 lot을 `expiration_date nulls last, received_at, id` 순으로 `FOR UPDATE`한다. 정상·미격리·사용가능·당일 미만료 lot만 차감한다. 복수 lot이면 lot별 movement를 생성한다.

유효기간 날짜 당일은 학교 현지일 종료까지 사용 가능하다는 잠정 계약이다. 서버에서 `Asia/Seoul` 업무일을 계산하되 DB 저장은 `date`/UTC timestamptz로 분리한다.

총재고는 잔량 전체, 가용재고는 미만료·미격리·사용가능 잔량이다. lot 잔량을 동시성 권위로 저장하고 movement를 불변 원장으로 유지한다. 양자는 같은 트랜잭션에서 갱신하며 정기 대조 쿼리를 둔다.

## 오류 코드

`UNAUTHENTICATED`, `MEMBERSHIP_INACTIVE`, `ROLE_FORBIDDEN`, `TENANT_MISMATCH`, `ITEM_NOT_FOUND`, `LOT_NOT_USABLE`, `INSUFFICIENT_STOCK`, `INVALID_QUANTITY`, `UNIT_MISMATCH`, `IDEMPOTENCY_CONFLICT`, `ALREADY_REVERSED`, `PURCHASE_ALREADY_RECEIVED`, `CONCURRENT_RETRY`.

직렬화/데드락 오류는 동일 request UUID로 제한 재시도한다. 업무 오류는 재시도하지 않는다.

