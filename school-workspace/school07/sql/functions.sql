CREATE FUNCTION workspace_private.s07_permission(s uuid,p text)RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT workspace_private.allowed(s)AND NOT EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.membership_permission_overrides o ON o.school_id=m.school_id AND o.membership_id=m.id AND o.epoch=m.epoch WHERE m.school_id=s AND m.actor_id=workspace_private.actor()AND o.permission=p AND o.effect='deny')AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=s AND m.actor_id=workspace_private.actor()AND(
 EXISTS(SELECT 1 FROM workspace.role_permission_defaults d WHERE d.role=m.role AND d.permission=p)
 OR(m.role='HEALTH_ASSISTANT'AND p IN('inventory.receive','inventory.use')AND EXISTS(SELECT 1 FROM workspace.membership_permission_overrides o WHERE o.school_id=s AND o.membership_id=m.id AND o.epoch=m.epoch AND o.permission=p AND o.effect='allow'AND o.scope='own'))))$$;
ALTER FUNCTION workspace_private.s07_permission(uuid,text)OWNER TO ws_authz_reader;
GRANT EXECUTE ON FUNCTION workspace_private.s07_permission(uuid,text)TO ws_runtime;
SET LOCAL ROLE ws_owner;
CREATE POLICY s07_location_read ON workspace.shared_inventory_locations FOR SELECT TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.read'));
CREATE POLICY s07_location_insert ON workspace.shared_inventory_locations FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s07_permission(school_id,'inventory.manage'));
CREATE POLICY s07_location_update ON workspace.shared_inventory_locations FOR UPDATE TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.manage'))WITH CHECK(workspace_private.s07_permission(school_id,'inventory.manage'));
CREATE POLICY s07_item_read ON workspace.shared_inventory_items FOR SELECT TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.read'));
CREATE POLICY s07_item_insert ON workspace.shared_inventory_items FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s07_permission(school_id,'inventory.manage'));
CREATE POLICY s07_item_update ON workspace.shared_inventory_items FOR UPDATE TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.manage'))WITH CHECK(workspace_private.s07_permission(school_id,'inventory.manage'));
CREATE POLICY s07_lot_read ON workspace.shared_inventory_lots FOR SELECT TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.read'));
CREATE POLICY s07_lot_insert ON workspace.shared_inventory_lots FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s07_permission(school_id,'inventory.receive'));
CREATE POLICY s07_lot_update ON workspace.shared_inventory_lots FOR UPDATE TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.receive')OR workspace_private.s07_permission(school_id,'inventory.use')OR workspace_private.s07_permission(school_id,'inventory.adjust')OR workspace_private.s07_permission(school_id,'inventory.dispose')OR workspace_private.s07_permission(school_id,'inventory.manage'))WITH CHECK(workspace_private.allowed(school_id));
CREATE POLICY s07_movement_read ON workspace.shared_inventory_movements FOR SELECT TO ws_runtime USING(workspace_private.s07_permission(school_id,'inventory.read'));
CREATE POLICY s07_movement_insert ON workspace.shared_inventory_movements FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s07_permission(school_id,CASE type WHEN 'RECEIVE'THEN 'inventory.receive'WHEN 'USE'THEN 'inventory.use'WHEN 'ADJUST'THEN 'inventory.adjust'WHEN 'DISPOSE'THEN 'inventory.dispose'ELSE 'inventory.manage'END)AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_inventory_movements.school_id AND m.id=actor_membership_id AND m.epoch=actor_epoch AND m.actor_id=workspace_private.actor()));
RESET ROLE;
CREATE FUNCTION workspace_private.s07_soon_days()RETURNS integer LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=''AS $$SELECT 30$$;
ALTER FUNCTION workspace_private.s07_soon_days()OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s07_today()RETURNS date LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''AS $$SELECT(statement_timestamp()AT TIME ZONE'Asia/Seoul')::date$$;
ALTER FUNCTION workspace_private.s07_today()OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s07_read(s uuid,op text,p jsonb)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''AS $$
DECLARE v jsonb;i uuid;BEGIN
PERFORM workspace_private.enter(s);IF NOT workspace_private.s07_permission(s,'inventory.read')THEN RAISE EXCEPTION 'access_denied';END IF;
IF p IS NULL OR jsonb_typeof(p)<>'object'OR octet_length(p::text)>2048 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p)k WHERE k NOT IN('item_id','search','category'))THEN RAISE EXCEPTION 'input_rejected';END IF;
IF op='context'THEN RETURN jsonb_build_object('role',workspace_private.member_role(s),'manage',workspace_private.s07_permission(s,'inventory.manage'),'receive',workspace_private.s07_permission(s,'inventory.receive'),'use',workspace_private.s07_permission(s,'inventory.use'),'adjust',workspace_private.s07_permission(s,'inventory.adjust'),'dispose',workspace_private.s07_permission(s,'inventory.dispose'),'today',workspace_private.s07_today(),'soon_days',workspace_private.s07_soon_days());END IF;
IF op='locations'THEN SELECT coalesce(jsonb_agg(to_jsonb(l)ORDER BY l.name),'[]')INTO v FROM workspace.shared_inventory_locations l WHERE l.school_id=s;RETURN v;END IF;
i:=nullif(p->>'item_id','')::uuid;
IF op IN('get','lots','movements')AND NOT EXISTS(SELECT 1 FROM workspace.shared_inventory_items WHERE school_id=s AND item_id=i)THEN RAISE EXCEPTION 'access_denied';END IF;
IF op='lots'THEN SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY q.expiry_date NULLS LAST,q.received_date,q.lot_id),'[]')INTO v FROM(SELECT l.*,CASE WHEN expiry_date IS NULL THEN 'NONE'WHEN expiry_date<workspace_private.s07_today()THEN 'EXPIRED'WHEN expiry_date<=workspace_private.s07_today()+workspace_private.s07_soon_days() THEN 'SOON'ELSE 'NORMAL'END expiry_status FROM workspace.shared_inventory_lots l WHERE school_id=s AND item_id=i)q;RETURN v;END IF;
IF op='movements'THEN SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY q.created_at DESC,q.movement_id),'[]')INTO v FROM(SELECT h.*,m.member_code FROM workspace.shared_inventory_movements h JOIN workspace.school_memberships m ON m.school_id=h.school_id AND m.id=h.actor_membership_id WHERE h.school_id=s AND h.item_id=i ORDER BY h.created_at DESC,h.movement_id LIMIT 100)q;RETURN v;END IF;
SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY q.item_name,q.item_id),'[]')INTO v FROM(
SELECT it.*,lo.name location_name,coalesce(a.total,0)total_quantity,coalesce(a.available,0)available_quantity,coalesce(a.soon,0)soon_quantity,coalesce(a.expired,0)expired_quantity,coalesce(a.unusable,0)unusable_quantity,coalesce(a.available,0)<it.minimum_quantity is_low
FROM workspace.shared_inventory_items it LEFT JOIN workspace.shared_inventory_locations lo ON lo.school_id=it.school_id AND lo.location_id=it.storage_location_id
LEFT JOIN LATERAL(SELECT sum(quantity)total,sum(quantity)FILTER(WHERE state='AVAILABLE'AND(expiry_date IS NULL OR expiry_date>=workspace_private.s07_today()))available,sum(quantity)FILTER(WHERE state='AVAILABLE'AND expiry_date BETWEEN workspace_private.s07_today()AND workspace_private.s07_today()+workspace_private.s07_soon_days())soon,sum(quantity)FILTER(WHERE expiry_date<workspace_private.s07_today())expired,sum(quantity)FILTER(WHERE state='UNUSABLE')unusable FROM workspace.shared_inventory_lots WHERE school_id=s AND item_id=it.item_id)a ON true
WHERE it.school_id=s AND(i IS NULL OR it.item_id=i)AND(length(coalesce(p->>'search',''))<=80)AND(coalesce(p->>'search','')=''OR strpos(lower(it.item_name),lower(p->>'search'))>0)AND(coalesce(p->>'category','')=''OR it.category=p->>'category')LIMIT 500)q;
IF op='get'THEN RETURN v->0;END IF;
IF op='alerts'THEN SELECT coalesce(jsonb_agg(x),'[]')INTO v FROM jsonb_array_elements(v)x WHERE(x->>'active')::boolean AND((x->>'is_low')::boolean OR(x->>'soon_quantity')::numeric>0 OR(x->>'expired_quantity')::numeric>0);END IF;RETURN v;END$$;
ALTER FUNCTION workspace_private.s07_read(uuid,text,jsonb)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s07_write(s uuid,op text,p jsonb,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''AS $$
DECLARE cap text;receipt jsonb;hashed jsonb;x workspace.shared_inventory_items;l workspace.shared_inventory_lots;loc workspace.shared_inventory_locations;m workspace.school_memberships;q numeric;d numeric;b numeric;id uuid;lo uuid;exp date;rd date;reason text;BEGIN
PERFORM workspace_private.enter(s);cap:=CASE op WHEN 'receive'THEN 'inventory.receive'WHEN 'use'THEN 'inventory.use'WHEN 'adjust'THEN 'inventory.adjust'WHEN 'dispose'THEN 'inventory.dispose'ELSE 'inventory.manage'END;
IF NOT workspace_private.s07_permission(s,'inventory.read')OR NOT workspace_private.s07_permission(s,cap)THEN RAISE EXCEPTION 'access_denied';END IF;
IF p IS NULL OR jsonb_typeof(p)<>'object'OR octet_length(p::text)>2048 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p)k WHERE k NOT IN('item_id','lot_id','location_id','name','category','specification','unit','minimum_quantity','active','quantity','expiry_date','received_date','reason','state'))OR ev IS NULL OR ev<0 THEN RAISE EXCEPTION 'input_rejected';END IF;
-- Blocked free text is not persisted in receipts/audit; only a payload digest is retained on success.
IF NOT workspace_private.s04_safe(coalesce(nullif(p->>'name',''),'재고 기록'),coalesce(p->>'specification','')||' '||coalesce(p->>'reason','')||' '||coalesce(p->>'category','')||' '||coalesce(p->>'unit',''))OR length(coalesce(p->>'reason',''))>80 THEN RAISE EXCEPTION 'input_rejected';END IF;
hashed:=workspace_private.s03_hash(jsonb_build_array(op,p,ev));receipt:=workspace_private.receipt(s,r,'s07_'||op,hashed);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
SELECT * INTO STRICT m FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
IF op='location'THEN
 lo:=nullif(p->>'location_id','')::uuid;
 IF lo IS NULL THEN IF ev<>0 THEN RAISE EXCEPTION 'conflict';END IF;INSERT INTO workspace.shared_inventory_locations(school_id,name,created_by,created_by_epoch,updated_by,updated_by_epoch)VALUES(s,p->>'name',m.id,m.epoch,m.id,m.epoch)RETURNING *INTO loc;
 ELSE SELECT *INTO loc FROM workspace.shared_inventory_locations WHERE school_id=s AND location_id=lo FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF loc.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;UPDATE workspace.shared_inventory_locations SET name=p->>'name',active=coalesce((p->>'active')::boolean,true),version=version+1,updated_by=m.id,updated_by_epoch=m.epoch,updated_at=clock_timestamp()WHERE school_id=s AND location_id=lo RETURNING *INTO loc;END IF;
 RETURN workspace_private.finish(s,r,'s07_'||op,hashed,to_jsonb(loc),loc.location_id);END IF;
