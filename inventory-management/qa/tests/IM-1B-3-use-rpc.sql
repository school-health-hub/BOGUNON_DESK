\set ON_ERROR_STOP on

begin;

create temporary table qa_results (
  test_id text primary key,
  passed boolean not null,
  detail text not null
);

create temporary table rpc_responses (
  scenario text primary key,
  response jsonb not null
);

grant select, insert on table rpc_responses to authenticated;

create or replace function pg_temp.record_result(
  target_test_id text,
  result boolean,
  result_detail text
)
returns void
language plpgsql
security definer
set search_path = 'pg_temp'
as $function$
begin
  insert into qa_results (test_id, passed, detail)
  values (target_test_id, result, result_detail);
end;
$function$;

create or replace function pg_temp.statement_raises(
  statement_sql text,
  expected_sqlstate text,
  expected_message text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  caught_message text;
begin
  execute statement_sql;
  return false;
exception
  when others then
    get stacked diagnostics caught_message = message_text;
    return sqlstate = expected_sqlstate and caught_message = expected_message;
end;
$function$;

create or replace function pg_temp.idempotency_count(target_request_uuid uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $function$
  select count(*)
  from public.inventory_idempotency_requests
  where request_uuid = target_request_uuid;
$function$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'use-teacher-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'use-instructor-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'use-inactive-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'use-unassigned@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'use-teacher-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.inventory_schools (school_id, display_name)
values
  ('50000000-0000-4000-8000-00000000000a', 'Synthetic Use School A'),
  ('60000000-0000-4000-8000-00000000000b', 'Synthetic Use School B');

insert into public.inventory_members (school_id, user_id, role, is_active)
values
  ('50000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'teacher_admin', true),
  ('50000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000002', 'instructor', true),
  ('50000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000003', 'instructor', false),
  ('60000000-0000-4000-8000-00000000000b', 'e2000000-0000-4000-8000-000000000001', 'teacher_admin', true);

insert into public.inventory_items (
  item_id, school_id, item_name, base_unit, purchase_unit,
  base_units_per_purchase_unit, recommended_stock, minimum_stock, is_active
)
values
  ('e1100000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-00000000000a', 'Synthetic Single Lot Item', 'unit', 'box', 10, 5, 1, true),
  ('e1100000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-00000000000a', 'Synthetic FEFO Item', 'unit', 'box', 10, 5, 1, true),
  ('e1100000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-00000000000a', 'Synthetic Insufficient Item', 'unit', 'box', 10, 5, 1, true),
  ('e1100000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-00000000000a', 'Synthetic Inactive Item', 'unit', 'box', 10, 5, 1, false),
  ('e1100000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-00000000000a', 'Synthetic Rollback Item', 'unit', 'box', 10, 5, 1, true),
  ('e2200000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-00000000000b', 'Synthetic School B Item', 'unit', 'box', 10, 5, 1, true);

insert into public.inventory_stock_lots (
  lot_id, school_id, item_id, received_at, expires_on,
  initial_quantity, remaining_quantity, status
)
values
  ('e1110000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000001', '2099-01-01T00:00:00Z', '2099-12-31', 10, 10, 'available'),
  ('e1120000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2020-01-01T00:00:00Z', '2020-01-02', 5, 5, 'available'),
  ('e1120000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2021-01-01T00:00:00Z', '2099-01-01', 5, 5, 'quarantined'),
  ('e1120000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2022-01-01T00:00:00Z', '2099-01-01', 5, 5, 'unavailable'),
  ('e1120000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2023-01-01T00:00:00Z', '2099-01-01', 5, 0, 'depleted'),
  ('e1120000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2024-01-01T00:00:00Z', (clock_timestamp() at time zone 'Asia/Seoul')::date, 3, 3, 'available'),
  ('e1120000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2025-01-01T00:00:00Z', '2099-01-01', 8, 8, 'available'),
  ('e1120000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000002', '2026-01-01T00:00:00Z', null, 4, 4, 'available'),
  ('e1130000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000003', '2025-01-01T00:00:00Z', '2099-01-01', 2, 2, 'available'),
  ('e1130000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000003', '2025-01-01T00:00:00Z', '2099-01-01', 5, 5, 'quarantined'),
  ('e1150000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-00000000000a', 'e1100000-0000-4000-8000-000000000005', '2025-01-01T00:00:00Z', '2099-01-01', 4, 4, 'available'),
  ('e2220000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-00000000000b', 'e2200000-0000-4000-8000-000000000001', '2025-01-01T00:00:00Z', '2099-01-01', 5, 5, 'available');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

insert into rpc_responses (scenario, response)
select 'single', public.inventory_use_stock(
  '50000000-0000-4000-8000-00000000000a',
  'e1100000-0000-4000-8000-000000000001',
  3,
  'e1900000-0000-4000-8000-000000000001',
  '  Synthetic single-lot use  '
);

select pg_temp.record_result(
  'IM1B3-01',
  (select remaining_quantity = 7 from public.inventory_stock_lots where lot_id = 'e1110000-0000-4000-8000-000000000001')
    and (select response ->> 'deducted_quantity' = '3' and response ->> 'replayed' = 'false' from rpc_responses where scenario = 'single'),
  'single-lot use deducts the requested base-unit quantity'
);

select pg_temp.record_result(
  'IM1B3-02',
  (select count(*) = 1 from public.inventory_stock_movements where request_id = 'e1900000-0000-4000-8000-000000000001' and quantity_delta = -3 and quantity_before = 10 and quantity_after = 7)
    and (select count(*) = 1 from public.inventory_audit where request_id = 'e1900000-0000-4000-8000-000000000001' and action_type = 'STOCK_USED')
    and pg_temp.idempotency_count('e1900000-0000-4000-8000-000000000001') = 1,
  'successful use atomically records movement, audit, and completed idempotency state'
);

insert into rpc_responses (scenario, response)
select 'replay', public.inventory_use_stock(
  '50000000-0000-4000-8000-00000000000a',
  'e1100000-0000-4000-8000-000000000001',
  3,
  'e1900000-0000-4000-8000-000000000001',
  'Synthetic single-lot use'
);

select pg_temp.record_result(
  'IM1B3-03',
  (select response ->> 'replayed' = 'true' from rpc_responses where scenario = 'replay')
    and (select count(*) = 1 from public.inventory_stock_movements where request_id = 'e1900000-0000-4000-8000-000000000001')
    and (select remaining_quantity = 7 from public.inventory_stock_lots where lot_id = 'e1110000-0000-4000-8000-000000000001'),
  'same UUID and canonical payload replays the stored result without a second deduction'
);

select pg_temp.record_result(
  'IM1B3-04',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',4,'e1900000-0000-4000-8000-000000000001','Synthetic single-lot use')$sql$,
    'PT409',
    'IDEMPOTENCY_CONFLICT'
  )
    and (select count(*) = 1 from public.inventory_stock_movements where request_id = 'e1900000-0000-4000-8000-000000000001'),
  'same UUID with changed payload returns IDEMPOTENCY_CONFLICT without mutation'
);

insert into rpc_responses (scenario, response)
select 'fefo', public.inventory_use_stock(
  '50000000-0000-4000-8000-00000000000a',
  'e1100000-0000-4000-8000-000000000002',
  5,
  'e1900000-0000-4000-8000-000000000002',
  'Synthetic FEFO use'
);

select pg_temp.record_result(
  'IM1B3-05',
  (select remaining_quantity = 0 and status = 'depleted' from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000005')
    and (select remaining_quantity = 6 from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000006')
    and (select count(*) = 2 from public.inventory_stock_movements where request_id = 'e1900000-0000-4000-8000-000000000002')
    and (select jsonb_array_length(response -> 'lot_deductions') = 2 from rpc_responses where scenario = 'fefo'),
  'FEFO consumes expiry-today lot first and splits movements by lot'
);

select pg_temp.record_result(
  'IM1B3-06',
  (select remaining_quantity = 5 from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000001')
    and (select remaining_quantity = 5 from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000002')
    and (select remaining_quantity = 5 from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000003')
    and (select remaining_quantity = 0 from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000004')
    and (select remaining_quantity = 4 from public.inventory_stock_lots where lot_id = 'e1120000-0000-4000-8000-000000000007'),
  'expired, quarantined, unavailable, depleted, and later no-expiry lots are not selected ahead of valid FEFO lots'
);

select pg_temp.record_result(
  'IM1B3-07',
  (select response ->> 'available_stock_after' = '10' from rpc_responses where scenario = 'fefo'),
  'available stock after excludes unusable lots and includes valid future and no-expiry balances'
);

select pg_temp.record_result(
  'IM1B3-08',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000003',3,'e1900000-0000-4000-8000-000000000003','Synthetic insufficient use')$sql$,
    'PT409',
    'INSUFFICIENT_STOCK'
  )
    and (select remaining_quantity = 2 from public.inventory_stock_lots where lot_id = 'e1130000-0000-4000-8000-000000000001')
    and pg_temp.idempotency_count('e1900000-0000-4000-8000-000000000003') = 0,
  'insufficient usable stock rejects the request and rolls back idempotency state'
);

select pg_temp.record_result(
  'IM1B3-09',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',0,'e1900000-0000-4000-8000-000000000004','Synthetic zero use')$sql$,
    'PT422',
    'INVALID_QUANTITY'
  )
  and pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',-1,'e1900000-0000-4000-8000-000000000005','Synthetic negative use')$sql$,
    'PT422',
    'INVALID_QUANTITY'
  ),
  'zero and negative quantities are rejected'
);

select pg_temp.record_result(
  'IM1B3-10',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000099',1,'e1900000-0000-4000-8000-000000000006','Synthetic missing item')$sql$,
    'PT404',
    'ITEM_NOT_FOUND'
  )
  and pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000004',1,'e1900000-0000-4000-8000-000000000007','Synthetic inactive item')$sql$,
    'PT422',
    'ITEM_INACTIVE'
  ),
  'missing and inactive items return structured errors'
);

select pg_temp.record_result(
  'IM1B3-11',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('60000000-0000-4000-8000-00000000000b','e2200000-0000-4000-8000-000000000001',1,'e1900000-0000-4000-8000-000000000008','Synthetic cross-school use')$sql$,
    'PT403',
    'PERMISSION_DENIED'
  ),
  'cross-school request is denied before disclosing item existence'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B3-12',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',1,'e1900000-0000-4000-8000-000000000009','Synthetic inactive member use')$sql$,
    'PT403',
    'PERMISSION_DENIED'
  ),
  'inactive membership cannot invoke stock use'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"teacher_admin"}}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B3-13',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',1,'e1900000-0000-4000-8000-000000000010','Synthetic forged metadata use')$sql$,
    'PT403',
    'PERMISSION_DENIED'
  ),
  'forged user metadata does not create membership or role authority'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B3-14',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',1,'e1900000-0000-4000-8000-000000000011','Synthetic unauthenticated use')$sql$,
    'PT401',
    'UNAUTHENTICATED'
  ),
  'authenticated database role without auth.uid is rejected'
);

