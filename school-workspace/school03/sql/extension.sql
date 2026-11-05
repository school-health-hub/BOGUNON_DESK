-- SCHOOL-03 LOCAL ONLY compatible extension. A/B/C/02 source migrations remain unchanged.
BEGIN;
DO $$BEGIN IF current_database()<>'school01a' THEN RAISE EXCEPTION 'local_only';END IF;END$$;
SET ROLE ws_owner;
CREATE TABLE workspace.shared_tasks(
 task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),description text NOT NULL DEFAULT '' CHECK(length(description)<=400),
 status text NOT NULL DEFAULT 'TODO' CHECK(status IN('TODO','IN_PROGRESS','DONE','CANCELLED')),
 priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN('LOW','NORMAL','HIGH')),due_date date,
 created_by_membership_id uuid NOT NULL,created_by_epoch integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_by_membership_id uuid NOT NULL,updated_by_epoch integer NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,
 UNIQUE(school_id,task_id),FOREIGN KEY(school_id,created_by_membership_id,created_by_epoch) REFERENCES workspace.membership_terms,
 FOREIGN KEY(school_id,updated_by_membership_id,updated_by_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.shared_task_assignees(
 school_id uuid NOT NULL,task_id uuid NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,
 PRIMARY KEY(school_id,task_id,membership_id),FOREIGN KEY(school_id,task_id) REFERENCES workspace.shared_tasks(school_id,task_id),
 FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.shared_task_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL,task_id uuid NOT NULL,
 actor_membership_id uuid NOT NULL,actor_epoch integer NOT NULL,action text NOT NULL,version bigint NOT NULL,
 from_status text,to_status text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(school_id,task_id,version),FOREIGN KEY(school_id,task_id) REFERENCES workspace.shared_tasks(school_id,task_id),
 FOREIGN KEY(school_id,actor_membership_id,actor_epoch) REFERENCES workspace.membership_terms);
CREATE INDEX s03_due ON workspace.shared_tasks(school_id,due_date,task_id) WHERE archived_at IS NULL;
CREATE INDEX s03_member_tasks ON workspace.shared_task_assignees(school_id,membership_id,epoch,task_id);
CREATE INDEX s03_history ON workspace.shared_task_history(school_id,task_id,version DESC);
ALTER TABLE workspace.shared_tasks ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace.shared_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace.shared_task_assignees ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace.shared_task_assignees FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace.shared_task_history ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace.shared_task_history FORCE ROW LEVEL SECURITY;
GRANT SELECT ON workspace.membership_permission_overrides,workspace.role_permission_defaults TO ws_authz_reader;
CREATE POLICY s03_overrides_reader ON workspace.membership_permission_overrides FOR SELECT TO ws_authz_reader USING(true);
CREATE POLICY s03_defaults_reader ON workspace.role_permission_defaults FOR SELECT TO ws_authz_reader USING(true);
RESET ROLE;
CREATE FUNCTION workspace_private.s03_read(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=s AND m.actor_id=workspace_private.actor()
 AND(EXISTS(SELECT 1 FROM workspace.role_permission_defaults d WHERE d.role=m.role AND d.permission='task.read') OR EXISTS(SELECT 1 FROM workspace.membership_permission_overrides o WHERE o.school_id=s AND o.membership_id=m.id AND o.epoch=m.epoch AND o.permission='task.read' AND o.effect='allow'))
 AND NOT EXISTS(SELECT 1 FROM workspace.membership_permission_overrides o WHERE o.school_id=s AND o.membership_id=m.id AND o.epoch=m.epoch AND o.permission='task.read' AND o.effect='deny')) $$;
ALTER FUNCTION workspace_private.s03_read(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s03_manage(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.s03_read(s) AND workspace_private.member_role(s) IN('SCHOOL_ADMIN','HEALTH_TEACHER') $$;
ALTER FUNCTION workspace_private.s03_manage(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s03_valid_epoch(s uuid,m uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT x.epoch FROM workspace.school_memberships x JOIN workspace.accounts a ON a.id=x.actor_id WHERE x.school_id=s AND x.id=m
 AND workspace_private.allowed(s) AND x.status='active' AND x.role IS NOT NULL AND a.status='active' AND a.user_id IS NOT NULL
 AND x.valid_from<=statement_timestamp() AND(x.valid_until IS NULL OR x.valid_until>statement_timestamp()) $$;
ALTER FUNCTION workspace_private.s03_valid_epoch(uuid,uuid) OWNER TO ws_authz_reader;
GRANT EXECUTE ON FUNCTION workspace_private.s03_read(uuid),workspace_private.s03_manage(uuid),workspace_private.s03_valid_epoch(uuid,uuid) TO ws_runtime;
CREATE FUNCTION workspace_private.s03_assigned(s uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM workspace.shared_task_assignees a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id AND m.epoch=a.epoch WHERE a.school_id=s AND a.task_id=t AND m.actor_id=workspace_private.actor() AND workspace_private.s03_valid_epoch(s,m.id)=m.epoch) $$;
ALTER FUNCTION workspace_private.s03_assigned(uuid,uuid) OWNER TO ws_runtime;
GRANT SELECT,INSERT,UPDATE ON workspace.shared_tasks TO ws_runtime;
CREATE POLICY s03_task_read ON workspace.shared_tasks FOR SELECT TO ws_runtime USING(workspace_private.s03_read(school_id));
CREATE POLICY s03_task_insert ON workspace.shared_tasks FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s03_manage(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_tasks.school_id AND m.id=created_by_membership_id AND m.epoch=created_by_epoch AND m.actor_id=workspace_private.actor()));
CREATE POLICY s03_task_update ON workspace.shared_tasks FOR UPDATE TO ws_runtime
 USING(workspace_private.s03_manage(school_id) OR(workspace_private.s03_read(school_id) AND workspace_private.s03_assigned(school_id,task_id)))
 WITH CHECK(workspace_private.s03_read(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_tasks.school_id AND m.id=updated_by_membership_id AND m.epoch=updated_by_epoch AND m.actor_id=workspace_private.actor()));
GRANT SELECT,INSERT,DELETE ON workspace.shared_task_assignees TO ws_runtime;
CREATE POLICY s03_assignee_read ON workspace.shared_task_assignees FOR SELECT TO ws_runtime USING(workspace_private.s03_read(school_id));
CREATE POLICY s03_assignee_insert ON workspace.shared_task_assignees FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s03_manage(school_id) AND workspace_private.s03_valid_epoch(school_id,membership_id)=epoch);
CREATE POLICY s03_assignee_delete ON workspace.shared_task_assignees FOR DELETE TO ws_runtime USING(workspace_private.s03_manage(school_id));
GRANT SELECT,INSERT ON workspace.shared_task_history TO ws_runtime;
CREATE POLICY s03_history_read ON workspace.shared_task_history FOR SELECT TO ws_runtime USING(workspace_private.s03_manage(school_id));
CREATE POLICY s03_history_insert ON workspace.shared_task_history FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s03_read(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_task_history.school_id AND m.id=actor_membership_id AND m.epoch=actor_epoch AND m.actor_id=workspace_private.actor()));
CREATE FUNCTION workspace_private.s03_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a uuid;e integer;BEGIN
 IF NEW.task_id<>OLD.task_id OR NEW.school_id<>OLD.school_id OR NEW.created_at<>OLD.created_at OR NEW.created_by_membership_id<>OLD.created_by_membership_id OR NEW.created_by_epoch<>OLD.created_by_epoch THEN RAISE EXCEPTION 'access_denied';END IF;
 IF OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s03_manage(OLD.school_id) THEN
 IF workspace_private.member_role(OLD.school_id)<>'HEALTH_ASSISTANT' OR NOT workspace_private.s03_assigned(OLD.school_id,OLD.task_id)
 OR NOT((OLD.status='TODO' AND NEW.status='IN_PROGRESS') OR(OLD.status='IN_PROGRESS' AND NEW.status='DONE'))
 OR ROW(NEW.title,NEW.description,NEW.priority,NEW.due_date,NEW.archived_at) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.priority,OLD.due_date,OLD.archived_at) THEN RAISE EXCEPTION 'access_denied';END IF;END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=OLD.school_id AND actor_id=workspace_private.actor();
 NEW.updated_by_membership_id:=a;NEW.updated_by_epoch:=e;NEW.updated_at:=clock_timestamp();NEW.version:=OLD.version+1;RETURN NEW;END $$;
ALTER FUNCTION workspace_private.s03_guard() OWNER TO ws_runtime;
CREATE TRIGGER s03_guard BEFORE UPDATE ON workspace.shared_tasks FOR EACH ROW EXECUTE FUNCTION workspace_private.s03_guard();
CREATE FUNCTION workspace_private.s03_safe(title text,body text) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT title IS NOT NULL AND body IS NOT NULL AND length(title) BETWEEN 1 AND 100 AND length(btrim(title))>0 AND length(body)<=400
 AND title!~'[[:cntrl:]]' AND replace(body,E'\n','')!~'[[:cntrl:]]' AND length(body)-length(replace(body,E'\n',''))<=3
 AND (title||' '||body)!~*'(학생|학번|상담|투약|처치|보건일지|건강정보|비밀번호|인증서|주민등록|password|finance|medical|secret|01[016789][- ]?[0-9]{3,4}[- ]?[0-9]{4}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})' $$;
ALTER FUNCTION workspace_private.s03_safe(text,text) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_hash(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS
$$ SELECT jsonb_build_object('sha256',encode(sha256(convert_to(p::text,'UTF8')),'hex')) $$;
ALTER FUNCTION workspace_private.s03_hash(jsonb) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_json(s uuid,t uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(x)||jsonb_build_object('assignees',(SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id',a.membership_id,'epoch',a.epoch,'member_code',m.member_code,'active',coalesce(workspace_private.s03_valid_epoch(s,m.id)=a.epoch,false)) ORDER BY m.member_code),'[]') FROM workspace.shared_task_assignees a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id WHERE a.school_id=s AND a.task_id=t)) FROM workspace.shared_tasks x WHERE x.school_id=s AND x.task_id=t $$;
ALTER FUNCTION workspace_private.s03_json(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_record(s uuid,t uuid,c text,old_status text,r uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;a uuid;e integer;BEGIN
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.shared_task_history(school_id,task_id,actor_membership_id,actor_epoch,action,version,from_status,to_status) VALUES(s,t,a,e,c,x.version,old_status,x.status);
 RETURN workspace_private.finish(s,r,c,p,jsonb_build_object('task_id',t,'version',x.version),t);END $$;
ALTER FUNCTION workspace_private.s03_record(uuid,uuid,text,text,uuid,jsonb) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_assign(s uuid,t uuid,ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m uuid;e integer;BEGIN
 IF ids IS NULL OR cardinality(ids)>10 OR array_position(ids,NULL) IS NOT NULL OR cardinality(ids)<>(SELECT count(DISTINCT v) FROM unnest(ids)v) THEN RAISE EXCEPTION 'input_rejected';END IF;
 -- Validate every target before deleting existing assignments.
 FOREACH m IN ARRAY ids LOOP IF workspace_private.s03_valid_epoch(s,m) IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;END LOOP;
 DELETE FROM workspace.shared_task_assignees WHERE school_id=s AND task_id=t;
 FOREACH m IN ARRAY ids LOOP e:=workspace_private.s03_valid_epoch(s,m);INSERT INTO workspace.shared_task_assignees VALUES(s,t,m,e);END LOOP;END $$;
ALTER FUNCTION workspace_private.s03_assign(uuid,uuid,uuid[]) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_list(s uuid,filter_status text,sort_value text,scope_value text,archives boolean) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;a uuid;e integer;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_read(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF filter_status IS NOT NULL AND filter_status NOT IN('TODO','IN_PROGRESS','DONE','CANCELLED') OR sort_value IS NULL OR sort_value NOT IN('DUE','PRIORITY') OR scope_value IS NULL OR scope_value NOT IN('ALL','MINE','TODAY') THEN RAISE EXCEPTION 'input_rejected';END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 SELECT coalesce(jsonb_agg(workspace_private.s03_json(s,q.task_id) ORDER BY q.n),'[]') INTO v FROM(
 SELECT task_id,row_number()over(ORDER BY CASE WHEN sort_value='PRIORITY' THEN CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END END DESC NULLS LAST,due_date ASC NULLS LAST,CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END DESC,created_at,task_id)n
 FROM workspace.shared_tasks WHERE school_id=s AND(archives OR archived_at IS NULL) AND(filter_status IS NULL OR status=filter_status)
 AND(scope_value<>'MINE' OR workspace_private.s03_assigned(s,task_id)) AND(scope_value<>'TODAY' OR(due_date<=(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date AND status IN('TODO','IN_PROGRESS'))) ORDER BY n LIMIT 100)q;
 RETURN jsonb_build_object('tasks',v,'self',jsonb_build_object('membership_id',a,'epoch',e,'role',workspace_private.member_role(s)),
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'epoch',m.epoch,'member_code',m.member_code,'role',m.role) ORDER BY m.member_code),'[]') FROM workspace.school_memberships m WHERE m.school_id=s AND workspace_private.s03_valid_epoch(s,m.id)=m.epoch),'limit',100);END $$;
ALTER FUNCTION workspace_private.s03_list(uuid,text,text,text,boolean) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_get(s uuid,t uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_read(s) THEN RAISE EXCEPTION 'access_denied';END IF;v:=workspace_private.s03_json(s,t);IF v IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;RETURN v;END $$;
ALTER FUNCTION workspace_private.s03_get(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_create(s uuid,title_value text,body text,priority_value text,due date,ids uuid[],r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb;v jsonb;t uuid;a uuid;e integer;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 -- Return a safe error without raising a text-bearing SQL error or persisting rejected content.
 IF NOT workspace_private.s03_safe(title_value,body) OR priority_value IS NULL OR priority_value NOT IN('LOW','NORMAL','HIGH') THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(title_value,body,priority_value,due,ids));v:=workspace_private.receipt(s,r,'s03_create',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.shared_tasks(school_id,title,description,priority,due_date,created_by_membership_id,created_by_epoch,updated_by_membership_id,updated_by_epoch) VALUES(s,title_value,body,priority_value,due,a,e,a,e) RETURNING task_id INTO t;
 PERFORM workspace_private.s03_assign(s,t,ids);RETURN workspace_private.s03_record(s,t,'s03_create',NULL,r,p);END $$;
ALTER FUNCTION workspace_private.s03_create(uuid,text,text,text,date,uuid[],uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_edit(s uuid,t uuid,title_value text,body text,priority_value text,due date,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s03_safe(title_value,body) OR priority_value IS NULL OR priority_value NOT IN('LOW','NORMAL','HIGH') THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(t,title_value,body,priority_value,due,ev));v:=workspace_private.receipt(s,r,'s03_edit',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 UPDATE workspace.shared_tasks SET title=title_value,description=body,priority=priority_value,due_date=due WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_edit',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_edit(uuid,uuid,text,text,text,date,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_reassign(s uuid,t uuid,ids uuid[],ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb:=workspace_private.s03_hash(jsonb_build_array(t,ids,ev));v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s03_assign',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 PERFORM workspace_private.s03_assign(s,t,ids);UPDATE workspace.shared_tasks SET updated_at=clock_timestamp() WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_assign',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_reassign(uuid,uuid,uuid[],bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_status(s uuid,t uuid,new_status text,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb:=workspace_private.s03_hash(jsonb_build_array(t,new_status,ev));v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_read(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s03_status',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 IF new_status IS NULL OR new_status NOT IN('TODO','IN_PROGRESS','DONE') THEN RAISE EXCEPTION 'access_denied';END IF;
 UPDATE workspace.shared_tasks SET status=new_status WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_status',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_status(uuid,uuid,text,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_close(s uuid,t uuid,mode_value text,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb:=workspace_private.s03_hash(jsonb_build_array(t,mode_value,ev));v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s03_close',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 IF mode_value IS NULL OR mode_value NOT IN('DONE','CANCELLED','ARCHIVE') THEN RAISE EXCEPTION 'access_denied';END IF;
 UPDATE workspace.shared_tasks SET status=CASE WHEN mode_value='ARCHIVE' THEN status ELSE mode_value END,archived_at=CASE WHEN mode_value='ARCHIVE' THEN clock_timestamp() ELSE NULL END WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_close',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_close(uuid,uuid,text,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_history(s uuid,t uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) OR workspace_private.s03_json(s,t) IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.version DESC),'[]') INTO v FROM(SELECT h.action,h.version,h.from_status,h.to_status,h.created_at,m.member_code FROM workspace.shared_task_history h JOIN workspace.school_memberships m ON m.school_id=h.school_id AND m.id=h.actor_membership_id WHERE h.school_id=s AND h.task_id=t ORDER BY h.version DESC LIMIT 100)q;RETURN v;END $$;
ALTER FUNCTION workspace_private.s03_history(uuid,uuid) OWNER TO ws_runtime;
DO $$ DECLARE x record;BEGIN FOR x IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' AND p.proname LIKE 's03_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ws_runtime',x.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION workspace_private.s03_list(uuid,text,text,text,boolean) TO authenticated;
CREATE FUNCTION public.ws_v1_list_tasks(p_school_id uuid,p_status text,p_sort text,p_scope text,p_include_archived boolean) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_list(p_school_id,p_status,p_sort,p_scope,p_include_archived) $$;
ALTER FUNCTION public.ws_v1_list_tasks(uuid,text,text,text,boolean) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_tasks(uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_tasks(uuid,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_get(uuid,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_get_task(p_school_id uuid,p_task_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_get(p_school_id,p_task_id) $$;
ALTER FUNCTION public.ws_v1_get_task(uuid,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_task(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_task(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_create(uuid,text,text,text,date,uuid[],uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_create_task(p_school_id uuid,p_title text,p_description text,p_priority text,p_due_date date,p_assignees uuid[],p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_create(p_school_id,p_title,p_description,p_priority,p_due_date,p_assignees,p_request_id) $$;
ALTER FUNCTION public.ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_edit(uuid,uuid,text,text,text,date,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_edit_task(p_school_id uuid,p_task_id uuid,p_title text,p_description text,p_priority text,p_due_date date,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_edit(p_school_id,p_task_id,p_title,p_description,p_priority,p_due_date,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_reassign(uuid,uuid,uuid[],bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_assign_task(p_school_id uuid,p_task_id uuid,p_assignees uuid[],p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_reassign(p_school_id,p_task_id,p_assignees,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_status(uuid,uuid,text,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_change_assigned_task_status(p_school_id uuid,p_task_id uuid,p_status text,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_status(p_school_id,p_task_id,p_status,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_close(uuid,uuid,text,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_close_task(p_school_id uuid,p_task_id uuid,p_mode text,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_close(p_school_id,p_task_id,p_mode,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_close_task(uuid,uuid,text,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_close_task(uuid,uuid,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_close_task(uuid,uuid,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_history(uuid,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_list_task_history(p_school_id uuid,p_task_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_history(p_school_id,p_task_id) $$;
ALTER FUNCTION public.ws_v1_list_task_history(uuid,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_task_history(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_task_history(uuid,uuid) TO authenticated;
COMMIT;
