begin;
create temporary table qa_results(test_id text primary key,status text,detail text);
grant select,insert on qa_results to authenticated;
create temporary table qa_probe_movement(movement_id uuid primary key);
grant select,insert on qa_probe_movement to authenticated;
create or replace function pg_temp.ok(id text,passed boolean,detail text) returns void language sql as $$insert into qa_results values(id,case when passed then 'PASS' else 'FAIL' end,detail)$$;
grant execute on function pg_temp.ok(text,boolean,text) to authenticated;
create or replace function pg_temp.count_idempotency() returns bigint language sql security definer set search_path='' as $$select count(*) from public.inventory_idempotency_requests$$;
grant execute on function pg_temp.count_idempotency() to authenticated;

insert into auth.users(id,email,encrypted_password,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role) values
('b5000000-0000-4000-8000-000000000001','teacher-b5@example.invalid','',now(),now(),'{}','{}','authenticated','authenticated'),
('b5000000-0000-4000-8000-000000000002','instructor-b5@example.invalid','',now(),now(),'{}','{}','authenticated','authenticated'),
('b5000000-0000-4000-8000-000000000003','inactive-b5@example.invalid','',now(),now(),'{}','{}','authenticated','authenticated'),
('b5000000-0000-4000-8000-000000000004','nonmember-b5@example.invalid','',now(),now(),'{}','{}','authenticated','authenticated');
insert into public.inventory_schools(school_id,display_name) values('b5100000-0000-4000-8000-000000000001','Synthetic Purchase School');
insert into public.inventory_members(school_id,user_id,role,is_active) values
('b5100000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','teacher_admin',true),
('b5100000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000002','instructor',true),
('b5100000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000003','teacher_admin',false);
insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit) values
('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-000000000001','Synthetic Purchase Item','piece','box',10),
('b5200000-0000-4000-8000-000000000002','b5100000-0000-4000-8000-000000000001','Synthetic Purchase Item 2','piece','pack',5);

select set_config('request.jwt.claims','{"sub":"b5000000-0000-4000-8000-000000000001","role":"authenticated"}',false); set role authenticated;
do $t$ declare r jsonb; before_lots bigint; begin
 select count(*) into before_lots from public.inventory_stock_lots;
 r:=public.inventory_create_purchase_batch('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5900000-0000-4000-8000-000000000001','Synthetic batch',jsonb_build_array(
 jsonb_build_object('candidate_id','candidate-a','item_id','b5200000-0000-4000-8000-000000000001','requested_purchase_quantity',10,'base_unit','piece','purchase_unit','box','base_units_per_purchase_unit',10,'specification_snapshot','synthetic','expected_unit_price',1000,'currency','KRW'),
 jsonb_build_object('candidate_id','candidate-b','item_id','b5200000-0000-4000-8000-000000000002','requested_purchase_quantity',2,'base_unit','piece','purchase_unit','pack','base_units_per_purchase_unit',5,'specification_snapshot','synthetic','expected_unit_price',500,'currency','KRW')));
 perform pg_temp.ok('B5-01',(r->>'line_count')::int=2 and before_lots=(select count(*) from public.inventory_stock_lots),'batch creation stores two lines and leaves stock unchanged');
 perform public.inventory_set_purchase_batch_status('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','APPROVED','b5900000-0000-4000-8000-000000000002','approve');
 perform public.inventory_set_purchase_batch_status('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','ORDERED','b5900000-0000-4000-8000-000000000003','order');
 perform public.inventory_set_purchase_batch_status('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','AWAITING_RECEIPT','b5900000-0000-4000-8000-000000000004','await receipt');
 perform pg_temp.ok('B5-02',(select status='AWAITING_RECEIPT' from public.inventory_purchase_batches where batch_id='b5300000-0000-4000-8000-000000000001') and before_lots=(select count(*) from public.inventory_stock_lots),'status transitions remain stock neutral');
end;$t$;

