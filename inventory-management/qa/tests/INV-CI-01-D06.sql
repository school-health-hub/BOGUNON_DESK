\set ON_ERROR_STOP on
-- Exact INV-D06 units: ordered 10 purchase units, ratio 1, receive 4 => stock +4.
begin;
insert into auth.users(id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role)
values('e6000000-0000-4000-8000-000000000001','inv-d06@example.invalid','',now(),now(),now(),'{}','{}','authenticated','authenticated');
insert into public.inventory_schools(school_id,display_name) values('e6100000-0000-4000-8000-000000000001','Synthetic INV-D06');
insert into public.inventory_members(school_id,user_id,role) values('e6100000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','teacher_admin');
insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit)
values('e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','Synthetic INV-D06 Item','piece','piece',1);
select set_config('request.jwt.claims','{"sub":"e6000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
set local role authenticated;
do $case$
declare school uuid:='e6100000-0000-4000-8000-000000000001'; batch uuid:='e6300000-0000-4000-8000-000000000001'; line uuid; response jsonb;
begin
  perform public.inventory_create_purchase_batch(school,batch,'e6900000-0000-4000-8000-000000000001',null,
    jsonb_build_array(jsonb_build_object('candidate_id','inv-d06','item_id','e6200000-0000-4000-8000-000000000001','requested_purchase_quantity',10,
      'base_unit','piece','purchase_unit','piece','base_units_per_purchase_unit',1,'specification_snapshot',null,'expected_unit_price',null,'currency',null)));
  perform public.inventory_set_purchase_batch_status(school,batch,'APPROVED','e6900000-0000-4000-8000-000000000002','Synthetic approve');
  perform public.inventory_set_purchase_batch_status(school,batch,'ORDERED','e6900000-0000-4000-8000-000000000003','Synthetic order');
  perform public.inventory_set_purchase_batch_status(school,batch,'AWAITING_RECEIPT','e6900000-0000-4000-8000-000000000004','Synthetic await');
  select line_id into strict line from public.inventory_purchase_lines where school_id=school and batch_id=batch;
  response:=public.inventory_confirm_receipt(school,batch,'e6400000-0000-4000-8000-000000000001','e6900000-0000-4000-8000-000000000005',now(),'Synthetic partial',
    jsonb_build_array(jsonb_build_object('line_id',line,'received_purchase_quantity',4,'expires_on',null)));
  if (response->>'status') is distinct from 'PARTIALLY_RECEIVED'
    or (select sum(remaining_quantity) from public.inventory_stock_lots where school_id=school) is distinct from 4
    or (select received_base_quantity from public.inventory_purchase_lines where line_id=line) is distinct from 4
    or (select count(*) from public.inventory_stock_movements where school_id=school and movement_type='RECEIVE' and quantity_delta=4) is distinct from 1
  then raise exception 'INV-D06 contract violation'; end if;
end;
$case$;
select 'SUMMARY|1|1|0';
rollback;
