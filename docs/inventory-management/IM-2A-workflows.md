# IM-2A 업무별 UI 흐름

## 공통 계약

모든 대화상자는 `InventoryWorkflowDialog`와 `createSyntheticInventoryAdapter()`를 사용한다. 제출 결과는 다음 둘뿐이다.

- `preview_only`, `persisted: false`
- `unavailable`, `persisted: false`

성공 메시지는 `합성 데이터 입력을 확인했습니다. 실제 재고에는 반영되지 않습니다.`이며 운영 저장 완료를 주장하지 않는다. 대화상자는 Escape 종료, Tab/Shift+Tab 포커스 순환, 호출 버튼으로의 포커스 복원을 지원한다.

## 물품 등록

입력: 물품명, 분류, 규격, 기본단위, 구매단위, 포장 변환비, 권장재고, 최소재고.

- 텍스트 필수값을 공백 제거 후 검증한다.
- 변환비는 양의 안전 정수다.
- 권장·최소재고는 0 이상의 안전 정수다.

## 입고 등록

입력: 선택 품목, 구매단위 수량, 포장 변환비, 입고일, 선택적 유효기간.

- 수량과 변환비는 양의 안전 정수다.
- 변환 결과가 JavaScript 안전 정수 범위를 넘으면 미리보기를 거부한다.
- 날짜 형식을 검증한다.
- 실제 lot 생성이나 재고 증가는 수행하지 않는다.

## 재고 사용 기록

입력: 선택 품목, 사용 수량, 사용 메모.

- 사용 수량은 양의 안전 정수다.
- 합성 fixture의 총 가용재고를 초과하면 거부한다.
- 실제 FEFO 차감, movement, audit, idempotency 호출은 수행하지 않는다.

## 폐기

입력: 선택 lot, 폐기 수량, 업무 사유.

- 다른 품목 lot 또는 존재하지 않는 lot를 거부한다.
- lot 잔량 초과 폐기를 UI와 adapter 양쪽에서 거부한다.
- 실제 잔량 변경은 수행하지 않는다.

## 재고 정정

입력: 선택 lot, 실사 확인 잔량, 업무 사유.

- 확인 잔량은 0 이상의 안전 정수다.
- 실제 optimistic concurrency/RPC는 후속 연결 단계에 남긴다.

## 구매 필요 품목 확인

입력: 구매 수량, 예상 단가.

- 구매 수량은 양의 안전 정수, 예상 단가는 0 이상의 안전 정수다.
- Purchase Helper를 열거나 변경하지 않는다.
- 구매 후보·품의·주문은 재고 증가로 표시하지 않는다.

## 미구현 연결

UI가 참고한 서버 계약은 `inventory_use_stock`, `inventory_receive_stock`, `inventory_dispose_stock`, `inventory_adjust_stock`, `inventory_reverse_movement`, 구매 batch/receipt RPC다. IM-2A에서는 어떤 RPC도 호출하지 않는다.