do $t$ declare l1 uuid; r jsonb; movement_count bigint; begin
 select line_id into l1 from public.inventory_purchase_lines where candidate_id='candidate-a';
 r:=public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000001','b5900000-0000-4000-8000-000000000010',now(),'partial one',jsonb_build_array(jsonb_build_object('line_id',l1,'received_purchase_quantity',4,'expires_on',(current_date+365)::text)));
 perform pg_temp.ok('B5-03',(select received_base_quantity=40 from public.inventory_purchase_lines where line_id=l1) and r->>'status'='PARTIALLY_RECEIVED','first partial receipt adds 40 base units');
 select count(*) into movement_count from public.inventory_stock_movements where request_id='b5900000-0000-4000-8000-000000000010';
 r:=public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000001','b5900000-0000-4000-8000-000000000010',now(),'partial one',jsonb_build_array(jsonb_build_object('line_id',l1,'received_purchase_quantity',4,'expires_on',(current_date+365)::text)));
 perform pg_temp.ok('B5-04',(r->>'replayed')::boolean and movement_count=(select count(*) from public.inventory_stock_movements where request_id='b5900000-0000-4000-8000-000000000010'),'same UUID replays without duplicate stock');
 begin perform public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000001','b5900000-0000-4000-8000-000000000011',now(),'duplicate identity',jsonb_build_array(jsonb_build_object('line_id',l1,'received_purchase_quantity',4,'expires_on',(current_date+365)::text))); perform pg_temp.ok('B5-05',false,'duplicate receipt accepted'); exception when sqlstate 'PT409' then perform pg_temp.ok('B5-05',sqlerrm='DUPLICATE_RECEIPT','stable receipt identity blocks different request UUID'); end;
 begin perform public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000002','b5900000-0000-4000-8000-000000000012',now(),'over receipt',jsonb_build_array(jsonb_build_object('line_id',l1,'received_purchase_quantity',7,'expires_on',(current_date+365)::text))); perform pg_temp.ok('B5-06',false,'over receipt accepted'); exception when sqlstate 'PT409' then perform pg_temp.ok('B5-06',sqlerrm='PURCHASE_RECEIPT_EXCEEDS_REQUESTED','cumulative over receipt rejected'); end;
 perform pg_temp.ok('B5-07',not exists(select 1 from public.inventory_purchase_receipts where receipt_id='b5400000-0000-4000-8000-000000000002'),'failed receipt rolls back receipt reservation');
end;$t$;

do $t$ declare l1 uuid; r jsonb; original uuid; begin
 select line_id into l1 from public.inventory_purchase_lines where candidate_id='candidate-a';
 r:=public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000003','b5900000-0000-4000-8000-000000000013',now(),'partial two',jsonb_build_array(jsonb_build_object('line_id',l1,'received_purchase_quantity',3,'expires_on',(current_date+365)::text)));
 perform pg_temp.ok('B5-08',(select received_base_quantity=70 from public.inventory_purchase_lines where line_id=l1),'two partial receipts accumulate to 70');
 perform public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000005','b5900000-0000-4000-8000-000000000016',now(),'partial three',jsonb_build_array(jsonb_build_object('line_id',l1,'received_purchase_quantity',3,'expires_on',(current_date+365)::text)));
 perform pg_temp.ok('B5-09',(select received_base_quantity=100 from public.inventory_purchase_lines where line_id=l1) and (select count(*)=3 from public.inventory_purchase_receipt_lines where line_id=l1),'4 plus 3 plus 3 reaches requested total without duplicates');
 select movement_id into original from public.inventory_purchase_receipt_lines where receipt_id='b5400000-0000-4000-8000-000000000003';
 insert into qa_probe_movement values(original);
 begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001',original,'b5900000-0000-4000-8000-000000000014','reverse purchase'); perform pg_temp.ok('B5-10',false,'purchase receipt reversal accepted'); exception when sqlstate 'PT422' then perform pg_temp.ok('B5-10',sqlerrm='PURCHASE_RECEIPT_REVERSAL_REQUIRES_POLICY','purchase reversal blocked pending policy'); end;
end;$t$;

