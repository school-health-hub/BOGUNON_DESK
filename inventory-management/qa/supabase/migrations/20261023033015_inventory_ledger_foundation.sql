alter table public.inventory_stock_lots
  add constraint inventory_stock_lots_school_item_lot_key
  unique (school_id, item_id, lot_id);

create table public.inventory_stock_movements (
  movement_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  item_id uuid not null,
  lot_id uuid not null,
  request_id uuid not null,
  movement_type text not null,
  quantity_delta bigint not null,
  quantity_before bigint not null,
  quantity_after bigint not null,
  actor_user_id uuid not null,
  reason text not null,
  related_movement_id uuid,
  created_at timestamptz not null default now(),
  constraint inventory_stock_movements_school_movement_key
    unique (school_id, movement_id),
  constraint inventory_stock_movements_school_fkey
    foreign key (school_id)
    references public.inventory_schools (school_id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_movements_school_item_fkey
    foreign key (school_id, item_id)
    references public.inventory_items (school_id, item_id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_movements_school_item_lot_fkey
    foreign key (school_id, item_id, lot_id)
    references public.inventory_stock_lots (school_id, item_id, lot_id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_movements_actor_fkey
    foreign key (actor_user_id)
    references auth.users (id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_movements_related_fkey
    foreign key (school_id, related_movement_id)
    references public.inventory_stock_movements (school_id, movement_id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_movements_type_check
    check (movement_type in ('INITIAL_BALANCE', 'RECEIVE', 'USE', 'DISPOSE', 'ADJUST', 'REVERSAL')),
  constraint inventory_stock_movements_delta_nonzero
    check (quantity_delta <> 0),
  constraint inventory_stock_movements_before_nonnegative
    check (quantity_before >= 0),
  constraint inventory_stock_movements_after_nonnegative
    check (quantity_after >= 0),
  constraint inventory_stock_movements_balance_equation
    check (quantity_before + quantity_delta = quantity_after),
  constraint inventory_stock_movements_reason_not_blank
    check (btrim(reason) <> ''),
  constraint inventory_stock_movements_related_not_self
    check (related_movement_id is null or related_movement_id <> movement_id),
  constraint inventory_stock_movements_reversal_link_check
    check (
      (movement_type = 'REVERSAL' and related_movement_id is not null)
      or (movement_type <> 'REVERSAL' and related_movement_id is null)
    )
);

create table public.inventory_audit (
  audit_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  actor_user_id uuid not null,
  action_type text not null,
  target_type text not null,
  target_id uuid not null,
  request_id uuid not null,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_audit_school_fkey
    foreign key (school_id)
    references public.inventory_schools (school_id)
    on update restrict
    on delete restrict,
  constraint inventory_audit_actor_fkey
    foreign key (actor_user_id)
    references auth.users (id)
    on update restrict
    on delete restrict,
  constraint inventory_audit_action_not_blank check (btrim(action_type) <> ''),
  constraint inventory_audit_target_not_blank check (btrim(target_type) <> ''),
  constraint inventory_audit_reason_not_blank check (btrim(reason) <> ''),
  constraint inventory_audit_details_object check (jsonb_typeof(details) = 'object')
);

create table public.inventory_idempotency_requests (
  request_record_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  actor_user_id uuid not null,
  operation text not null,
  request_uuid uuid not null,
  payload_hash text not null,
  status text not null default 'PROCESSING',
  response_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint inventory_idempotency_requests_scope_key
    unique (school_id, actor_user_id, operation, request_uuid),
  constraint inventory_idempotency_requests_school_fkey
    foreign key (school_id)
    references public.inventory_schools (school_id)
    on update restrict
    on delete restrict,
  constraint inventory_idempotency_requests_actor_fkey
    foreign key (actor_user_id)
    references auth.users (id)
    on update restrict
    on delete restrict,
  constraint inventory_idempotency_requests_operation_not_blank
    check (btrim(operation) <> ''),
  constraint inventory_idempotency_requests_payload_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint inventory_idempotency_requests_status_check
    check (status in ('PROCESSING', 'COMPLETED')),
  constraint inventory_idempotency_requests_completion_check
    check (
      (status = 'PROCESSING' and response_payload is null and completed_at is null)
      or (status = 'COMPLETED' and response_payload is not null and completed_at is not null)
    )
);

create unique index inventory_stock_movements_request_lot_type_key
  on public.inventory_stock_movements
  (school_id, actor_user_id, request_id, lot_id, movement_type);

create unique index inventory_stock_movements_one_reversal_key
  on public.inventory_stock_movements (school_id, related_movement_id)
  where movement_type = 'REVERSAL';

create index inventory_stock_movements_school_item_created_idx
  on public.inventory_stock_movements (school_id, item_id, created_at desc, movement_id);

create index inventory_stock_movements_school_lot_created_idx
  on public.inventory_stock_movements (school_id, lot_id, created_at desc, movement_id);

create index inventory_stock_movements_actor_created_idx
  on public.inventory_stock_movements (actor_user_id, school_id, created_at desc, movement_id);

create index inventory_audit_school_created_idx
  on public.inventory_audit (school_id, created_at desc, audit_id);

create index inventory_audit_actor_created_idx
  on public.inventory_audit (actor_user_id, school_id, created_at desc, audit_id);

create index inventory_audit_request_idx
  on public.inventory_audit (school_id, request_id);

create index inventory_idempotency_requests_status_created_idx
  on public.inventory_idempotency_requests (school_id, status, created_at);

create or replace function inventory_private.inventory_reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception using
    errcode = '55000',
    message = format('%I is append-only', tg_table_name);
end;
$function$;

revoke all on function inventory_private.inventory_reject_immutable_change()
  from public, anon, authenticated;

create trigger inventory_stock_movements_immutable
before update or delete on public.inventory_stock_movements
for each row execute function inventory_private.inventory_reject_immutable_change();

create trigger inventory_audit_immutable
before update or delete on public.inventory_audit
for each row execute function inventory_private.inventory_reject_immutable_change();

alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_stock_movements force row level security;
alter table public.inventory_audit enable row level security;
alter table public.inventory_audit force row level security;
alter table public.inventory_idempotency_requests enable row level security;
alter table public.inventory_idempotency_requests force row level security;

create policy inventory_stock_movements_select_member_scope
on public.inventory_stock_movements
for select
to authenticated
using (
  (select inventory_private.inventory_has_active_membership(school_id, 'teacher_admin'))
  or (
    actor_user_id = (select auth.uid())
    and (select inventory_private.inventory_has_active_membership(school_id, 'instructor'))
  )
);

create policy inventory_audit_select_teacher_admin
on public.inventory_audit
for select
to authenticated
using ((select inventory_private.inventory_has_active_membership(school_id, 'teacher_admin')));

revoke all on table public.inventory_stock_movements from public, anon, authenticated;
revoke all on table public.inventory_audit from public, anon, authenticated;
revoke all on table public.inventory_idempotency_requests from public, anon, authenticated;

grant select on table public.inventory_stock_movements to authenticated;
grant select on table public.inventory_audit to authenticated;
