begin;

create temporary table qa_results(test_id text primary key, status text not null, detail text not null);
grant select, insert on table qa_results to authenticated;

create or replace function pg_temp.record_result(p_id text, p_ok boolean, p_detail text)
returns void language sql as $$
  insert into qa_results values (p_id, case when p_ok then 'PASS' else 'FAIL' end, p_detail);
$$;
grant execute on function pg_temp.record_result(text, boolean, text) to authenticated;

insert into auth.users(id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role)
values
('a4000000-0000-4000-8000-000000000001','teacher-im1b4@example.invalid','',now(),now(),now(),'{}','{}','authenticated','authenticated'),
('a4000000-0000-4000-8000-000000000002','instructor-im1b4@example.invalid','',now(),now(),now(),'{}','{"role":"teacher_admin"}','authenticated','authenticated'),
('a4000000-0000-4000-8000-000000000003','other-im1b4@example.invalid','',now(),now(),now(),'{}','{}','authenticated','authenticated');

insert into public.inventory_schools(school_id,display_name) values
('a4100000-0000-4000-8000-000000000001','Synthetic School A'),
('a4100000-0000-4000-8000-000000000002','Synthetic School B');
insert into public.inventory_members(school_id,user_id,role) values
('a4100000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','teacher_admin'),
('a4100000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','instructor'),
('a4100000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000003','teacher_admin');
insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit) values
('a4200000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','Synthetic Gauze','piece','box',10),
('a4200000-0000-4000-8000-000000000002','a4100000-0000-4000-8000-000000000002','Synthetic Other','piece','box',5);
insert into public.inventory_stock_lots(lot_id,school_id,item_id,received_at,expires_on,initial_quantity,remaining_quantity,status) values
('a4300000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001', 'a4200000-0000-4000-8000-000000000001',now()-interval '1 year',current_date-1,10,10,'available'),
('a4300000-0000-4000-8000-000000000002','a4100000-0000-4000-8000-000000000001', 'a4200000-0000-4000-8000-000000000001',now()-interval '1 month',current_date+30,10,10,'quarantined'),
('a4300000-0000-4000-8000-000000000003','a4100000-0000-4000-8000-000000000001', 'a4200000-0000-4000-8000-000000000001',now(),current_date+90,10,10,'available');

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
set role authenticated;

