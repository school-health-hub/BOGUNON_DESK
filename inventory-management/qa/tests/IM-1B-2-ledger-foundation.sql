\set ON_ERROR_STOP on

begin;

create temporary table qa_results (
  test_id text primary key,
  passed boolean not null,
  detail text not null
);

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
  expected_sqlstate text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  execute statement_sql;
  return false;
exception
  when others then
    return sqlstate = expected_sqlstate;
end;
$function$;

create or replace function pg_temp.statement_row_count(statement_sql text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  affected_rows bigint;
begin
  execute statement_sql;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$function$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ledger-teacher-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ledger-instructor-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'ledger-inactive-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('d2000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'ledger-teacher-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.inventory_schools (school_id, display_name)
values
  ('30000000-0000-4000-8000-00000000000a', 'Synthetic Ledger School A'),
  ('40000000-0000-4000-8000-00000000000b', 'Synthetic Ledger School B');

insert into public.inventory_members (school_id, user_id, role, is_active)
values
  ('30000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'teacher_admin', true),
  ('30000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000002', 'instructor', true),
  ('30000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000003', 'instructor', false),
  ('40000000-0000-4000-8000-00000000000b', 'd2000000-0000-4000-8000-000000000001', 'teacher_admin', true);

insert into public.inventory_items (
  item_id, school_id, item_name, base_unit, purchase_unit,
  base_units_per_purchase_unit, recommended_stock, minimum_stock
)
values
  ('d1100000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-00000000000a', 'Synthetic Ledger Item A', 'unit', 'box', 10, 5, 1),
  ('d2200000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-00000000000b', 'Synthetic Ledger Item B', 'unit', 'box', 10, 5, 1);

insert into public.inventory_stock_lots (
  lot_id, school_id, item_id, received_at, expires_on,
  initial_quantity, remaining_quantity, status
)
values
  ('d1110000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-00000000000a', 'd1100000-0000-4000-8000-000000000001', '2099-01-01T00:00:00Z', '2099-12-31', 10, 10, 'available'),
  ('d2220000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-00000000000b', 'd2200000-0000-4000-8000-000000000001', '2099-01-01T00:00:00Z', '2099-12-31', 10, 10, 'available');

insert into public.inventory_stock_movements (
  movement_id, school_id, item_id, lot_id, request_id, movement_type,
  quantity_delta, quantity_before, quantity_after, actor_user_id, reason
)
values
  ('d1111000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-00000000000a', 'd1100000-0000-4000-8000-000000000001', 'd1110000-0000-4000-8000-000000000001', 'd1112000-0000-4000-8000-000000000001', 'INITIAL_BALANCE', 10, 0, 10, 'd1000000-0000-4000-8000-000000000001', 'Synthetic initial balance'),
  ('d2221000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-00000000000b', 'd2200000-0000-4000-8000-000000000001', 'd2220000-0000-4000-8000-000000000001', 'd2222000-0000-4000-8000-000000000001', 'INITIAL_BALANCE', 10, 0, 10, 'd2000000-0000-4000-8000-000000000001', 'Synthetic initial balance');

insert into public.inventory_audit (
  audit_id, school_id, actor_user_id, action_type, target_type,
  target_id, request_id, reason, details
)
values
  ('d1113000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'INITIAL_BALANCE_RECORDED', 'stock_lot', 'd1110000-0000-4000-8000-000000000001', 'd1112000-0000-4000-8000-000000000001', 'Synthetic audit event', '{"source":"synthetic"}'),
  ('d2223000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-00000000000b', 'd2000000-0000-4000-8000-000000000001', 'INITIAL_BALANCE_RECORDED', 'stock_lot', 'd2220000-0000-4000-8000-000000000001', 'd2222000-0000-4000-8000-000000000001', 'Synthetic audit event', '{"source":"synthetic"}');

select pg_temp.record_result(
  'IM1B2-01',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_stock_movements (school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason) values ('30000000-0000-4000-8000-00000000000a','d1100000-0000-4000-8000-000000000001','d1110000-0000-4000-8000-000000000001','d1112000-0000-4000-8000-000000000002','ADJUST',2,10,11,'d1000000-0000-4000-8000-000000000001','Invalid equation')$sql$,
    '23514'
  ),
  'movement balance equation rejects inconsistent before, delta, and after values'
);

select pg_temp.record_result(
  'IM1B2-02',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_stock_movements (school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason) values ('30000000-0000-4000-8000-00000000000a','d1100000-0000-4000-8000-000000000001','d1110000-0000-4000-8000-000000000001','d1112000-0000-4000-8000-000000000003','USE',-11,10,-1,'d1000000-0000-4000-8000-000000000001','Negative result')$sql$,
    '23514'
  ),
  'movement rejects a negative quantity_after'
);

select pg_temp.record_result(
  'IM1B2-03',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_stock_movements (school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason) values ('30000000-0000-4000-8000-00000000000a','d1100000-0000-4000-8000-000000000001','d2220000-0000-4000-8000-000000000001','d1112000-0000-4000-8000-000000000004','USE',-1,10,9,'d1000000-0000-4000-8000-000000000001','Cross tenant lot')$sql$,
    '23503'
  ),
  'composite FK rejects a movement linked to another school lot'
);

