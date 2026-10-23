create or replace function inventory_private.inventory_normalize_rpc_response(
  p_response jsonb,
  p_school_id uuid,
  p_item_id uuid,
  p_request_uuid uuid,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_total bigint;
  v_available bigint;
  v_delta bigint;
  v_movements jsonb;
  v_reactivation_required boolean := false;
  v_business_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  v_result jsonb;
begin
  -- A replay must return the exact authoritative snapshot persisted by the
  -- first successful execution, rather than recomputing totals later.
  if coalesce((p_response->>'replayed')::boolean,false)
     and p_response ? 'item_total_quantity' then
    return p_response || jsonb_build_object('status','replayed','replayed',true);
  end if;
  select coalesce(sum(remaining_quantity),0)::bigint,
         coalesce(sum(remaining_quantity) filter(where status='available' and (expires_on is null or expires_on>=v_business_date)),0)::bigint
  into v_total,v_available
  from public.inventory_stock_lots where school_id=p_school_id and item_id=p_item_id;

  select coalesce(sum(quantity_delta),0)::bigint,
         coalesce(jsonb_agg(jsonb_build_object(
           'movement_id',movement_id,'lot_id',lot_id,'movement_type',movement_type,
           'quantity_delta',quantity_delta,'quantity_before',quantity_before,'quantity_after',quantity_after
         ) order by created_at,movement_id),'[]'::jsonb)
  into v_delta,v_movements
  from public.inventory_stock_movements
  where school_id=p_school_id and item_id=p_item_id and request_id=p_request_uuid and actor_user_id=v_actor;

  if p_operation='REVERSAL' then
    select exists(
      select 1 from public.inventory_stock_movements m
      join public.inventory_stock_lots l on l.school_id=m.school_id and l.item_id=m.item_id and l.lot_id=m.lot_id
      where m.school_id=p_school_id and m.request_id=p_request_uuid and m.actor_user_id=v_actor
        and m.movement_type='REVERSAL' and l.remaining_quantity>0 and l.status='depleted'
    ) into v_reactivation_required;
  end if;

  v_result := p_response || jsonb_build_object(
    'status',case when coalesce((p_response->>'replayed')::boolean,false) then 'replayed' else 'applied' end,
    'request_uuid',p_request_uuid,'operation',p_operation,'school_id',p_school_id,'item_id',p_item_id,
    'quantity_delta',v_delta,'item_total_quantity',v_total,'item_available_quantity',v_available,
    'movements',v_movements,'processed_at',p_response->'server_processed_at',
    'reactivation_required',v_reactivation_required
  );

  update public.inventory_idempotency_requests
  set response_payload = v_result
  where school_id = p_school_id
    and actor_user_id = v_actor
    and operation = p_operation
    and request_uuid = p_request_uuid
    and status = 'COMPLETED';

  return v_result;
end;
$function$;

revoke all on function inventory_private.inventory_normalize_rpc_response(jsonb,uuid,uuid,uuid,text) from public,anon,authenticated;

alter function public.inventory_use_stock(uuid,uuid,bigint,uuid,text) rename to inventory_use_stock_core;
alter function public.inventory_receive_stock(uuid,uuid,bigint,numeric,timestamptz,date,uuid,uuid,text) rename to inventory_receive_stock_core;
alter function public.inventory_dispose_stock(uuid,uuid,uuid,bigint,uuid,text) rename to inventory_dispose_stock_core;
alter function public.inventory_adjust_stock(uuid,uuid,uuid,bigint,bigint,uuid,text) rename to inventory_adjust_stock_core;
alter function public.inventory_reverse_movement(uuid,uuid,uuid,text) rename to inventory_reverse_movement_core;

create function public.inventory_use_stock(p_school_id uuid,p_item_id uuid,p_quantity bigint,p_request_uuid uuid,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
  select inventory_private.inventory_normalize_rpc_response(public.inventory_use_stock_core(p_school_id,p_item_id,p_quantity,p_request_uuid,p_reason),p_school_id,p_item_id,p_request_uuid,'USE');
$$;
create function public.inventory_receive_stock(p_school_id uuid,p_item_id uuid,p_purchase_quantity bigint,p_base_units_per_purchase_unit numeric,p_received_at timestamptz,p_expires_on date,p_purchase_link_id uuid,p_request_uuid uuid,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
  select inventory_private.inventory_normalize_rpc_response(public.inventory_receive_stock_core(p_school_id,p_item_id,p_purchase_quantity,p_base_units_per_purchase_unit,p_received_at,p_expires_on,p_purchase_link_id,p_request_uuid,p_reason),p_school_id,p_item_id,p_request_uuid,'RECEIVE');
$$;
create function public.inventory_dispose_stock(p_school_id uuid,p_item_id uuid,p_lot_id uuid,p_quantity bigint,p_request_uuid uuid,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
  select inventory_private.inventory_normalize_rpc_response(public.inventory_dispose_stock_core(p_school_id,p_item_id,p_lot_id,p_quantity,p_request_uuid,p_reason),p_school_id,p_item_id,p_request_uuid,'DISPOSE');
$$;
create function public.inventory_adjust_stock(p_school_id uuid,p_item_id uuid,p_lot_id uuid,p_expected_quantity bigint,p_counted_quantity bigint,p_request_uuid uuid,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
  select inventory_private.inventory_normalize_rpc_response(public.inventory_adjust_stock_core(p_school_id,p_item_id,p_lot_id,p_expected_quantity,p_counted_quantity,p_request_uuid,p_reason),p_school_id,p_item_id,p_request_uuid,'ADJUST');
$$;
create function public.inventory_reverse_movement(p_school_id uuid,p_original_movement_id uuid,p_request_uuid uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_response jsonb; v_item_id uuid;
begin
  v_response:=public.inventory_reverse_movement_core(p_school_id,p_original_movement_id,p_request_uuid,p_reason);
  v_item_id:=(v_response->>'item_id')::uuid;
  return inventory_private.inventory_normalize_rpc_response(v_response,p_school_id,v_item_id,p_request_uuid,'REVERSAL');
end;$$;

revoke all on function public.inventory_use_stock_core(uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_receive_stock_core(uuid,uuid,bigint,numeric,timestamptz,date,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_dispose_stock_core(uuid,uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_adjust_stock_core(uuid,uuid,uuid,bigint,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_reverse_movement_core(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_use_stock(uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_receive_stock(uuid,uuid,bigint,numeric,timestamptz,date,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_dispose_stock(uuid,uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_adjust_stock(uuid,uuid,uuid,bigint,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.inventory_reverse_movement(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.inventory_use_stock(uuid,uuid,bigint,uuid,text) to authenticated;
grant execute on function public.inventory_receive_stock(uuid,uuid,bigint,numeric,timestamptz,date,uuid,uuid,text) to authenticated;
grant execute on function public.inventory_dispose_stock(uuid,uuid,uuid,bigint,uuid,text) to authenticated;
grant execute on function public.inventory_adjust_stock(uuid,uuid,uuid,bigint,bigint,uuid,text) to authenticated;
grant execute on function public.inventory_reverse_movement(uuid,uuid,uuid,text) to authenticated;
