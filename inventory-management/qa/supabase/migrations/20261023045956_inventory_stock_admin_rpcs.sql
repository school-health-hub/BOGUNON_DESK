create or replace function inventory_private.inventory_validate_reason(p_reason text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_reason text := btrim(p_reason);
begin
  if v_reason is null or v_reason = '' or char_length(v_reason) > 500 or v_reason ~ '[[:cntrl:]]' then
    raise sqlstate 'PT422' using message = 'INVALID_REASON', detail = 'Reason must contain 1 to 500 printable characters.';
  end if;
  return v_reason;
end;
$function$;

revoke all on function inventory_private.inventory_validate_reason(text) from public, anon, authenticated;

create or replace function public.inventory_receive_stock(
  p_school_id uuid,
  p_item_id uuid,
  p_purchase_quantity bigint,
  p_base_units_per_purchase_unit numeric,
  p_received_at timestamptz,
  p_expires_on date,
  p_purchase_link_id uuid,
  p_request_uuid uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_reason text;
  v_item_ratio numeric;
  v_base_quantity_numeric numeric;
  v_base_quantity bigint;
  v_payload jsonb;
  v_hash text;
  v_record_id uuid;
  v_existing record;
  v_lot_id uuid;
  v_movement_id uuid;
  v_processed_at timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'UNAUTHENTICATED'; end if;
  if p_request_uuid is null then raise sqlstate 'PT422' using message = 'INVALID_REQUEST_UUID'; end if;
  v_reason := inventory_private.inventory_validate_reason(p_reason);
  if p_purchase_link_id is not null then
    raise sqlstate 'PT422' using message = 'PURCHASE_LINK_NOT_SUPPORTED', detail = 'Purchase link integrity is not implemented yet.';
  end if;
  if p_purchase_quantity is null or p_purchase_quantity <= 0
     or p_base_units_per_purchase_unit is null or p_base_units_per_purchase_unit <= 0 then
    raise sqlstate 'PT422' using message = 'INVALID_QUANTITY';
  end if;
  if p_received_at is null then raise sqlstate 'PT422' using message = 'INVALID_RECEIVED_AT'; end if;
  if p_expires_on is not null and p_expires_on < p_received_at::date then
    raise sqlstate 'PT422' using message = 'INVALID_EXPIRATION_DATE';
  end if;
  v_base_quantity_numeric := p_purchase_quantity * p_base_units_per_purchase_unit;
  if v_base_quantity_numeric <> trunc(v_base_quantity_numeric) or v_base_quantity_numeric > 9223372036854775807 then
    raise sqlstate 'PT422' using message = 'INEXACT_UNIT_CONVERSION', detail = 'Unit conversion must produce an exact integer base quantity.';
  end if;
  v_base_quantity := v_base_quantity_numeric::bigint;

  if not exists (
    select 1 from public.inventory_members m join public.inventory_schools s using (school_id)
    where m.school_id = p_school_id and m.user_id = v_actor and m.is_active
      and m.role = 'teacher_admin' and s.is_active
  ) then raise sqlstate 'PT403' using message = 'PERMISSION_DENIED'; end if;

  v_payload := jsonb_build_object('operation','RECEIVE','school_id',p_school_id,'item_id',p_item_id,
    'purchase_quantity',p_purchase_quantity,'base_units_per_purchase_unit',p_base_units_per_purchase_unit,
    'received_at',p_received_at,'expires_on',p_expires_on,'purchase_link_id',p_purchase_link_id,'reason',v_reason);
  v_hash := encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status)
  values(p_school_id,v_actor,'RECEIVE',p_request_uuid,v_hash,'PROCESSING')
  on conflict (school_id,actor_user_id,operation,request_uuid) do nothing returning request_record_id into v_record_id;
  if v_record_id is null then
    select * into v_existing from public.inventory_idempotency_requests
    where school_id=p_school_id and actor_user_id=v_actor and operation='RECEIVE' and request_uuid=p_request_uuid for update;
    if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status='COMPLETED' then return v_existing.response_payload || jsonb_build_object('replayed',true); end if;
    raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT';
  end if;

  select base_units_per_purchase_unit into v_item_ratio from public.inventory_items
  where school_id=p_school_id and item_id=p_item_id and is_active for update;
  if not found then raise sqlstate 'PT404' using message='ITEM_NOT_FOUND'; end if;
  if v_item_ratio <> p_base_units_per_purchase_unit then
    raise sqlstate 'PT422' using message='UNIT_CONVERSION_MISMATCH';
  end if;

  insert into public.inventory_stock_lots(school_id,item_id,received_at,expires_on,initial_quantity,remaining_quantity,status)
  values(p_school_id,p_item_id,p_received_at,p_expires_on,v_base_quantity,v_base_quantity,'available') returning lot_id into v_lot_id;
  insert into public.inventory_stock_movements(school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason,created_at)
  values(p_school_id,p_item_id,v_lot_id,p_request_uuid,'RECEIVE',v_base_quantity,0,v_base_quantity,v_actor,v_reason,v_processed_at)
  returning movement_id into v_movement_id;
  insert into public.inventory_audit(school_id,actor_user_id,action_type,target_type,target_id,request_id,reason,details,created_at)
  values(p_school_id,v_actor,'STOCK_RECEIVED','inventory_lot',v_lot_id,p_request_uuid,v_reason,
    jsonb_build_object('item_id',p_item_id,'base_quantity',v_base_quantity,'movement_id',v_movement_id),v_processed_at);
  v_response := jsonb_build_object('request_uuid',p_request_uuid,'operation','RECEIVE','item_id',p_item_id,'lot_id',v_lot_id,
    'received_base_quantity',v_base_quantity,'movement_id',v_movement_id,'server_processed_at',v_processed_at,'replayed',false);
  update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_processed_at where request_record_id=v_record_id;
  return v_response;
end;
$function$;

create or replace function public.inventory_dispose_stock(
  p_school_id uuid, p_item_id uuid, p_lot_id uuid, p_quantity bigint, p_request_uuid uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid(); v_reason text; v_payload jsonb; v_hash text; v_record_id uuid; v_existing record;
  v_before bigint; v_after bigint; v_movement_id uuid; v_processed_at timestamptz := clock_timestamp(); v_response jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise sqlstate 'PT422' using message='INVALID_QUANTITY'; end if;
  if p_request_uuid is null then raise sqlstate 'PT422' using message='INVALID_REQUEST_UUID'; end if;
  v_reason := inventory_private.inventory_validate_reason(p_reason);
  if not exists(select 1 from public.inventory_members m join public.inventory_schools s using(school_id)
    where m.school_id=p_school_id and m.user_id=v_actor and m.is_active and m.role='teacher_admin' and s.is_active)
  then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
  v_payload:=jsonb_build_object('operation','DISPOSE','school_id',p_school_id,'item_id',p_item_id,'lot_id',p_lot_id,'quantity',p_quantity,'reason',v_reason);
  v_hash:=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status)
  values(p_school_id,v_actor,'DISPOSE',p_request_uuid,v_hash,'PROCESSING') on conflict(school_id,actor_user_id,operation,request_uuid) do nothing returning request_record_id into v_record_id;
  if v_record_id is null then
    select * into v_existing from public.inventory_idempotency_requests where school_id=p_school_id and actor_user_id=v_actor and operation='DISPOSE' and request_uuid=p_request_uuid for update;
    if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status='COMPLETED' then return v_existing.response_payload||jsonb_build_object('replayed',true); end if;
    raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT';
  end if;
  perform 1 from public.inventory_items where school_id=p_school_id and item_id=p_item_id for update;
  if not found then raise sqlstate 'PT404' using message='ITEM_NOT_FOUND'; end if;
  select remaining_quantity into v_before from public.inventory_stock_lots where school_id=p_school_id and item_id=p_item_id and lot_id=p_lot_id for update;
  if not found then raise sqlstate 'PT404' using message='LOT_NOT_FOUND'; end if;
  if v_before < p_quantity then raise sqlstate 'PT409' using message='INSUFFICIENT_STOCK'; end if;
  v_after:=v_before-p_quantity;
  update public.inventory_stock_lots set remaining_quantity=v_after,status=case when v_after=0 then 'depleted' else status end where school_id=p_school_id and item_id=p_item_id and lot_id=p_lot_id;
  insert into public.inventory_stock_movements(school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason,created_at)
  values(p_school_id,p_item_id,p_lot_id,p_request_uuid,'DISPOSE',-p_quantity,v_before,v_after,v_actor,v_reason,v_processed_at) returning movement_id into v_movement_id;
  insert into public.inventory_audit(school_id,actor_user_id,action_type,target_type,target_id,request_id,reason,details,created_at)
  values(p_school_id,v_actor,'STOCK_DISPOSED','inventory_lot',p_lot_id,p_request_uuid,v_reason,jsonb_build_object('item_id',p_item_id,'quantity',p_quantity,'movement_id',v_movement_id),v_processed_at);
  v_response:=jsonb_build_object('request_uuid',p_request_uuid,'operation','DISPOSE','item_id',p_item_id,'lot_id',p_lot_id,'disposed_quantity',p_quantity,'quantity_after',v_after,'movement_id',v_movement_id,'server_processed_at',v_processed_at,'replayed',false);
  update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_processed_at where request_record_id=v_record_id;
  return v_response;
end;$function$;

create or replace function public.inventory_adjust_stock(
  p_school_id uuid, p_item_id uuid, p_lot_id uuid, p_expected_quantity bigint, p_counted_quantity bigint, p_request_uuid uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid:=auth.uid(); v_reason text; v_payload jsonb; v_hash text; v_record_id uuid; v_existing record;
  v_before bigint; v_delta bigint; v_movement_id uuid; v_processed_at timestamptz:=clock_timestamp(); v_response jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
  if p_expected_quantity is null or p_expected_quantity<0 or p_counted_quantity is null or p_counted_quantity<0 then raise sqlstate 'PT422' using message='INVALID_QUANTITY'; end if;
  if p_request_uuid is null then raise sqlstate 'PT422' using message='INVALID_REQUEST_UUID'; end if;
  v_reason:=inventory_private.inventory_validate_reason(p_reason);
  if not exists(select 1 from public.inventory_members m join public.inventory_schools s using(school_id)
    where m.school_id=p_school_id and m.user_id=v_actor and m.is_active and m.role='teacher_admin' and s.is_active)
  then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
  v_payload:=jsonb_build_object('operation','ADJUST','school_id',p_school_id,'item_id',p_item_id,'lot_id',p_lot_id,'expected_quantity',p_expected_quantity,'counted_quantity',p_counted_quantity,'reason',v_reason);
  v_hash:=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status)
  values(p_school_id,v_actor,'ADJUST',p_request_uuid,v_hash,'PROCESSING') on conflict(school_id,actor_user_id,operation,request_uuid) do nothing returning request_record_id into v_record_id;
  if v_record_id is null then
    select * into v_existing from public.inventory_idempotency_requests where school_id=p_school_id and actor_user_id=v_actor and operation='ADJUST' and request_uuid=p_request_uuid for update;
    if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status='COMPLETED' then return v_existing.response_payload||jsonb_build_object('replayed',true); end if;
    raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT';
  end if;
  perform 1 from public.inventory_items where school_id=p_school_id and item_id=p_item_id for update;
  if not found then raise sqlstate 'PT404' using message='ITEM_NOT_FOUND'; end if;
  select remaining_quantity into v_before from public.inventory_stock_lots where school_id=p_school_id and item_id=p_item_id and lot_id=p_lot_id for update;
  if not found then raise sqlstate 'PT404' using message='LOT_NOT_FOUND'; end if;
  if v_before<>p_expected_quantity then raise sqlstate 'PT409' using message='STALE_STOCK_STATE'; end if;
  v_delta:=p_counted_quantity-v_before;
  if v_delta=0 then raise sqlstate 'PT422' using message='NO_STOCK_CHANGE'; end if;
  update public.inventory_stock_lots set remaining_quantity=p_counted_quantity,status=case when p_counted_quantity=0 then 'depleted' else status end where school_id=p_school_id and item_id=p_item_id and lot_id=p_lot_id;
  insert into public.inventory_stock_movements(school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason,created_at)
  values(p_school_id,p_item_id,p_lot_id,p_request_uuid,'ADJUST',v_delta,v_before,p_counted_quantity,v_actor,v_reason,v_processed_at) returning movement_id into v_movement_id;
  insert into public.inventory_audit(school_id,actor_user_id,action_type,target_type,target_id,request_id,reason,details,created_at)
  values(p_school_id,v_actor,'STOCK_ADJUSTED','inventory_lot',p_lot_id,p_request_uuid,v_reason,jsonb_build_object('item_id',p_item_id,'quantity_before',v_before,'quantity_after',p_counted_quantity,'movement_id',v_movement_id),v_processed_at);
  v_response:=jsonb_build_object('request_uuid',p_request_uuid,'operation','ADJUST','item_id',p_item_id,'lot_id',p_lot_id,'quantity_before',v_before,'quantity_after',p_counted_quantity,'quantity_delta',v_delta,'movement_id',v_movement_id,'server_processed_at',v_processed_at,'replayed',false);
  update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_processed_at where request_record_id=v_record_id;
  return v_response;
end;$function$;

create or replace function public.inventory_reverse_movement(
  p_school_id uuid, p_original_movement_id uuid, p_request_uuid uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid:=auth.uid(); v_reason text; v_payload jsonb; v_hash text; v_record_id uuid; v_existing record;
  v_original record; v_before bigint; v_after bigint; v_movement_id uuid; v_processed_at timestamptz:=clock_timestamp(); v_response jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED'; end if;
  if p_request_uuid is null then raise sqlstate 'PT422' using message='INVALID_REQUEST_UUID'; end if;
  v_reason:=inventory_private.inventory_validate_reason(p_reason);
  if not exists(select 1 from public.inventory_members m join public.inventory_schools s using(school_id)
    where m.school_id=p_school_id and m.user_id=v_actor and m.is_active and m.role='teacher_admin' and s.is_active)
  then raise sqlstate 'PT403' using message='PERMISSION_DENIED'; end if;
  v_payload:=jsonb_build_object('operation','REVERSAL','school_id',p_school_id,'original_movement_id',p_original_movement_id,'reason',v_reason);
  v_hash:=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.inventory_idempotency_requests(school_id,actor_user_id,operation,request_uuid,payload_hash,status)
  values(p_school_id,v_actor,'REVERSAL',p_request_uuid,v_hash,'PROCESSING') on conflict(school_id,actor_user_id,operation,request_uuid) do nothing returning request_record_id into v_record_id;
  if v_record_id is null then
    select * into v_existing from public.inventory_idempotency_requests where school_id=p_school_id and actor_user_id=v_actor and operation='REVERSAL' and request_uuid=p_request_uuid for update;
    if v_existing.payload_hash is distinct from v_hash then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status='COMPLETED' then return v_existing.response_payload||jsonb_build_object('replayed',true); end if;
    raise sqlstate 'PT409' using message='RETRYABLE_CONFLICT';
  end if;
  select * into v_original from public.inventory_stock_movements where school_id=p_school_id and movement_id=p_original_movement_id;
  if not found then raise sqlstate 'PT404' using message='MOVEMENT_NOT_FOUND'; end if;
  if v_original.movement_type not in ('RECEIVE','USE','DISPOSE','ADJUST') then raise sqlstate 'PT422' using message='MOVEMENT_NOT_REVERSIBLE'; end if;
  perform 1 from public.inventory_items where school_id=p_school_id and item_id=v_original.item_id for update;
  select remaining_quantity into v_before from public.inventory_stock_lots where school_id=p_school_id and item_id=v_original.item_id and lot_id=v_original.lot_id for update;
  if not found then raise sqlstate 'PT404' using message='LOT_NOT_FOUND'; end if;
  if exists(select 1 from public.inventory_stock_movements where school_id=p_school_id and related_movement_id=p_original_movement_id and movement_type='REVERSAL') then
    raise sqlstate 'PT409' using message='ALREADY_REVERSED';
  end if;
  if exists(select 1 from public.inventory_stock_movements m where m.school_id=p_school_id and m.lot_id=v_original.lot_id
    and (m.created_at,m.movement_id)>(v_original.created_at,v_original.movement_id)) then
    raise sqlstate 'PT409' using message='REVERSAL_NOT_SAFE', detail='Only the latest movement on a lot may be reversed.';
  end if;
  if v_before<>v_original.quantity_after then raise sqlstate 'PT409' using message='STALE_STOCK_STATE'; end if;
  v_after:=v_before-v_original.quantity_delta;
  if v_after<0 then raise sqlstate 'PT409' using message='REVERSAL_NEGATIVE_STOCK'; end if;
  update public.inventory_stock_lots set remaining_quantity=v_after,status=case when v_after=0 then 'depleted' else status end
  where school_id=p_school_id and item_id=v_original.item_id and lot_id=v_original.lot_id;
  insert into public.inventory_stock_movements(school_id,item_id,lot_id,request_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_user_id,reason,related_movement_id,created_at)
  values(p_school_id,v_original.item_id,v_original.lot_id,p_request_uuid,'REVERSAL',-v_original.quantity_delta,v_before,v_after,v_actor,v_reason,p_original_movement_id,v_processed_at)
  returning movement_id into v_movement_id;
  insert into public.inventory_audit(school_id,actor_user_id,action_type,target_type,target_id,request_id,reason,details,created_at)
  values(p_school_id,v_actor,'MOVEMENT_REVERSED','inventory_movement',p_original_movement_id,p_request_uuid,v_reason,
    jsonb_build_object('reversal_movement_id',v_movement_id,'original_type',v_original.movement_type,'lot_id',v_original.lot_id,'quantity_after',v_after),v_processed_at);
  v_response:=jsonb_build_object('request_uuid',p_request_uuid,'operation','REVERSAL','original_movement_id',p_original_movement_id,'reversal_movement_id',v_movement_id,'item_id',v_original.item_id,'lot_id',v_original.lot_id,'quantity_before',v_before,'quantity_after',v_after,'server_processed_at',v_processed_at,'replayed',false);
  update public.inventory_idempotency_requests set status='COMPLETED',response_payload=v_response,completed_at=v_processed_at where request_record_id=v_record_id;
  return v_response;
end;$function$;

revoke all on function public.inventory_receive_stock(uuid,uuid,bigint,numeric,timestamptz,date,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_dispose_stock(uuid,uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_adjust_stock(uuid,uuid,uuid,bigint,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_reverse_movement(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.inventory_receive_stock(uuid,uuid,bigint,numeric,timestamptz,date,uuid,uuid,text) to authenticated;
grant execute on function public.inventory_dispose_stock(uuid,uuid,uuid,bigint,uuid,text) to authenticated;
grant execute on function public.inventory_adjust_stock(uuid,uuid,uuid,bigint,bigint,uuid,text) to authenticated;
grant execute on function public.inventory_reverse_movement(uuid,uuid,uuid,text) to authenticated;
