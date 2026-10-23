\set ON_ERROR_STOP on

with checks(test_id, passed, detail) as (
  values
    (
      'IM1B3-C01',
      (select remaining_quantity = 4 from public.inventory_stock_lots where lot_id = 'f1110000-0000-4000-8000-000000000001')
        and (select count(*) filter (where outcome = 'SUCCESS') = 1 and count(*) filter (where error_message = 'INSUFFICIENT_STOCK') = 1 from public.qa_im1b3_concurrency_results where scenario = 'teacher-instructor')
        and (select count(*) = 1 from public.inventory_stock_movements where item_id = 'f1100000-0000-4000-8000-000000000001'),
      'teacher and instructor race applies only one quantity-six request against stock ten'
    ),
    (
      'IM1B3-C02',
      (select remaining_quantity = 4 from public.inventory_stock_lots where lot_id = 'f1120000-0000-4000-8000-000000000001')
        and (select count(*) filter (where outcome = 'SUCCESS') = 1 and count(*) filter (where error_message = 'INSUFFICIENT_STOCK') = 1 from public.qa_im1b3_concurrency_results where scenario = 'two-instructors')
        and (select count(*) = 1 from public.inventory_stock_movements where item_id = 'f1100000-0000-4000-8000-000000000002'),
      'two instructors cannot over-consume the same item'
    ),
    (
      'IM1B3-C03',
      (select remaining_quantity = 0 and status = 'depleted' from public.inventory_stock_lots where lot_id = 'f1130000-0000-4000-8000-000000000001')
        and (select count(*) filter (where outcome = 'SUCCESS') = 1 and count(*) filter (where error_message = 'INSUFFICIENT_STOCK') = 1 from public.qa_im1b3_concurrency_results where scenario = 'last-unit')
        and (select count(*) = 1 from public.inventory_stock_movements where item_id = 'f1100000-0000-4000-8000-000000000003'),
      'exactly one request consumes the final unit'
    ),
    (
      'IM1B3-C04',
      (select remaining_quantity = 7 from public.inventory_stock_lots where lot_id = 'f1140000-0000-4000-8000-000000000001')
        and (select count(*) filter (where outcome = 'SUCCESS') = 2 and count(*) filter (where response ->> 'replayed' = 'true') = 1 from public.qa_im1b3_concurrency_results where scenario = 'same-uuid')
        and (select count(*) = 1 from public.inventory_stock_movements where item_id = 'f1100000-0000-4000-8000-000000000004')
        and (select count(*) = 1 from public.inventory_idempotency_requests where request_uuid = 'f1900000-0000-4000-8000-000000000007'),
      'simultaneous identical UUID requests produce one deduction and one replay'
    )
)
select 'TEST|' || test_id || '|' || case when passed then 'PASS' else 'FAIL' end || '|' || detail
from checks
order by test_id;

with checks(passed) as (
  values
    ((select remaining_quantity = 4 from public.inventory_stock_lots where lot_id = 'f1110000-0000-4000-8000-000000000001') and (select count(*) filter (where outcome = 'SUCCESS') = 1 and count(*) filter (where error_message = 'INSUFFICIENT_STOCK') = 1 from public.qa_im1b3_concurrency_results where scenario = 'teacher-instructor')),
    ((select remaining_quantity = 4 from public.inventory_stock_lots where lot_id = 'f1120000-0000-4000-8000-000000000001') and (select count(*) filter (where outcome = 'SUCCESS') = 1 and count(*) filter (where error_message = 'INSUFFICIENT_STOCK') = 1 from public.qa_im1b3_concurrency_results where scenario = 'two-instructors')),
    ((select remaining_quantity = 0 from public.inventory_stock_lots where lot_id = 'f1130000-0000-4000-8000-000000000001') and (select count(*) filter (where outcome = 'SUCCESS') = 1 and count(*) filter (where error_message = 'INSUFFICIENT_STOCK') = 1 from public.qa_im1b3_concurrency_results where scenario = 'last-unit')),
    ((select remaining_quantity = 7 from public.inventory_stock_lots where lot_id = 'f1140000-0000-4000-8000-000000000001') and (select count(*) filter (where outcome = 'SUCCESS') = 2 and count(*) filter (where response ->> 'replayed' = 'true') = 1 from public.qa_im1b3_concurrency_results where scenario = 'same-uuid'))
)
select 'SUMMARY|' || count(*) || '|' || count(*) filter (where passed) || '|' || count(*) filter (where not passed)
from checks;