do $t$ declare first_line uuid; second_line uuid; before_lots bigint; before_moves bigint; before_audits bigint; before_idem bigint; before_received bigint; begin
 perform public.inventory_create_purchase_batch('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000002','b5900000-0000-4000-8000-000000000020','rollback batch',jsonb_build_array(
 jsonb_build_object('candidate_id','rollback-a','item_id','b5200000-0000-4000-8000-000000000001','requested_purchase_quantity',2,'base_unit','piece','purchase_unit','box','base_units_per_purchase_unit',10,'specification_snapshot','synthetic','expected_unit_price',null,'currency',null),
 jsonb_build_object('candidate_id','rollback-b','item_id','b5200000-0000-4000-8000-000000000002','requested_purchase_quantity',2,'base_unit','piece','purchase_unit','pack','base_units_per_purchase_unit',5,'specification_snapshot','synthetic','expected_unit_price',null,'currency',null)));
 perform public.inventory_set_purchase_batch_status('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000002','APPROVED','b5900000-0000-4000-8000-000000000021','approve rollback');
 perform public.inventory_set_purchase_batch_status('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000002','ORDERED','b5900000-0000-4000-8000-000000000022','order rollback');
 perform public.inventory_set_purchase_batch_status('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000002','AWAITING_RECEIPT','b5900000-0000-4000-8000-000000000023','await rollback');
 select lines[1],lines[2] into first_line,second_line from (select array_agg(line_id order by line_id) lines from public.inventory_purchase_lines where batch_id='b5300000-0000-4000-8000-000000000002') ordered;
 select count(*) into before_lots from public.inventory_stock_lots; select count(*) into before_moves from public.inventory_stock_movements; select count(*) into before_audits from public.inventory_audit; before_idem:=pg_temp.count_idempotency(); select sum(received_base_quantity) into before_received from public.inventory_purchase_lines where batch_id='b5300000-0000-4000-8000-000000000002';
 begin
   perform public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000002','b5400000-0000-4000-8000-000000000020','b5900000-0000-4000-8000-000000000024',now(),'late failure rollback',jsonb_build_array(
     jsonb_build_object('line_id',first_line,'received_purchase_quantity',1,'expires_on',(current_date+365)::text),
     jsonb_build_object('line_id',second_line,'received_purchase_quantity',99,'expires_on',(current_date+365)::text)));
   perform pg_temp.ok('B5-11',false,'late second-line failure committed');
 exception when sqlstate 'PT409' then
   perform pg_temp.ok('B5-11',sqlerrm='PURCHASE_RECEIPT_EXCEEDS_REQUESTED'
     and before_lots=(select count(*) from public.inventory_stock_lots)
     and before_moves=(select count(*) from public.inventory_stock_movements)
     and before_audits=(select count(*) from public.inventory_audit)
     and before_idem=pg_temp.count_idempotency()
     and before_received=(select sum(received_base_quantity) from public.inventory_purchase_lines where batch_id='b5300000-0000-4000-8000-000000000002')
     and not exists(select 1 from public.inventory_purchase_receipts where receipt_id='b5400000-0000-4000-8000-000000000020'),
     'second-line failure rolls back first-line lot, movement, audit, idempotency, cumulative, and receipt');
 end;
end;$t$;

reset role; select set_config('request.jwt.claims','{"sub":"b5000000-0000-4000-8000-000000000002","role":"authenticated"}',false); set role authenticated;
do $t$ begin begin perform public.inventory_confirm_receipt('b5100000-0000-4000-8000-000000000001','b5300000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000004','b5900000-0000-4000-8000-000000000015',now(),'instructor denied','[]'); perform pg_temp.ok('B5-12',false,'instructor accepted'); exception when sqlstate 'PT422' then perform pg_temp.ok('B5-12',true,'invalid payload rejected before authorization'); when sqlstate 'PT403' then perform pg_temp.ok('B5-12',true,'instructor denied'); end; end;$t$;
do $t$ declare linked uuid:=(select movement_id from qa_probe_movement limit 1); linked_error text; random_error text; begin begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001',linked,'b5900000-0000-4000-8000-000000000030','probe'); exception when others then linked_error:=sqlstate||':'||sqlerrm; end; begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','b5900000-0000-4000-8000-000000000031','probe'); exception when others then random_error:=sqlstate||':'||sqlerrm; end; perform pg_temp.ok('B5-13',linked_error='PT403:PERMISSION_DENIED' and random_error=linked_error,'instructor receives identical non-disclosing denial for linked and random movement'); end;$t$;
reset role; select set_config('request.jwt.claims','{"sub":"b5000000-0000-4000-8000-000000000003","role":"authenticated"}',false); set role authenticated;
do $t$ declare linked uuid:=(select movement_id from qa_probe_movement limit 1); linked_error text; random_error text; begin begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001',linked,'b5900000-0000-4000-8000-000000000032','probe'); exception when others then linked_error:=sqlstate||':'||sqlerrm; end; begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','b5900000-0000-4000-8000-000000000033','probe'); exception when others then random_error:=sqlstate||':'||sqlerrm; end; perform pg_temp.ok('B5-14',linked_error='PT403:PERMISSION_DENIED' and random_error=linked_error,'inactive teacher receives identical non-disclosing denial'); end;$t$;
reset role; select set_config('request.jwt.claims','{"sub":"b5000000-0000-4000-8000-000000000004","role":"authenticated"}',false); set role authenticated;
do $t$ declare linked uuid:=(select movement_id from qa_probe_movement limit 1); linked_error text; random_error text; begin begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001',linked,'b5900000-0000-4000-8000-000000000034','probe'); exception when others then linked_error:=sqlstate||':'||sqlerrm; end; begin perform public.inventory_reverse_movement('b5100000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','b5900000-0000-4000-8000-000000000035','probe'); exception when others then random_error:=sqlstate||':'||sqlerrm; end; perform pg_temp.ok('B5-15',linked_error='PT403:PERMISSION_DENIED' and random_error=linked_error,'nonmember receives identical non-disclosing denial'); end;$t$;
reset role;
select 'TEST|'||test_id||'|'||status||'|'||detail from qa_results order by test_id;
select 'SUMMARY|'||count(*)||'|'||count(*) filter(where status='PASS')||'|'||count(*) filter(where status='FAIL') from qa_results;
rollback;
