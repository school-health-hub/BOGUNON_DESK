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
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'instructor-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('b2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('b2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'instructor-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('c3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unassigned@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.inventory_schools (school_id, display_name)
values
  ('10000000-0000-4000-8000-00000000000a', 'Synthetic School A'),
  ('20000000-0000-4000-8000-00000000000b', 'Synthetic School B');

insert into public.inventory_members (school_id, user_id, role, is_active)
values
  ('10000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000001', 'teacher_admin', true),
  ('10000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000002', 'instructor', true),
  ('20000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-000000000001', 'teacher_admin', true),
  ('20000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-000000000002', 'instructor', true),
  ('10000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000003', 'instructor', false),
  ('20000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000001', 'instructor', true);

insert into public.inventory_items (
  item_id,
  school_id,
  item_name,
  base_unit,
  purchase_unit,
  base_units_per_purchase_unit,
  recommended_stock,
  minimum_stock
)
values
  ('a1100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'Synthetic Item Alpha', 'unit', 'box', 100, 20, 5),
  ('b2200000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b', 'Synthetic Item Beta', 'unit', 'pack', 10, 30, 6);

insert into public.inventory_stock_lots (
  lot_id,
  school_id,
  item_id,
  received_at,
  expires_on,
  initial_quantity,
  remaining_quantity,
  status
)
values
  ('a1110000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'a1100000-0000-4000-8000-000000000001', '2099-01-01T00:00:00Z', '2099-02-01', 3, 3, 'available'),
  ('b2220000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b', 'b2200000-0000-4000-8000-000000000001', '2099-01-01T00:00:00Z', '2099-02-01', 4, 4, 'available');

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-01',
  (select count(*) = 1 from public.inventory_items where school_id = '10000000-0000-4000-8000-00000000000a'),
  'teacher reads own school item'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-02',
  (select count(*) = 1 from public.inventory_items where school_id = '10000000-0000-4000-8000-00000000000a'),
  'instructor reads own school item'
);
select pg_temp.record_result(
  'IM1B1-03',
  (select count(*) = 1 from public.inventory_items)
    and not exists (select 1 from public.inventory_items where item_id = 'b2200000-0000-4000-8000-000000000001'),
  'School A instructor cannot read School B item'
);
select pg_temp.record_result(
  'IM1B1-04',
  (select count(*) = 1 from public.inventory_stock_lots)
    and not exists (select 1 from public.inventory_stock_lots where lot_id = 'b2220000-0000-4000-8000-000000000001'),
  'School A instructor cannot read School B lot'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"c3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result('IM1B1-05', (select count(*) = 0 from public.inventory_items), 'unassigned user reads no items');
reset role;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-06',
  (select count(*) = 0 from public.inventory_items)
    and pg_temp.statement_raises(
      $sql$insert into public.inventory_items (school_id, item_name, base_unit, purchase_unit) values ('10000000-0000-4000-8000-00000000000a', 'Synthetic Inactive Insert', 'unit', 'unit')$sql$,
      '42501'
    ),
  'inactive membership cannot read or write items'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-07',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_items (school_id, item_name, base_unit, purchase_unit) values ('10000000-0000-4000-8000-00000000000a', 'Synthetic Forbidden Insert', 'unit', 'unit')$sql$,
    '42501'
  ),
  'instructor item insert is rejected by RLS'
);
select pg_temp.record_result(
  'IM1B1-08',
  pg_temp.statement_row_count(
    $sql$update public.inventory_items set item_name = 'Synthetic Forbidden Update' where item_id = 'a1100000-0000-4000-8000-000000000001'$sql$
  ) = 0,
  'instructor item update affects zero rows'
);
select pg_temp.record_result(
  'IM1B1-09',
  pg_temp.statement_raises(
    $sql$update public.inventory_stock_lots set remaining_quantity = 99 where lot_id = 'a1110000-0000-4000-8000-000000000001'$sql$,
    '42501'
  ),
  'instructor direct lot balance update is denied'
);
select pg_temp.record_result(
  'IM1B1-10',
  pg_temp.statement_raises(
    $sql$update public.inventory_members set role = 'teacher_admin' where school_id = '10000000-0000-4000-8000-00000000000a' and user_id = 'a1000000-0000-4000-8000-000000000002'$sql$,
    '42501'
  ),
  'instructor membership role update is denied'
);
select pg_temp.record_result(
  'IM1B1-11',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_members (school_id, user_id, role) values ('20000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000002', 'teacher_admin')$sql$,
    '42501'
  ),
  'user cannot add own membership'
);
reset role;

select pg_temp.record_result(
  'IM1B1-12',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_stock_lots (school_id, item_id, received_at, initial_quantity, remaining_quantity) values ('10000000-0000-4000-8000-00000000000a', 'b2200000-0000-4000-8000-000000000001', now(), 1, 1)$sql$,
    '23503'
  ),
  'composite FK rejects cross-tenant item and lot link'
);

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-13',
  (select count(*) = 2 from public.inventory_items)
    and pg_temp.statement_raises(
      $sql$insert into public.inventory_items (school_id, item_name, base_unit, purchase_unit) values ('20000000-0000-4000-8000-00000000000b', 'Synthetic Cross Role Insert', 'unit', 'unit')$sql$,
      '42501'
    )
    and pg_temp.statement_row_count(
      $sql$update public.inventory_items set minimum_stock = 999 where item_id = 'b2200000-0000-4000-8000-000000000001'$sql$
    ) = 0,
  'multi-school user reads both schools but administers only teacher_admin school'
);
reset role;

select set_config('request.jwt.claims', '{}', true);
set local role anon;
select pg_temp.record_result(
  'IM1B1-14',
  pg_temp.statement_raises($sql$select * from public.inventory_items$sql$, '42501'),
  'anonymous role has no inventory table access'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"teacher_admin"}}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-A01',
  pg_temp.statement_raises(
    $sql$insert into public.inventory_items (school_id, item_name, base_unit, purchase_unit) values ('10000000-0000-4000-8000-00000000000a', 'Synthetic Forged Metadata Insert', 'unit', 'unit')$sql$,
    '42501'
  ),
  'forged user metadata does not grant teacher_admin access'
);
reset role;

select pg_temp.record_result(
  'IM1B1-A02',
  not has_function_privilege('anon', 'inventory_private.inventory_has_active_membership(uuid,text)', 'execute')
    and has_function_privilege('authenticated', 'inventory_private.inventory_has_active_membership(uuid,text)', 'execute'),
  'membership helper execute is denied to anon and granted only to authenticated'
);

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.record_result(
  'IM1B1-A03',
  pg_temp.statement_row_count(
    $sql$insert into public.inventory_items (school_id, item_name, base_unit, purchase_unit) values ('10000000-0000-4000-8000-00000000000a', 'Synthetic Teacher Managed Item', 'unit', 'unit')$sql$
  ) = 1
    and pg_temp.statement_row_count(
      $sql$update public.inventory_items set minimum_stock = 2 where item_name = 'Synthetic Teacher Managed Item'$sql$
    ) = 1,
  'teacher_admin can insert and update allowed item columns in own school'
);
reset role;

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