do $test$
declare r jsonb; lot uuid; movement uuid; before_count bigint;
begin
  r:=public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',2,10,now(),current_date+365,null,'a4900000-0000-4000-8000-000000000001','Synthetic receipt');
  lot:=(r->>'lot_id')::uuid; movement:=(r->>'movement_id')::uuid;
  perform pg_temp.record_result('B4-RECEIVE-01',(r->>'received_base_quantity')::bigint=20 and exists(select 1 from public.inventory_stock_lots where lot_id=lot and remaining_quantity=20),'normal receipt creates lot and movement');
  before_count:=(select count(*) from public.inventory_stock_movements where request_id='a4900000-0000-4000-8000-000000000001');
  r:=public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',2,10,now(),current_date+365,null,'a4900000-0000-4000-8000-000000000001','Synthetic receipt');
  perform pg_temp.record_result('B4-RECEIVE-02',(r->>'replayed')::boolean and before_count=(select count(*) from public.inventory_stock_movements where request_id='a4900000-0000-4000-8000-000000000001'),'receipt replay has no duplicate movement');
  begin
    perform public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',3,10,now(),current_date+365,null,'a4900000-0000-4000-8000-000000000001','Synthetic receipt');
    perform pg_temp.record_result('B4-RECEIVE-03',false,'conflicting payload accepted');
  exception when sqlstate 'PT409' then perform pg_temp.record_result('B4-RECEIVE-03',sqlerrm='IDEMPOTENCY_CONFLICT','conflicting payload rejected'); end;
  begin
    perform public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',1,3.5,now(),null,null,'a4900000-0000-4000-8000-000000000002','Synthetic bad conversion');
    perform pg_temp.record_result('B4-RECEIVE-04',false,'mismatched conversion accepted');
  exception when sqlstate 'PT422' then perform pg_temp.record_result('B4-RECEIVE-04',sqlerrm in ('INEXACT_UNIT_CONVERSION','UNIT_CONVERSION_MISMATCH'),'unit conversion rejected'); end;
  begin
    perform public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',1,10,now(),null,'a4990000-0000-4000-8000-000000000001','a4900000-0000-4000-8000-000000000003','Synthetic purchase link');
    perform pg_temp.record_result('B4-RECEIVE-05',false,'purchase link accepted');
  exception when sqlstate 'PT422' then perform pg_temp.record_result('B4-RECEIVE-05',sqlerrm='PURCHASE_LINK_NOT_SUPPORTED','untrusted purchase link rejected'); end;

  r:=public.inventory_dispose_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000001',3,'a4900000-0000-4000-8000-000000000010','Synthetic expired disposal');
  perform pg_temp.record_result('B4-DISPOSE-01',(r->>'quantity_after')::bigint=7,'expired lot disposal works');
  r:=public.inventory_dispose_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000002',4,'a4900000-0000-4000-8000-000000000011','Synthetic quarantined disposal');
  perform pg_temp.record_result('B4-DISPOSE-02',(r->>'quantity_after')::bigint=6,'quarantined lot disposal works');
  begin
    perform public.inventory_dispose_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000002',7,'a4900000-0000-4000-8000-000000000012','Synthetic excessive disposal');
    perform pg_temp.record_result('B4-DISPOSE-03',false,'excess disposal accepted');
  exception when sqlstate 'PT409' then perform pg_temp.record_result('B4-DISPOSE-03',sqlerrm='INSUFFICIENT_STOCK','excess disposal rejected'); end;

  r:=public.inventory_adjust_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000003',10,13,'a4900000-0000-4000-8000-000000000020','Synthetic count increase');
  perform pg_temp.record_result('B4-ADJUST-01',(r->>'quantity_delta')::bigint=3,'increase adjustment');
  r:=public.inventory_adjust_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000003',13,8,'a4900000-0000-4000-8000-000000000021','Synthetic count decrease');
  movement:=(r->>'movement_id')::uuid;
  perform pg_temp.record_result('B4-ADJUST-02',(r->>'quantity_delta')::bigint=-5,'decrease adjustment');
  begin
    perform public.inventory_adjust_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000003',13,9,'a4900000-0000-4000-8000-000000000022','Synthetic stale count');
    perform pg_temp.record_result('B4-ADJUST-03',false,'stale adjustment accepted');
  exception when sqlstate 'PT409' then perform pg_temp.record_result('B4-ADJUST-03',sqlerrm='STALE_STOCK_STATE','stale adjustment rejected'); end;
  begin
    perform public.inventory_adjust_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000003',8,-1,'a4900000-0000-4000-8000-000000000023','Synthetic invalid count');
    perform pg_temp.record_result('B4-ADJUST-04',false,'negative count accepted');
  exception when sqlstate 'PT422' then perform pg_temp.record_result('B4-ADJUST-04',sqlerrm='INVALID_QUANTITY','negative count rejected'); end;

  r:=public.inventory_reverse_movement('a4100000-0000-4000-8000-000000000001',movement,'a4900000-0000-4000-8000-000000000030','Synthetic adjustment reversal');
  perform pg_temp.record_result('B4-REVERSE-01',(r->>'quantity_after')::bigint=13 and exists(select 1 from public.inventory_stock_movements where related_movement_id=movement),'adjustment reversed with linked movement');
  begin
    perform public.inventory_reverse_movement('a4100000-0000-4000-8000-000000000001',movement,'a4900000-0000-4000-8000-000000000031','Synthetic duplicate reversal');
    perform pg_temp.record_result('B4-REVERSE-02',false,'duplicate reversal accepted');
  exception when sqlstate 'PT409' then perform pg_temp.record_result('B4-REVERSE-02',sqlerrm='ALREADY_REVERSED','duplicate reversal rejected'); end;

  r:=public.inventory_dispose_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000002',2,'a4900000-0000-4000-8000-000000000040','Synthetic disposal for reversal');
  movement:=(r->>'movement_id')::uuid;
  r:=public.inventory_reverse_movement('a4100000-0000-4000-8000-000000000001',movement,'a4900000-0000-4000-8000-000000000041','Synthetic disposal reversal');
  perform pg_temp.record_result('B4-REVERSE-03',(r->>'quantity_after')::bigint=6 and (select status='quarantined' from public.inventory_stock_lots where lot_id='a4300000-0000-4000-8000-000000000002'),'disposal reversal preserves quarantine');

  r:=public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',1,10,now(),null,null,'a4900000-0000-4000-8000-000000000050','Synthetic reversible receipt');
  movement:=(r->>'movement_id')::uuid; lot:=(r->>'lot_id')::uuid;
  r:=public.inventory_reverse_movement('a4100000-0000-4000-8000-000000000001',movement,'a4900000-0000-4000-8000-000000000051','Synthetic receipt reversal');
  perform pg_temp.record_result('B4-REVERSE-04',(r->>'quantity_after')::bigint=0 and (select status='depleted' from public.inventory_stock_lots where lot_id=lot),'untouched receipt reversed to zero');

  r:=public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',1,10,now(),null,null,'a4900000-0000-4000-8000-000000000060','Synthetic unsafe receipt');
  movement:=(r->>'movement_id')::uuid; lot:=(r->>'lot_id')::uuid;
  perform public.inventory_dispose_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',lot,1,'a4900000-0000-4000-8000-000000000061','Synthetic later change');
  begin
    perform public.inventory_reverse_movement('a4100000-0000-4000-8000-000000000001',movement,'a4900000-0000-4000-8000-000000000062','Synthetic unsafe reversal');
    perform pg_temp.record_result('B4-REVERSE-05',false,'non-latest movement reversed');
  exception when sqlstate 'PT409' then perform pg_temp.record_result('B4-REVERSE-05',sqlerrm='REVERSAL_NOT_SAFE','non-latest reversal rejected'); end;
