create extension if not exists pgcrypto with schema extensions;

create or replace function public.inventory_use_stock(
  p_school_id uuid,
  p_item_id uuid,
  p_quantity bigint,
  p_request_uuid uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_reason text := btrim(p_reason);
  v_business_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  v_canonical_payload jsonb;
  v_payload_hash text;
  v_request_record_id uuid;
  v_existing_hash text;
  v_existing_status text;
  v_existing_response jsonb;
  v_item_active boolean;
  v_available_quantity bigint := 0;
  v_remaining_to_use bigint := p_quantity;
  v_take bigint;
  v_before bigint;
  v_after bigint;
  v_lot record;
  v_movement_id uuid;
  v_movement_ids jsonb := '[]'::jsonb;
  v_lot_deductions jsonb := '[]'::jsonb;
  v_available_after bigint;
  v_processed_at timestamptz;
  v_response jsonb;
begin
  if v_actor_user_id is null then
    raise sqlstate 'PT401' using
      message = 'UNAUTHENTICATED',
      detail = 'An authenticated session is required.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise sqlstate 'PT422' using
      message = 'INVALID_QUANTITY',
      detail = 'Quantity must be a positive integer in the item base unit.';
  end if;

  if p_request_uuid is null then
    raise sqlstate 'PT422' using
      message = 'INVALID_REQUEST_UUID',
      detail = 'A request UUID is required.';
  end if;

  if v_reason is null
    or v_reason = ''
    or char_length(v_reason) > 500
    or v_reason ~ '[[:cntrl:]]'
  then
    raise sqlstate 'PT422' using
      message = 'INVALID_REASON',
      detail = 'Reason must contain 1 to 500 printable characters.';
  end if;

  if not exists (
    select 1
    from public.inventory_members as member
    join public.inventory_schools as school
      on school.school_id = member.school_id
    where member.school_id = p_school_id
      and member.user_id = v_actor_user_id
      and member.is_active
      and member.role in ('teacher_admin', 'instructor')
      and school.is_active
  ) then
    raise sqlstate 'PT403' using
      message = 'PERMISSION_DENIED',
      detail = 'No active inventory membership permits this operation.';
  end if;

  v_canonical_payload := jsonb_build_object(
    'operation', 'USE',
    'school_id', p_school_id,
    'item_id', p_item_id,
    'quantity', p_quantity,
    'reason', v_reason
  );
  v_payload_hash := encode(
    extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.inventory_idempotency_requests (
    school_id,
    actor_user_id,
    operation,
    request_uuid,
    payload_hash,
    status
  )
  values (
    p_school_id,
    v_actor_user_id,
    'USE',
    p_request_uuid,
    v_payload_hash,
    'PROCESSING'
  )
  on conflict (school_id, actor_user_id, operation, request_uuid) do nothing
  returning request_record_id into v_request_record_id;

  if v_request_record_id is null then
    select
      request_record_id,
      payload_hash,
      status,
      response_payload
    into
      v_request_record_id,
      v_existing_hash,
      v_existing_status,
      v_existing_response
    from public.inventory_idempotency_requests
    where school_id = p_school_id
      and actor_user_id = v_actor_user_id
      and operation = 'USE'
      and request_uuid = p_request_uuid
    for update;

    if v_existing_hash is distinct from v_payload_hash then
      raise sqlstate 'PT409' using
        message = 'IDEMPOTENCY_CONFLICT',
        detail = 'The request UUID was already used with a different payload.';
    end if;

    if v_existing_status = 'COMPLETED' and v_existing_response is not null then
      return v_existing_response || jsonb_build_object('replayed', true);
    end if;

    raise sqlstate 'PT409' using
      message = 'RETRYABLE_CONFLICT',
      detail = 'The matching request is not yet complete.';
  end if;

  select item.is_active
  into v_item_active
  from public.inventory_items as item
  where item.school_id = p_school_id
    and item.item_id = p_item_id
  for update;

  if not found then
    raise sqlstate 'PT404' using
      message = 'ITEM_NOT_FOUND',
      detail = 'The requested item is unavailable in this school.';
  end if;

  if not v_item_active then
    raise sqlstate 'PT422' using
      message = 'ITEM_INACTIVE',
      detail = 'The requested item is inactive.';
  end if;

  for v_lot in
    select lot.lot_id, lot.remaining_quantity
    from public.inventory_stock_lots as lot
    where lot.school_id = p_school_id
      and lot.item_id = p_item_id
      and lot.status = 'available'
      and lot.remaining_quantity > 0
      and (lot.expires_on is null or lot.expires_on >= v_business_date)
    order by lot.expires_on asc nulls last, lot.received_at asc, lot.lot_id asc
    for update
  loop
    v_available_quantity := v_available_quantity + v_lot.remaining_quantity;
  end loop;

  if v_available_quantity < p_quantity then
    raise sqlstate 'PT409' using
      message = 'INSUFFICIENT_STOCK',
      detail = 'Available stock is lower than the requested quantity.';
  end if;

  v_processed_at := clock_timestamp();

  for v_lot in
    select lot.lot_id, lot.remaining_quantity
    from public.inventory_stock_lots as lot
    where lot.school_id = p_school_id
      and lot.item_id = p_item_id
      and lot.status = 'available'
      and lot.remaining_quantity > 0
      and (lot.expires_on is null or lot.expires_on >= v_business_date)
    order by lot.expires_on asc nulls last, lot.received_at asc, lot.lot_id asc
    for update
  loop
    exit when v_remaining_to_use = 0;

    v_before := v_lot.remaining_quantity;
    v_take := least(v_before, v_remaining_to_use);
    v_after := v_before - v_take;

    update public.inventory_stock_lots
    set
      remaining_quantity = v_after,
      status = case when v_after = 0 then 'depleted' else status end
    where school_id = p_school_id
      and item_id = p_item_id
      and lot_id = v_lot.lot_id;

    insert into public.inventory_stock_movements (
      school_id,
      item_id,
      lot_id,
      request_id,
      movement_type,
      quantity_delta,
      quantity_before,
      quantity_after,
      actor_user_id,
      reason,
      created_at
    )
    values (
      p_school_id,
      p_item_id,
      v_lot.lot_id,
      p_request_uuid,
      'USE',
      -v_take,
      v_before,
      v_after,
      v_actor_user_id,
      v_reason,
      v_processed_at
    )
    returning movement_id into v_movement_id;

    v_movement_ids := v_movement_ids || jsonb_build_array(v_movement_id);
    v_lot_deductions := v_lot_deductions || jsonb_build_array(
      jsonb_build_object(
        'lot_id', v_lot.lot_id,
        'quantity_before', v_before,
        'quantity_used', v_take,
        'quantity_after', v_after,
        'movement_id', v_movement_id
      )
    );
    v_remaining_to_use := v_remaining_to_use - v_take;
  end loop;

  select coalesce(sum(lot.remaining_quantity), 0)::bigint
  into v_available_after
  from public.inventory_stock_lots as lot
  where lot.school_id = p_school_id
    and lot.item_id = p_item_id
    and lot.status = 'available'
    and lot.remaining_quantity > 0
    and (lot.expires_on is null or lot.expires_on >= v_business_date);

  insert into public.inventory_audit (
    school_id,
    actor_user_id,
    action_type,
    target_type,
    target_id,
    request_id,
    reason,
    details,
    created_at
  )
  values (
    p_school_id,
    v_actor_user_id,
    'STOCK_USED',
    'inventory_item',
    p_item_id,
    p_request_uuid,
    v_reason,
    jsonb_build_object(
      'quantity', p_quantity,
      'lot_count', jsonb_array_length(v_lot_deductions),
      'movement_ids', v_movement_ids
    ),
    v_processed_at
  );

  v_response := jsonb_build_object(
    'request_uuid', p_request_uuid,
    'operation', 'USE',
    'item_id', p_item_id,
    'requested_quantity', p_quantity,
    'deducted_quantity', p_quantity,
    'available_stock_after', v_available_after,
    'lot_deductions', v_lot_deductions,
    'movement_ids', v_movement_ids,
    'server_processed_at', v_processed_at,
    'replayed', false
  );

  update public.inventory_idempotency_requests
  set
    status = 'COMPLETED',
    response_payload = v_response,
    completed_at = v_processed_at
  where request_record_id = v_request_record_id;

  return v_response;
end;
$function$;

revoke all on function public.inventory_use_stock(uuid, uuid, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.inventory_use_stock(uuid, uuid, bigint, uuid, text)
  to authenticated;
