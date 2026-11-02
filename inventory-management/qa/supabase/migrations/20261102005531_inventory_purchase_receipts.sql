create table public.inventory_purchase_batches (
  batch_id uuid primary key,
  school_id uuid not null,
  created_by uuid not null,
  status text not null default 'DRAFT',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_purchase_batches_school_batch_key unique(school_id,batch_id),
  constraint inventory_purchase_batches_school_fkey foreign key(school_id) references public.inventory_schools(school_id) on delete restrict,
  constraint inventory_purchase_batches_actor_fkey foreign key(created_by) references auth.users(id) on delete restrict,
  constraint inventory_purchase_batches_status_check check(status in ('DRAFT','APPROVED','ORDERED','AWAITING_RECEIPT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  constraint inventory_purchase_batches_note_check check(note is null or (btrim(note)<>'' and char_length(note)<=500))
);

create table public.inventory_purchase_lines (
  line_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  batch_id uuid not null,
  candidate_id text not null,
  item_id uuid not null,
  requested_purchase_quantity numeric(18,6) not null,
  requested_base_quantity bigint not null,
  received_base_quantity bigint not null default 0,
  base_unit text not null,
  purchase_unit text not null,
  base_units_per_purchase_unit numeric(18,6) not null,
  specification_snapshot text,
  expected_unit_price numeric(18,2),
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_purchase_lines_school_line_key unique(school_id,line_id),
  constraint inventory_purchase_lines_school_batch_line_item_key unique(school_id,batch_id,line_id,item_id),
  constraint inventory_purchase_lines_school_batch_candidate_key unique(school_id,batch_id,candidate_id),
  constraint inventory_purchase_lines_school_batch_fkey foreign key(school_id,batch_id) references public.inventory_purchase_batches(school_id,batch_id) on delete restrict,
  constraint inventory_purchase_lines_school_item_fkey foreign key(school_id,item_id) references public.inventory_items(school_id,item_id) on delete restrict,
  constraint inventory_purchase_lines_candidate_check check(btrim(candidate_id)<>'' and char_length(candidate_id)<=100),
  constraint inventory_purchase_lines_quantities_check check(requested_purchase_quantity>0 and requested_base_quantity>0 and received_base_quantity>=0 and received_base_quantity<=requested_base_quantity),
  constraint inventory_purchase_lines_conversion_check check(base_units_per_purchase_unit>0 and requested_purchase_quantity*base_units_per_purchase_unit=requested_base_quantity),
  constraint inventory_purchase_lines_units_check check(btrim(base_unit)<>'' and btrim(purchase_unit)<>''),
  constraint inventory_purchase_lines_price_check check(expected_unit_price is null or expected_unit_price>=0),
  constraint inventory_purchase_lines_currency_check check((expected_unit_price is null and currency is null) or (expected_unit_price is not null and currency ~ '^[A-Z]{3}$'))
);

create table public.inventory_purchase_receipts (
  receipt_id uuid primary key,
  school_id uuid not null,
  batch_id uuid not null,
  request_uuid uuid not null,
  confirmed_by uuid not null,
  received_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint inventory_purchase_receipts_school_receipt_key unique(school_id,receipt_id),
  constraint inventory_purchase_receipts_school_batch_receipt_key unique(school_id,batch_id,receipt_id),
  constraint inventory_purchase_receipts_school_batch_fkey foreign key(school_id,batch_id) references public.inventory_purchase_batches(school_id,batch_id) on delete restrict,
  constraint inventory_purchase_receipts_actor_fkey foreign key(confirmed_by) references auth.users(id) on delete restrict,
  constraint inventory_purchase_receipts_reason_check check(btrim(reason)<>'' and char_length(reason)<=500)
);

create table public.inventory_purchase_receipt_lines (
  receipt_line_id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  batch_id uuid not null,
  receipt_id uuid not null,
  line_id uuid not null,
  item_id uuid not null,
  lot_id uuid not null,
  movement_id uuid not null,
  received_purchase_quantity numeric(18,6) not null,
  received_base_quantity bigint not null,
  created_at timestamptz not null default now(),
  constraint inventory_purchase_receipt_lines_receipt_line_key unique(school_id,receipt_id,line_id),
  constraint inventory_purchase_receipt_lines_school_receipt_fkey foreign key(school_id,batch_id,receipt_id) references public.inventory_purchase_receipts(school_id,batch_id,receipt_id) on delete restrict,
  constraint inventory_purchase_receipt_lines_school_batch_line_item_fkey foreign key(school_id,batch_id,line_id,item_id) references public.inventory_purchase_lines(school_id,batch_id,line_id,item_id) on delete restrict,
  constraint inventory_purchase_receipt_lines_school_item_lot_fkey foreign key(school_id,item_id,lot_id) references public.inventory_stock_lots(school_id,item_id,lot_id) on delete restrict,
  constraint inventory_purchase_receipt_lines_school_movement_fkey foreign key(school_id,movement_id) references public.inventory_stock_movements(school_id,movement_id) on delete restrict,
  constraint inventory_purchase_receipt_lines_quantities_check check(received_purchase_quantity>0 and received_base_quantity>0)
);

create index inventory_purchase_batches_school_status_idx on public.inventory_purchase_batches(school_id,status,batch_id);
create index inventory_purchase_lines_batch_lock_idx on public.inventory_purchase_lines(school_id,batch_id,line_id);
create index inventory_purchase_receipts_batch_idx on public.inventory_purchase_receipts(school_id,batch_id,created_at,receipt_id);
create index inventory_purchase_receipt_lines_line_idx on public.inventory_purchase_receipt_lines(school_id,line_id,created_at,receipt_line_id);

create trigger inventory_purchase_batches_set_updated_at before update on public.inventory_purchase_batches for each row execute function inventory_private.inventory_set_updated_at();
create trigger inventory_purchase_lines_set_updated_at before update on public.inventory_purchase_lines for each row execute function inventory_private.inventory_set_updated_at();

alter table public.inventory_purchase_batches enable row level security;
alter table public.inventory_purchase_batches force row level security;
alter table public.inventory_purchase_lines enable row level security;
alter table public.inventory_purchase_lines force row level security;
alter table public.inventory_purchase_receipts enable row level security;
alter table public.inventory_purchase_receipts force row level security;
alter table public.inventory_purchase_receipt_lines enable row level security;
alter table public.inventory_purchase_receipt_lines force row level security;

create policy inventory_purchase_batches_select_teacher on public.inventory_purchase_batches for select to authenticated using ((select inventory_private.inventory_has_active_membership(school_id,'teacher_admin')));
create policy inventory_purchase_lines_select_teacher on public.inventory_purchase_lines for select to authenticated using ((select inventory_private.inventory_has_active_membership(school_id,'teacher_admin')));
create policy inventory_purchase_receipts_select_teacher on public.inventory_purchase_receipts for select to authenticated using ((select inventory_private.inventory_has_active_membership(school_id,'teacher_admin')));
create policy inventory_purchase_receipt_lines_select_teacher on public.inventory_purchase_receipt_lines for select to authenticated using ((select inventory_private.inventory_has_active_membership(school_id,'teacher_admin')));

revoke all on table public.inventory_purchase_batches,public.inventory_purchase_lines,public.inventory_purchase_receipts,public.inventory_purchase_receipt_lines from public,anon,authenticated;
grant select on table public.inventory_purchase_batches,public.inventory_purchase_lines,public.inventory_purchase_receipts,public.inventory_purchase_receipt_lines to authenticated;

create or replace function public.inventory_create_purchase_batch(p_school_id uuid,p_batch_id uuid,p_request_uuid uuid,p_note text,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_hash text; v_record uuid; v_existing record; v_line jsonb; v_item record; v_qty numeric; v_ratio numeric; v_base numeric; v_now timestamptz:=clock_timestamp(); v_response jsonb;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
 if p_batch_id is null or p_request_uuid is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>100 then raise sqlstate 'PT422' using message='INVALID_PURCHASE_BATCH'; end if;
 if p_note is not null and (btrim(p_note)='' or char_length(p_note)>500) then raise sqlstate 'PT422' using message='INVALID_NOTE'; end if;
 if not inventory_private.inventory_has_active_membership(p_school_id,'teacher_admin') then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','PURCHASE_BATCH_CREATE','school_id',p_school_id,'batch_id',p_batch_id,'note',p_note,'lines',(select jsonb_agg(x order by x->>'candidate_id') from jsonb_array_elements(p_lines)x))::text,'UTF8'),'sha256'),'hex');
 insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status) values(p_school_id,v_actor,'PURCHASE_BATCH_CREATE',p_request_uuid,v_hash,'PROCESSING') on conflict do nothing returning request_record_id into v_record;
 if v_record is null then select * into v_existing from public.inventory_idempotency_requests where school_id=p_school_id and actor_user_id=v_actor and operation='PURCHASE_BATCH_CREATE' and request_uuid=p_request_uuid for update; if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if; if v_existing.status='COMPLETED' then return v_existing.response_payload||jsonb_build_object('replayed',true); end if; raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT'; end if;
 insert into public.inventory_purchase_batches(batch_id,school_id,created_by,status,note) values(p_batch_id,p_school_id,v_actor,'DRAFT',nullif(btrim(p_note),''));
 for v_line in select value from jsonb_array_elements(p_lines) order by value->>'candidate_id' loop
   if (select count(*) from jsonb_object_keys(v_line))<>9 then raise sqlstate 'PT422' using message='INVALID_PURCHASE_LINE'; end if;
   v_qty:=(v_line->>'requested_purchase_quantity')::numeric; v_ratio:=(v_line->>'base_units_per_purchase_unit')::numeric; v_base:=v_qty*v_ratio;
   if v_qty<=0 or v_ratio<=0 or v_base<>trunc(v_base) or v_base>9223372036854775807 then raise sqlstate 'PT422' using message='INEXACT_UNIT_CONVERSION'; end if;
   select * into v_item from public.inventory_items where school_id=p_school_id and item_id=(v_line->>'item_id')::uuid and is_active for update;
   if not found then raise sqlstate 'PT404' using message='ITEM_NOT_FOUND'; end if;
   if v_item.base_unit<>btrim(v_line->>'base_unit') or v_item.purchase_unit<>btrim(v_line->>'purchase_unit') or v_item.base_units_per_purchase_unit<>v_ratio then raise sqlstate 'PT422' using message='UNIT_CONVERSION_MISMATCH'; end if;
   insert into public.inventory_purchase_lines(school_id,batch_id,candidate_id,item_id,requested_purchase_quantity,requested_base_quantity,base_unit,purchase_unit,base_units_per_purchase_unit,specification_snapshot,expected_unit_price,currency)
   values(p_school_id,p_batch_id,btrim(v_line->>'candidate_id'),v_item.item_id,v_qty,v_base::bigint,v_item.base_unit,v_item.purchase_unit,v_ratio,nullif(btrim(v_line->>'specification_snapshot'),''),nullif(v_line->>'expected_unit_price','')::numeric,nullif(upper(btrim(v_line->>'currency')),''));
 end loop;
 v_response:=jsonb_build_object('request_uuid',p_request_uuid,'operation','PURCHASE_BATCH_CREATE','school_id',p_school_id,'batch_id',p_batch_id,'status','DRAFT','line_count',jsonb_array_length(p_lines),'processed_at',v_now,'replayed',false);
 update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_now where request_record_id=v_record;
 return v_response;
end;$function$;

create or replace function public.inventory_set_purchase_batch_status(p_school_id uuid,p_batch_id uuid,p_target_status text,p_request_uuid uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_current text; v_reason text; v_hash text; v_record uuid; v_existing record; v_now timestamptz:=clock_timestamp(); v_response jsonb;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
 if not inventory_private.inventory_has_active_membership(p_school_id,'teacher_admin') then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
 v_reason:=inventory_private.inventory_validate_reason(p_reason);
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','PURCHASE_BATCH_STATUS','school_id',p_school_id,'batch_id',p_batch_id,'target_status',p_target_status,'reason',v_reason)::text,'UTF8'),'sha256'),'hex');
 insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status) values(p_school_id,v_actor,'PURCHASE_BATCH_STATUS',p_request_uuid,v_hash,'PROCESSING') on conflict do nothing returning request_record_id into v_record;
 if v_record is null then select * into v_existing from public.inventory_idempotency_requests where school_id=p_school_id and actor_user_id=v_actor and operation='PURCHASE_BATCH_STATUS' and request_uuid=p_request_uuid for update; if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if; if v_existing.status='COMPLETED' then return v_existing.response_payload||jsonb_build_object('replayed',true); end if; raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT'; end if;
 select status into v_current from public.inventory_purchase_batches where school_id=p_school_id and batch_id=p_batch_id for update; if not found then raise sqlstate 'PT404' using message='PURCHASE_BATCH_NOT_FOUND'; end if;
 if not ((v_current='DRAFT' and p_target_status in('APPROVED','CANCELLED')) or (v_current='APPROVED' and p_target_status in('ORDERED','CANCELLED')) or (v_current='ORDERED' and p_target_status in('AWAITING_RECEIPT','CANCELLED'))) then raise sqlstate 'PT422' using message='INVALID_PURCHASE_STATUS_TRANSITION'; end if;
 update public.inventory_purchase_batches set status=p_target_status where school_id=p_school_id and batch_id=p_batch_id;
 insert into public.inventory_audit(school_id,actor_user_id,action_type,target_type,target_id,request_id,reason,details,created_at) values(p_school_id,v_actor,'PURCHASE_BATCH_STATUS_CHANGED','inventory_purchase_batch',p_batch_id,p_request_uuid,v_reason,jsonb_build_object('from',v_current,'to',p_target_status),v_now);
 v_response:=jsonb_build_object('request_uuid',p_request_uuid,'operation','PURCHASE_BATCH_STATUS','school_id',p_school_id,'batch_id',p_batch_id,'status',p_target_status,'processed_at',v_now,'replayed',false);
 update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_now where request_record_id=v_record; return v_response;
end;$function$;

create or replace function public.inventory_confirm_receipt(p_school_id uuid,p_batch_id uuid,p_receipt_id uuid,p_request_uuid uuid,p_received_at timestamptz,p_reason text,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_reason text; v_hash text; v_record uuid; v_existing record; v_status text; v_line jsonb; v_purchase record; v_qty numeric; v_base numeric; v_lot uuid; v_move uuid; v_now timestamptz:=clock_timestamp(); v_receipt_lines jsonb:='[]'::jsonb; v_remaining jsonb; v_response jsonb; v_item uuid;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
 if p_receipt_id is null or p_request_uuid is null or p_received_at is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>100 then raise sqlstate 'PT422' using message='INVALID_RECEIPT'; end if;
 if not inventory_private.inventory_has_active_membership(p_school_id,'teacher_admin') then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
 v_reason:=inventory_private.inventory_validate_reason(p_reason);
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','PURCHASE_RECEIPT_CONFIRM','school_id',p_school_id,'batch_id',p_batch_id,'receipt_id',p_receipt_id,'received_at',p_received_at,'reason',v_reason,'lines',(select jsonb_agg(x order by x->>'line_id') from jsonb_array_elements(p_lines)x))::text,'UTF8'),'sha256'),'hex');
 insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status) values(p_school_id,v_actor,'PURCHASE_RECEIPT_CONFIRM',p_request_uuid,v_hash,'PROCESSING') on conflict do nothing returning request_record_id into v_record;
 if v_record is null then select * into v_existing from public.inventory_idempotency_requests where school_id=p_school_id and actor_user_id=v_actor and operation='PURCHASE_RECEIPT_CONFIRM' and request_uuid=p_request_uuid for update; if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if; if v_existing.status='COMPLETED' then return v_existing.response_payload||jsonb_build_object('replayed',true); end if; raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT'; end if;
 select status into v_status from public.inventory_purchase_batches where school_id=p_school_id and batch_id=p_batch_id for update; if not found then raise sqlstate 'PT404' using message='PURCHASE_BATCH_NOT_FOUND'; end if;
 if v_status not in('AWAITING_RECEIPT','PARTIALLY_RECEIVED') then raise sqlstate 'PT422' using message='PURCHASE_BATCH_NOT_RECEIVABLE'; end if;
 if exists(select 1 from public.inventory_purchase_receipts where receipt_id=p_receipt_id) then raise sqlstate 'PT409' using message='DUPLICATE_RECEIPT'; end if;
 insert into public.inventory_purchase_receipts(receipt_id,school_id,batch_id,request_uuid,confirmed_by,received_at,reason) values(p_receipt_id,p_school_id,p_batch_id,p_request_uuid,v_actor,p_received_at,v_reason);
 for v_line in select value from jsonb_array_elements(p_lines) order by (value->>'line_id')::uuid loop
   select * into v_purchase from public.inventory_purchase_lines where school_id=p_school_id and batch_id=p_batch_id and line_id=(v_line->>'line_id')::uuid for update; if not found then raise sqlstate 'PT404' using message='PURCHASE_LINE_NOT_FOUND'; end if;
   v_qty:=(v_line->>'received_purchase_quantity')::numeric; v_base:=v_qty*v_purchase.base_units_per_purchase_unit;
   if v_qty<=0 or v_base<>trunc(v_base) or v_base>9223372036854775807 then raise sqlstate 'PT422' using message='INEXACT_UNIT_CONVERSION'; end if;
   if v_purchase.received_base_quantity+v_base::bigint>v_purchase.requested_base_quantity then raise sqlstate 'PT409' using message='PURCHASE_RECEIPT_EXCEEDS_REQUESTED'; end if;
   perform 1 from public.inventory_items where school_id=p_school_id and item_id=v_purchase.item_id and is_active for update; if not found then raise sqlstate 'PT404' using message='ITEM_NOT_FOUND'; end if;
   insert into public.inventory_stock_lots(school_id,item_id,received_at,expires_on,initial_quantity,remaining_quantity,status) values(p_school_id,v_purchase.item_id,p_received_at,nullif(v_line->>'expires_on','')::date,v_base::bigint,v_base::bigint,'available') returning lot_id into v_lot;
   insert into public.inventory_stock_movements(school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason,created_at) values(p_school_id,v_purchase.item_id,v_lot,p_request_uuid,'RECEIVE',v_base::bigint,0,v_base::bigint,v_actor,v_reason,v_now) returning movement_id into v_move;
   insert into public.inventory_purchase_receipt_lines(school_id,batch_id,receipt_id,line_id,item_id,lot_id,movement_id,received_purchase_quantity,received_base_quantity) values(p_school_id,p_batch_id,p_receipt_id,v_purchase.line_id,v_purchase.item_id,v_lot,v_move,v_qty,v_base::bigint);
   update public.inventory_purchase_lines set received_base_quantity=received_base_quantity+v_base::bigint where school_id=p_school_id and line_id=v_purchase.line_id;
   v_receipt_lines:=v_receipt_lines||jsonb_build_array(jsonb_build_object('line_id',v_purchase.line_id,'item_id',v_purchase.item_id,'lot_id',v_lot,'movement_id',v_move,'received_base_quantity',v_base::bigint)); v_item:=v_purchase.item_id;
 end loop;
 if exists(select 1 from public.inventory_purchase_lines where school_id=p_school_id and batch_id=p_batch_id and received_base_quantity<requested_base_quantity) then v_status:='PARTIALLY_RECEIVED'; else v_status:='RECEIVED'; end if;
 update public.inventory_purchase_batches set status=v_status where school_id=p_school_id and batch_id=p_batch_id;
 insert into public.inventory_audit(school_id,actor_user_id,action_type,target_type,target_id,request_id,reason,details,created_at) values(p_school_id,v_actor,'PURCHASE_RECEIPT_CONFIRMED','inventory_purchase_receipt',p_receipt_id,p_request_uuid,v_reason,jsonb_build_object('batch_id',p_batch_id,'receipt_lines',v_receipt_lines),v_now);
 select coalesce(jsonb_agg(jsonb_build_object('line_id',line_id,'remaining_base_quantity',requested_base_quantity-received_base_quantity) order by line_id),'[]'::jsonb) into v_remaining from public.inventory_purchase_lines where school_id=p_school_id and batch_id=p_batch_id;
 v_response:=jsonb_build_object('request_uuid',p_request_uuid,'operation','PURCHASE_RECEIPT_CONFIRM','school_id',p_school_id,'batch_id',p_batch_id,'receipt_id',p_receipt_id,'status',v_status,'item_id',v_item,'receipt_lines',v_receipt_lines,'remaining_by_line',v_remaining,'processed_at',v_now,'replayed',false);
 update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_now where request_record_id=v_record; return v_response;
end;$function$;

create or replace function public.inventory_reverse_movement(p_school_id uuid,p_original_movement_id uuid,p_request_uuid uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_response jsonb; v_item_id uuid;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
 if not inventory_private.inventory_has_active_membership(p_school_id,'teacher_admin') then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
 if exists(select 1 from public.inventory_purchase_receipt_lines where school_id=p_school_id and movement_id=p_original_movement_id) then raise sqlstate 'PT422' using message='PURCHASE_RECEIPT_REVERSAL_REQUIRES_POLICY'; end if;
 v_response:=public.inventory_reverse_movement_core(p_school_id,p_original_movement_id,p_request_uuid,p_reason); v_item_id:=(v_response->>'item_id')::uuid;
 return inventory_private.inventory_normalize_rpc_response(v_response,p_school_id,v_item_id,p_request_uuid,'REVERSAL');
end;$function$;

revoke all on function public.inventory_create_purchase_batch(uuid,uuid,uuid,text,jsonb),public.inventory_set_purchase_batch_status(uuid,uuid,text,uuid,text),public.inventory_confirm_receipt(uuid,uuid,uuid,uuid,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.inventory_create_purchase_batch(uuid,uuid,uuid,text,jsonb),public.inventory_set_purchase_batch_status(uuid,uuid,text,uuid,text),public.inventory_confirm_receipt(uuid,uuid,uuid,uuid,timestamptz,text,jsonb) to authenticated;