IF op IN('create','edit')THEN
 q:=(p->>'minimum_quantity')::numeric;lo:=nullif(p->>'location_id','')::uuid;
 IF lo IS NOT NULL AND NOT EXISTS(SELECT 1 FROM workspace.shared_inventory_locations WHERE school_id=s AND location_id=lo AND active)THEN RAISE EXCEPTION 'access_denied';END IF;
 IF op='create'THEN IF ev<>0 THEN RAISE EXCEPTION 'conflict';END IF;
 INSERT INTO workspace.shared_inventory_items(school_id,item_name,category,specification,unit,minimum_quantity,storage_location_id,created_by,created_by_epoch,updated_by,updated_by_epoch)VALUES(s,p->>'name',p->>'category',p->>'specification',p->>'unit',q,lo,m.id,m.epoch,m.id,m.epoch)RETURNING *INTO x;
 ELSE SELECT *INTO x FROM workspace.shared_inventory_items WHERE school_id=s AND item_id=(p->>'item_id')::uuid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 UPDATE workspace.shared_inventory_items SET item_name=p->>'name',category=p->>'category',specification=p->>'specification',unit=p->>'unit',minimum_quantity=q,storage_location_id=lo,active=coalesce((p->>'active')::boolean,true),updated_by=m.id,updated_by_epoch=m.epoch,updated_at=clock_timestamp(),version=version+1 WHERE school_id=s AND item_id=x.item_id RETURNING *INTO x;END IF;
 RETURN workspace_private.finish(s,r,'s07_'||op,hashed,jsonb_build_object('item_id',x.item_id,'version',x.version),x.item_id);END IF;