select pg_temp.record_result(
  'IM1B2-04',
  pg_temp.statement_raises(
    $sql$update public.inventory_stock_movements set reason = 'Changed' where movement_id = 'd1111000-0000-4000-8000-000000000001'$sql$,
    '55000'
  ),
  'append-only trigger rejects movement update even through privileged fixture connection'
);

select pg_temp.record_result(
  'IM1B2-05',
  pg_temp.statement_raises(
    $sql$delete from public.inventory_stock_movements where movement_id = 'd1111000-0000-4000-8000-000000000001'$sql$,
    '55000'
  ),
  'append-only trigger rejects movement delete even through privileged fixture connection'
);

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B2-06',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_audit (school_id,actor_user_id,action_type,target_type,target_id,request_id,reason) values ('30000000-0000-4000-8000-00000000000a','d1000000-0000-4000-8000-000000000001','FORGED','item','d1100000-0000-4000-8000-000000000001','d1112000-0000-4000-8000-000000000005','Direct insert')$sql$,
    '42501'
  ),
  'teacher_admin cannot insert audit rows directly'
);
reset role;

select pg_temp.record_result(
  'IM1B2-07',
  pg_temp.statement_raises(
    $sql$update public.inventory_audit set reason = 'Changed' where audit_id = 'd1113000-0000-4000-8000-000000000001'$sql$,
    '55000'
  )
  and pg_temp.statement_raises(
    $sql$delete from public.inventory_audit where audit_id = 'd1113000-0000-4000-8000-000000000001'$sql$,
    '55000'
  ),
  'append-only trigger rejects audit update and delete'
);

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B2-08',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_idempotency_requests (school_id,actor_user_id,operation,request_uuid,payload_hash) values ('30000000-0000-4000-8000-00000000000a','d1000000-0000-4000-8000-000000000001','USE','d1112000-0000-4000-8000-000000000006',repeat('a',64))$sql$,
    '42501'
  )
  and pg_temp.statement_raises(
    $sql$select * from public.inventory_idempotency_requests$sql$,
    '42501'
  ),
  'client role has no direct idempotency table DML or read privilege'
);
reset role;

insert into public.inventory_idempotency_requests (
  school_id, actor_user_id, operation, request_uuid, payload_hash
)
values (
  '30000000-0000-4000-8000-00000000000a',
  'd1000000-0000-4000-8000-000000000001',
  'USE',
  'd1112000-0000-4000-8000-000000000007',
  repeat('b', 64)
);

select pg_temp.record_result(
  'IM1B2-09',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_idempotency_requests (school_id,actor_user_id,operation,request_uuid,payload_hash) values ('30000000-0000-4000-8000-00000000000a','d1000000-0000-4000-8000-000000000001','USE','d1112000-0000-4000-8000-000000000007',repeat('b',64))$sql$,
    '23505'
  ),
  'unique scope rejects a duplicate request UUID for the same actor and operation'
);

