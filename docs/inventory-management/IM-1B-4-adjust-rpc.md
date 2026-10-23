# IM-1B-4 재고 정정 RPC

`inventory_adjust_stock`은 `expected_quantity`와 실사 `counted_quantity`를 입력받는다. 잠금 후 현재 잔량이 예상값과 다르면 `STALE_STOCK_STATE`를 반환한다. 서버가 delta를 계산하며 0 변화는 `NO_STOCK_CHANGE`, 음수 목표는 `INVALID_QUANTITY`로 거부한다.

