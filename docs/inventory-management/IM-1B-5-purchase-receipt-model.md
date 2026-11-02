# IM-1B-5 구매 연결·부분입고 모델

## 구현 범위

- migration: `inventory-management/qa/supabase/migrations/20261102005531_inventory_purchase_receipts.sql`
- 테이블: `inventory_purchase_batches`, `inventory_purchase_lines`, `inventory_purchase_receipts`, `inventory_purchase_receipt_lines`
- 공개 RPC: `inventory_create_purchase_batch`, `inventory_set_purchase_batch_status`, `inventory_confirm_receipt`
- 기존 일반 입고 `inventory_receive_stock`은 변경하지 않았고, 구매 연결 ID를 거부하는 기존 계약도 유지한다.

## 수량 계약

구매 line은 구매수량·구매단위·기본단위·정확한 변환비 snapshot과 요청 기본단위 수량을 저장한다. 누적 실제 입고량은 기본단위 정수로 저장하며 `0 <= received <= requested` CHECK와 행 잠금 후 검증을 함께 적용한다. 가격은 선택 메타데이터이고 재고 수량의 권위 근거가 아니다.

## 상태 계약

생성 시 `DRAFT`이며 `APPROVED → ORDERED → AWAITING_RECEIPT`만 허용한다. 실제 입고 뒤에는 line 누적량에 따라 `PARTIALLY_RECEIVED` 또는 `RECEIVED`가 된다. 계획·승인·주문 상태 변경은 lot와 movement를 만들지 않는다.

## 실제 입고

`inventory_confirm_receipt`는 teacher_admin membership을 서버에서 확인하고 batch, line, item을 고정 순서로 잠근다. receipt identity를 먼저 예약한 뒤 lot, RECEIVE movement, receipt line, audit, 누적 입고량, batch 상태와 멱등 응답을 한 트랜잭션에서 확정한다. 동일 request UUID는 저장된 응답을 재사용하고, 다른 payload는 `IDEMPOTENCY_CONFLICT`, 다른 UUID로 같은 receipt ID를 제출하면 `DUPLICATE_RECEIPT`이다.

receipt line은 `(school_id, batch_id, line_id, item_id)` 복합 FK로 원 구매 line에 결합되고 lot·movement도 학교 복합 FK로 결합된다. 구매 연계 RECEIVE movement의 reversal은 누적 구매 회계 정책이 승인되지 않았으므로 `PURCHASE_RECEIPT_REVERSAL_REQUIRES_POLICY`로 차단한다.

## 미확정 정책

- 승인 뒤 구매수량 변경
- 입고 뒤 구매 취소와 재고 취소의 관계
- 초과입고 예외 승인
- 공급처·회계 증빙 및 Purchase Helper session 저장
- 운영 데이터 이전 및 초기 재고 권위 원본