select pg_temp.record_result(
  'IM1B2-10',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_idempotency_requests (school_id,actor_user_id,operation,request_uuid,payload_hash) values ('30000000-0000-4000-8000-00000000000a','d1000000-0000-4000-8000-000000000001','USE','d1112000-0000-4000-8000-000000000007',repeat('c',64))$sql$,
    '23505'
  ),
  'unique scope exposes changed-payload reuse for the later RPC to map to IDEMPOTENCY_CONFLICT'
);

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B2-11',
  (select count(*) = 1 from public.inventory_stock_movements)
    and not exists (select 1 from public.inventory_stock_movements where school_id = '40000000-0000-4000-8000-00000000000b'),
  'School A teacher cannot read School B movements'
);
select pg_temp.record_result(
  'IM1B2-12',
  (select count(*) = 1 from public.inventory_audit)
    and not exists (select 1 from public.inventory_audit where school_id = '40000000-0000-4000-8000-00000000000b'),
  'School A teacher cannot read School B audit rows'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B2-13',
  (select count(*) = 0 from public.inventory_audit),
  'instructor cannot read the audit ledger'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B2-14',
  (select count(*) = 0 from public.inventory_stock_movements)
    and (select count(*) = 0 from public.inventory_audit),
  'inactive membership grants no movement or audit visibility'
);
reset role;

create or replace function pg_temp.attempt_partial_ledger_write()
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  begin
    update public.inventory_stock_lots
    set remaining_quantity = remaining_quantity - 1
    where lot_id = 'd1110000-0000-4000-8000-000000000001';

    insert into public.inventory_stock_movements (
      school_id, item_id, lot_id, request_id, movement_type,
      quantity_delta, quantity_before, quantity_after, actor_user_id, reason
    ) values (
      '30000000-0000-4000-8000-00000000000a',
      'd1100000-0000-4000-8000-000000000001',
      'd1110000-0000-4000-8000-000000000001',
      'd1112000-0000-4000-8000-000000000008',
      'USE', -1, 10, 9,
      'd1000000-0000-4000-8000-000000000001',
      'Synthetic rollback test'
    );

    insert into public.inventory_audit (
      school_id, actor_user_id, action_type, target_type,
      target_id, request_id, reason
    ) values (
      '30000000-0000-4000-8000-00000000000a',
      'd1000000-0000-4000-8000-000000000001',
      'USE_RECORDED', 'stock_lot',
      'd1110000-0000-4000-8000-000000000001',
      'd1112000-0000-4000-8000-000000000008',
      'Synthetic rollback test'
    );

    raise exception using errcode = 'P0001', message = 'synthetic transaction failure';
  exception
    when sqlstate 'P0001' then
      null;
  end;
end;
$function$;

select pg_temp.attempt_partial_ledger_write();
select pg_temp.record_result(
  'IM1B2-15',
  (select remaining_quantity = 10 from public.inventory_stock_lots where lot_id = 'd1110000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.inventory_stock_movements where request_id = 'd1112000-0000-4000-8000-000000000008')
    and not exists (select 1 from public.inventory_audit where request_id = 'd1112000-0000-4000-8000-000000000008'),
  'a failed subtransaction leaves no lot, movement, or audit partial state'
);

select pg_temp.record_result(
  'IM1B2-A01',
  not has_table_privilege('anon', 'public.inventory_stock_movements', 'select')
    and not has_table_privilege('anon', 'public.inventory_audit', 'select')
    and not has_table_privilege('anon', 'public.inventory_idempotency_requests', 'select')
    and not has_table_privilege('authenticated', 'public.inventory_stock_movements', 'insert,update,delete')
    and not has_table_privilege('authenticated', 'public.inventory_audit', 'insert,update,delete')
    and not has_table_privilege('authenticated', 'public.inventory_idempotency_requests', 'select,insert,update,delete'),
  'table grants deny anonymous access and all client ledger writes'
);

select pg_temp.record_result(
  'IM1B2-A02',
  not has_function_privilege('public', 'inventory_private.inventory_reject_immutable_change()', 'execute')
    and not has_function_privilege('anon', 'inventory_private.inventory_reject_immutable_change()', 'execute')
    and not has_function_privilege('authenticated', 'inventory_private.inventory_reject_immutable_change()', 'execute'),
  'immutable trigger helper is not directly executable by client roles'
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
