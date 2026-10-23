# IM-1B-4 입고 RPC

`inventory_receive_stock`은 `teacher_admin`만 호출한다. 구매수량과 품목의 정확한 포장 변환비로 정수 기본수량을 계산하고 신규 lot, `RECEIVE` movement, audit, 멱등 결과를 한 트랜잭션에 기록한다. 기존 lot 추가는 지원하지 않는다. 구매연결 무결성이 아직 없으므로 `purchase_link_id`는 NULL만 허용한다.

구현: `inventory-management/qa/supabase/migrations/20261023045956_inventory_stock_admin_rpcs.sql`