SELECT *INTO x FROM workspace.shared_inventory_items WHERE school_id=s AND item_id=(p->>'item_id')::uuid;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;
IF NOT x.active AND op IN('receive','use')THEN RAISE EXCEPTION 'input_rejected';END IF;
id:=nullif(p->>'lot_id','')::uuid;reason:=coalesce(p->>'reason','');q:=(p->>'quantity')::numeric;
IF op<>'state'AND(q IS NULL OR NOT(q BETWEEN 0 AND 1000000000)OR scale(q)>3 OR(op<>'adjust'AND q=0))THEN RAISE EXCEPTION 'input_rejected';END IF;
IF op='receive'AND id IS NULL THEN
 IF ev<>0 THEN RAISE EXCEPTION 'conflict';END IF;exp:=nullif(p->>'expiry_date','')::date;rd:=coalesce(nullif(p->>'received_date','')::date,workspace_private.s07_today());IF rd>workspace_private.s07_today()THEN RAISE EXCEPTION 'input_rejected';END IF;
 INSERT INTO workspace.shared_inventory_lots(school_id,item_id,expiry_date,received_date,quantity,created_by,created_by_epoch)VALUES(s,x.item_id,exp,rd,q,m.id,m.epoch)RETURNING *INTO l;b:=0;d:=q;
 ELSE SELECT *INTO l FROM workspace.shared_inventory_lots WHERE school_id=s AND item_id=x.item_id AND lot_id=id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF l.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;b:=l.quantity;
 IF op='use'AND(l.state<>'AVAILABLE'OR(l.expiry_date IS NOT NULL AND l.expiry_date<workspace_private.s07_today()))THEN RAISE EXCEPTION 'expired_or_unusable';END IF;
 IF op='receive'AND(l.state<>'AVAILABLE'OR p ?'expiry_date'AND nullif(p->>'expiry_date','')::date IS DISTINCT FROM l.expiry_date OR p ?'received_date'AND nullif(p->>'received_date','')::date IS DISTINCT FROM l.received_date)THEN RAISE EXCEPTION 'input_rejected';END IF;
 IF op='state'THEN IF p->>'state'IS NULL OR p->>'state'NOT IN('AVAILABLE','UNUSABLE')THEN RAISE EXCEPTION 'input_rejected';END IF;d:=0;
 ELSE d:=CASE op WHEN 'receive'THEN q WHEN 'adjust'THEN q-b ELSE -q END;IF b+d<0 THEN RAISE EXCEPTION 'insufficient_stock';END IF;IF d=0 THEN RAISE EXCEPTION 'input_rejected';END IF;END IF;
 UPDATE workspace.shared_inventory_lots SET quantity=b+d,state=CASE WHEN op='state'THEN p->>'state'ELSE state END,version=version+1,updated_at=clock_timestamp()WHERE school_id=s AND lot_id=l.lot_id RETURNING *INTO l;
 END IF;
 INSERT INTO workspace.shared_inventory_movements(school_id,item_id,lot_id,type,quantity_before,delta,quantity_after,actor_membership_id,actor_epoch,request_id,lot_version,reason)VALUES(s,x.item_id,l.lot_id,upper(op),b,d,l.quantity,m.id,m.epoch,r,l.version,reason);
 RETURN workspace_private.finish(s,r,'s07_'||op,hashed,jsonb_build_object('item_id',x.item_id,'lot_id',l.lot_id,'quantity',l.quantity,'version',l.version),l.lot_id);
END$$;
ALTER FUNCTION workspace_private.s07_write(uuid,text,jsonb,bigint,uuid)OWNER TO ws_runtime;
