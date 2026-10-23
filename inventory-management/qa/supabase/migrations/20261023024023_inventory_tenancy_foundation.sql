create schema if not exists inventory_private;

revoke all on schema inventory_private from public, anon, authenticated;
grant usage on schema inventory_private to authenticated;

create table public.inventory_schools (
  school_id uuid primary key default gen_random_uuid(),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_schools_display_name_not_blank
    check (btrim(display_name) <> '')
);

create table public.inventory_members (
  school_id uuid not null,
  user_id uuid not null,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_members_pkey primary key (school_id, user_id),
  constraint inventory_members_school_fkey
    foreign key (school_id)
    references public.inventory_schools (school_id)
    on update restrict
    on delete restrict,
  constraint inventory_members_user_fkey
    foreign key (user_id)
    references auth.users (id)
    on update restrict
    on delete restrict,
  constraint inventory_members_role_check
    check (role in ('teacher_admin', 'instructor'))
);

create table public.inventory_items (
  item_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  item_name text not null,
  category text,
  specification text,
  base_unit text not null,
  purchase_unit text not null,
  base_units_per_purchase_unit numeric(18, 6) not null default 1,
  recommended_stock bigint not null default 0,
  minimum_stock bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_school_item_key unique (school_id, item_id),
  constraint inventory_items_school_fkey
    foreign key (school_id)
    references public.inventory_schools (school_id)
    on update restrict
    on delete restrict,
  constraint inventory_items_name_not_blank check (btrim(item_name) <> ''),
  constraint inventory_items_base_unit_not_blank check (btrim(base_unit) <> ''),
  constraint inventory_items_purchase_unit_not_blank check (btrim(purchase_unit) <> ''),
  constraint inventory_items_conversion_positive check (base_units_per_purchase_unit > 0),
  constraint inventory_items_recommended_nonnegative check (recommended_stock >= 0),
  constraint inventory_items_minimum_nonnegative check (minimum_stock >= 0)
);

create table public.inventory_stock_lots (
  lot_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  item_id uuid not null,
  received_at timestamptz not null,
  expires_on date,
  initial_quantity bigint not null,
  remaining_quantity bigint not null,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_stock_lots_school_lot_key unique (school_id, lot_id),
  constraint inventory_stock_lots_school_fkey
    foreign key (school_id)
    references public.inventory_schools (school_id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_lots_school_item_fkey
    foreign key (school_id, item_id)
    references public.inventory_items (school_id, item_id)
    on update restrict
    on delete restrict,
  constraint inventory_stock_lots_initial_nonnegative check (initial_quantity >= 0),
  constraint inventory_stock_lots_remaining_nonnegative check (remaining_quantity >= 0),
  constraint inventory_stock_lots_status_check
    check (status in ('available', 'quarantined', 'unavailable', 'depleted'))
);

create index inventory_members_user_active_idx
  on public.inventory_members (user_id, school_id)
  where is_active;

create index inventory_items_school_active_idx
  on public.inventory_items (school_id, item_name)
  where is_active;

create index inventory_stock_lots_school_item_fefo_idx
  on public.inventory_stock_lots (school_id, item_id, expires_on, received_at, lot_id)
  where status = 'available' and remaining_quantity > 0;

create or replace function inventory_private.inventory_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function inventory_private.inventory_set_updated_at() from public, anon, authenticated;

create trigger inventory_schools_set_updated_at
before update on public.inventory_schools
for each row execute function inventory_private.inventory_set_updated_at();

create trigger inventory_members_set_updated_at
before update on public.inventory_members
for each row execute function inventory_private.inventory_set_updated_at();

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function inventory_private.inventory_set_updated_at();

create trigger inventory_stock_lots_set_updated_at
before update on public.inventory_stock_lots
for each row execute function inventory_private.inventory_set_updated_at();

create or replace function inventory_private.inventory_has_active_membership(
  target_school_id uuid,
  required_role text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.inventory_members as member
      join public.inventory_schools as school
        on school.school_id = member.school_id
      where member.school_id = target_school_id
        and member.user_id = (select auth.uid())
        and member.is_active
        and school.is_active
        and (required_role is null or member.role = required_role)
    );
$function$;

revoke all on function inventory_private.inventory_has_active_membership(uuid, text)
  from public, anon, authenticated;
grant execute on function inventory_private.inventory_has_active_membership(uuid, text)
  to authenticated;

alter table public.inventory_schools enable row level security;
alter table public.inventory_schools force row level security;
alter table public.inventory_members enable row level security;
alter table public.inventory_members force row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_items force row level security;
alter table public.inventory_stock_lots enable row level security;
alter table public.inventory_stock_lots force row level security;

create policy inventory_schools_select_active_member
on public.inventory_schools
for select
to authenticated
using (
  is_active
  and (select inventory_private.inventory_has_active_membership(school_id, null))
);

create policy inventory_members_select_self_or_school_admin
on public.inventory_members
for select
to authenticated
using (
  (
    user_id = (select auth.uid())
    and is_active
    and (select inventory_private.inventory_has_active_membership(school_id, null))
  )
  or (select inventory_private.inventory_has_active_membership(school_id, 'teacher_admin'))
);

create policy inventory_items_select_active_member
on public.inventory_items
for select
to authenticated
using ((select inventory_private.inventory_has_active_membership(school_id, null)));

create policy inventory_items_insert_teacher_admin
on public.inventory_items
for insert
to authenticated
with check ((select inventory_private.inventory_has_active_membership(school_id, 'teacher_admin')));

create policy inventory_items_update_teacher_admin
on public.inventory_items
for update
to authenticated
using ((select inventory_private.inventory_has_active_membership(school_id, 'teacher_admin')))
with check ((select inventory_private.inventory_has_active_membership(school_id, 'teacher_admin')));

create policy inventory_stock_lots_select_active_member
on public.inventory_stock_lots
for select
to authenticated
using ((select inventory_private.inventory_has_active_membership(school_id, null)));

revoke all on table public.inventory_schools from public, anon, authenticated;
revoke all on table public.inventory_members from public, anon, authenticated;
revoke all on table public.inventory_items from public, anon, authenticated;
revoke all on table public.inventory_stock_lots from public, anon, authenticated;

grant select on table public.inventory_schools to authenticated;
grant select on table public.inventory_members to authenticated;
grant select on table public.inventory_items to authenticated;
grant select on table public.inventory_stock_lots to authenticated;

grant insert (
  school_id,
  item_name,
  category,
  specification,
  base_unit,
  purchase_unit,
  base_units_per_purchase_unit,
  recommended_stock,
  minimum_stock,
  is_active
) on public.inventory_items to authenticated;

grant update (
  item_name,
  category,
  specification,
  base_unit,
  purchase_unit,
  base_units_per_purchase_unit,
  recommended_stock,
  minimum_stock,
  is_active
) on public.inventory_items to authenticated;