end;$test$;

reset role;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}',false);
set role authenticated;
do $test$
begin
  begin
    perform public.inventory_receive_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',1,10,now(),null,null,'a4900000-0000-4000-8000-000000000070','Synthetic instructor receipt');
    perform pg_temp.record_result('B4-SECURITY-01',false,'instructor receipt accepted');
  exception when sqlstate 'PT403' then perform pg_temp.record_result('B4-SECURITY-01',sqlerrm='PERMISSION_DENIED','instructor admin RPC rejected'); end;
  begin
    perform public.inventory_dispose_stock('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000003',1,'a4900000-0000-4000-8000-000000000071','Synthetic forged metadata');
    perform pg_temp.record_result('B4-SECURITY-02',false,'forged metadata elevated role');
  exception when sqlstate 'PT403' then perform pg_temp.record_result('B4-SECURITY-02',sqlerrm='PERMISSION_DENIED','user metadata ignored'); end;
end;$test$;

reset role;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
set role authenticated;
do $test$
begin
  begin
    perform public.inventory_adjust_stock('a4100000-0000-4000-8000-000000000002','a4200000-0000-4000-8000-000000000002','a4300000-0000-4000-8000-000000000003',1,2,'a4900000-0000-4000-8000-000000000080','Synthetic cross tenant');
    perform pg_temp.record_result('B4-SECURITY-03',false,'cross tenant operation accepted');
  exception when sqlstate 'PT403' then perform pg_temp.record_result('B4-SECURITY-03',sqlerrm='PERMISSION_DENIED','cross tenant operation rejected without disclosure'); end;
end;$test$;

reset role;
select 'TEST|'||test_id||'|'||status||'|'||detail from qa_results order by test_id;
select 'SUMMARY|'||count(*)||'|'||count(*) filter(where status='PASS')||'|'||count(*) filter(where status='FAIL') from qa_results;
rollback;
