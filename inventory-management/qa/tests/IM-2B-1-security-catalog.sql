\set ON_ERROR_STOP on
-- Local inventory_qa only; execute via the guarded local QA setup. No schema changes.
begin read only;
do $checks$
declare failures integer;
begin
  select count(*) into failures from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname in ('inventory_schools','inventory_members','inventory_items','inventory_stock_lots','inventory_stock_movements','inventory_audit','inventory_idempotency_requests','inventory_purchase_batches','inventory_purchase_lines','inventory_purchase_receipts','inventory_purchase_receipt_lines');
  if failures<>11 then raise exception 'Inventory migration baseline is incomplete'; end if;

  select count(*) into failures from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname like 'inventory\_%' escape '\' and c.relkind='r'
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if failures<>0 then raise exception 'Inventory RLS/FORCE RLS missing'; end if;

  select count(*) into failures from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where n.nspname='public' and c.relname like 'inventory\_%' escape '\'
    and (a.grantee=0 or a.grantee in(select oid from pg_roles where rolname in('anon','authenticated')))
    and a.privilege_type in('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER');
  if failures<>0 then raise exception 'Inventory direct table DML grant found'; end if;

  select count(*) into failures from pg_attribute att join pg_class c on c.oid=att.attrelid
  join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(att.attacl) a
  where n.nspname='public' and c.relname like 'inventory\_%' escape '\'
    and (a.grantee=0 or a.grantee in(select oid from pg_roles where rolname in('anon','authenticated')))
    and a.privilege_type in('INSERT','UPDATE','REFERENCES')
    and not(c.relname='inventory_items' and a.grantee=(select oid from pg_roles where rolname='authenticated')
      and ((a.privilege_type='INSERT' and att.attname in('school_id','item_name','category','specification','base_unit','purchase_unit','base_units_per_purchase_unit','recommended_stock','minimum_stock','is_active'))
      or (a.privilege_type='UPDATE' and att.attname in('item_name','category','specification','base_unit','purchase_unit','base_units_per_purchase_unit','recommended_stock','minimum_stock','is_active'))));
  if failures<>0 then raise exception 'Unexpected Inventory column write grant found'; end if;

  select count(*) into failures from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname in('public','inventory_private') and p.proname like 'inventory\_%' escape '\'
    and a.privilege_type='EXECUTE' and (a.grantee=0 or a.grantee=(select oid from pg_roles where rolname='anon'));
  if failures<>0 then raise exception 'PUBLIC/anon Inventory function EXECUTE found'; end if;

  select count(*) into failures from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','inventory_private') and p.proname like 'inventory\_%' escape '\'
    and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false);
  if failures<>0 then raise exception 'Unsafe Inventory SECURITY DEFINER search_path'; end if;
end;
$checks$;
select 'PASS|Inventory security catalog (RLS, FORCE RLS, ACL, fixed search_path)';
rollback;
