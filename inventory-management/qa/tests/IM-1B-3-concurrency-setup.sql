\set ON_ERROR_STOP on

drop table if exists public.qa_im1b3_concurrency_results;
create unlogged table public.qa_im1b3_concurrency_results (
  scenario text not null,
  actor_user_id uuid not null,
  outcome text not null,
  error_code text,
  error_message text,
  response jsonb,
  created_at timestamptz not null default clock_timestamp()
);

revoke all on table public.qa_im1b3_concurrency_results from public, anon, authenticated;
grant insert on table public.qa_im1b3_concurrency_results to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'concurrency-teacher@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'concurrency-instructor-one@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'concurrency-instructor-two@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.inventory_schools (school_id, display_name)
values ('70000000-0000-4000-8000-00000000000a', 'Synthetic Concurrency School');

insert into public.inventory_members (school_id, user_id, role, is_active)
values
  ('70000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', 'teacher_admin', true),
  ('70000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000002', 'instructor', true),
  ('70000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000003', 'instructor', true);

insert into public.inventory_items (
  item_id, school_id, item_name, base_unit, purchase_unit,
  base_units_per_purchase_unit, recommended_stock, minimum_stock
)
values
  ('f1100000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-00000000000a', 'Synthetic Teacher Instructor Race', 'unit', 'unit', 1, 10, 1),
  ('f1100000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-00000000000a', 'Synthetic Two Instructor Race', 'unit', 'unit', 1, 10, 1),
  ('f1100000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-00000000000a', 'Synthetic Last Unit Race', 'unit', 'unit', 1, 1, 1),
  ('f1100000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-00000000000a', 'Synthetic Same UUID Race', 'unit', 'unit', 1, 10, 1);

insert into public.inventory_stock_lots (
  lot_id, school_id, item_id, received_at, expires_on,
  initial_quantity, remaining_quantity, status
)
values
  ('f1110000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-00000000000a', 'f1100000-0000-4000-8000-000000000001', '2026-01-01T00:00:00Z', '2099-01-01', 10, 10, 'available'),
  ('f1120000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-00000000000a', 'f1100000-0000-4000-8000-000000000002', '2026-01-01T00:00:00Z', '2099-01-01', 10, 10, 'available'),
  ('f1130000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-00000000000a', 'f1100000-0000-4000-8000-000000000003', '2026-01-01T00:00:00Z', '2099-01-01', 1, 1, 'available'),
  ('f1140000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-00000000000a', 'f1100000-0000-4000-8000-000000000004', '2026-01-01T00:00:00Z', '2099-01-01', 10, 10, 'available');