reset role;
set local role anon;
select pg_temp.record_result(
  'IM1B3-15',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',1,'e1900000-0000-4000-8000-000000000012','Synthetic anonymous use')$sql$,
    '42501',
    'permission denied for function inventory_use_stock'
  ),
  'anon has no EXECUTE privilege on the use RPC'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.record_result(
  'IM1B3-16',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000001',1,'e1900000-0000-4000-8000-000000000013',E'bad\nreason')$sql$,
    'PT422',
    'INVALID_REASON'
  ),
  'control characters in the reason are rejected'
);

reset role;

create or replace function pg_temp.reject_stock_used_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.action_type = 'STOCK_USED' and new.request_id = 'e1900000-0000-4000-8000-000000000014' then
    raise exception using errcode = 'P0001', message = 'SYNTHETIC_AUDIT_FAILURE';
  end if;
  return new;
end;
$function$;

create trigger qa_reject_stock_used_audit
before insert on public.inventory_audit
for each row execute function pg_temp.reject_stock_used_audit();

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B3-17',
  pg_temp.statement_raises(
    $sql$select public.inventory_use_stock('50000000-0000-4000-8000-00000000000a','e1100000-0000-4000-8000-000000000005',2,'e1900000-0000-4000-8000-000000000014','Synthetic rollback injection')$sql$,
    'P0001',
    'SYNTHETIC_AUDIT_FAILURE'
  ),
  'injected audit failure aborts the RPC'
);
reset role;

