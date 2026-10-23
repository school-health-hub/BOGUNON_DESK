# IM-1B-4A 공통 응답 계약

기존 필드는 유지하고 wrapper가 `request_uuid`, `operation`, `school_id`, `item_id`, `quantity_delta`, `item_total_quantity`, `item_available_quantity`, `movements`, `processed_at`, `replayed`, `status`, `reactivation_required`를 추가한다. `status`는 `applied|replayed`다. 총재고는 모든 lot 잔량, 가용재고는 Asia/Seoul 업무일 기준 미만료 `available` lot 잔량이다. 멱등 replay에도 같은 authoritative 집계를 반환한다.

`inventory_receive_stock`은 일반 독립 입고다. `inventory_confirm_receipt`는 향후 구매건 검증과 부분입고 누적을 포함할 상위 계약이며 이번 단계에서 alias를 만들지 않았다.

