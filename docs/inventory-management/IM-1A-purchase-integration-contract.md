# IM-1A Purchase Helper 연동 계약

## 확인된 구현

`PurchaseItem`은 품명, 규격, 수량, 단가, imported amount, 업체, 비고, 예산항목, source를 가진다. 독립 `unit`과 Inventory item ID는 없다. 품목 편집·수량/단가 변경·금액 검산·XLSX/CSV 및 K-에듀파인 출력·클립보드가 구현됐다. XLS/XLSX/CSV와 text PDF는 분석 대상이며 이미지/스캔 PDF OCR은 지원하지 않는다. 템플릿/열 설정만 localStorage에 있고 구매 작업 세션 저장·복원은 없다.

## 경계 DTO

Inventory가 먼저 `purchase_batch`와 후보 라인을 영속화한다: `batch_id`, `candidate_id`, `inventory_item_id`, requested base quantity, purchase unit/conversion, specification snapshot. Purchase Helper에는 기존 `PurchaseItem` 모양으로 변환해 전달하고, 반환 시 `candidate_id` 매핑을 별도 adapter/session map으로 유지한다. 파서와 금액 계산은 재사용한다.

현재 UI/DTO가 opaque metadata를 보존하지 않으므로 완전한 무수정 왕복은 보장되지 않는다. IM-1B/IM-5에서는 패널 UI를 바꾸기 전에 상위 orchestration adapter와 최소 입출력 prop 경계를 검토한다.

## 상태 계약

`CANDIDATE → DRAFTED → APPROVED/ORDERED → AWAITING_RECEIPT → PARTIALLY_RECEIVED → RECEIVED|CANCELLED`.

- 품의/주문 상태 변경은 재고를 바꾸지 않는다.
- 실제 도착 후 teacher가 lot·실제 기본수량을 확인해야 `inventory_confirm_receipt`를 호출한다.
- purchase line별 누적 실제 입고량을 저장하고 receipt request UUID로 중복을 막는다.
- 주문수량과 실제입고수량은 분리한다. 초과입고는 명시 확인 정책이 필요하다.
- 품의 취소는 미입고 주문 상태만 변경한다. 이미 생성된 재고는 별도의 movement 취소 계약을 따른다.
- 세션 복원이 없으므로 Inventory 쪽 batch가 연동의 권위 원본이어야 한다.