select pg_temp.record_result(
  'IM1B3-18',
  (select remaining_quantity = 4 from public.inventory_stock_lots where lot_id = 'e1150000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.inventory_stock_movements where request_id = 'e1900000-0000-4000-8000-000000000014')
    and not exists (select 1 from public.inventory_audit where request_id = 'e1900000-0000-4000-8000-000000000014')
    and not exists (select 1 from public.inventory_idempotency_requests where request_uuid = 'e1900000-0000-4000-8000-000000000014'),
  'audit failure rolls back lot, movement, audit, and idempotency changes'
);

drop trigger qa_reject_stock_used_audit on public.inventory_audit;

select pg_temp.record_result(
  'IM1B3-A01',
  has_function_privilege('authenticated', 'public.inventory_use_stock(uuid,uuid,bigint,uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.inventory_use_stock(uuid,uuid,bigint,uuid,text)', 'execute')
    and not has_function_privilege('public', 'public.inventory_use_stock(uuid,uuid,bigint,uuid,text)', 'execute'),
  'RPC EXECUTE is restricted to authenticated callers'
);

select pg_temp.record_result(
  'IM1B3-A02',
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc
   where oid = 'public.inventory_use_stock(uuid,uuid,bigint,uuid,text)'::regprocedure),
  'SECURITY DEFINER RPC pins an empty search_path'
);

select 'TEST|' || test_id || '|' || case when passed then 'PASS' else 'FAIL' end || '|' || detail
from qa_results
order by test_id;

select
  'SUMMARY|'
  || count(*)::text
  || '|'
  || count(*) filter (where passed)::text
  || '|'
  || count(*) filter (where not passed)::text
from qa_results;

rollback;
