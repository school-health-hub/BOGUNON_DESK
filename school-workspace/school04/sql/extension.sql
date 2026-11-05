-- LOCAL SYNTHETIC SCHOOL-04 compatible extension, never apply to hosted DB.
BEGIN;
DO $$BEGIN IF current_database()<>'school01a' THEN RAISE EXCEPTION 'local_only';END IF;END$$;
SET ROLE ws_owner;
-- Preserve prior permissions and add only an explicit, targeted completion capability.
ALTER TABLE workspace.membership_permission_overrides DROP CONSTRAINT membership_permission_overrides_permission_check;
ALTER TABLE workspace.membership_permission_overrides ADD CONSTRAINT membership_permission_overrides_permission_check CHECK(permission IN('task.read','handover.create','handover.complete'));
ALTER TABLE workspace.membership_permission_overrides ADD CONSTRAINT s04_complete_scope CHECK(permission<>'handover.complete' OR scope='targeted');
CREATE TABLE workspace.shared_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),description text NOT NULL CHECK(length(description)<=400),
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,all_day boolean NOT NULL,status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN('SCHEDULED','CANCELLED')),
 created_by uuid NOT NULL,created_by_epoch integer NOT NULL,updated_by uuid NOT NULL,updated_by_epoch integer NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(end_at>start_at),CHECK(NOT all_day OR((start_at AT TIME ZONE 'Asia/Seoul')::time='00:00'::time AND(end_at AT TIME ZONE 'Asia/Seoul')::time='00:00'::time)),
 UNIQUE(school_id,event_id),FOREIGN KEY(school_id,created_by,created_by_epoch) REFERENCES workspace.membership_terms,FOREIGN KEY(school_id,updated_by,updated_by_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.shared_event_history(
 school_id uuid NOT NULL,event_id uuid NOT NULL,version bigint NOT NULL,action text NOT NULL,actor_id uuid NOT NULL,actor_epoch integer NOT NULL,
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,all_day boolean NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(school_id,event_id,version),FOREIGN KEY(school_id,event_id) REFERENCES workspace.shared_events(school_id,event_id),FOREIGN KEY(school_id,actor_id,actor_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_notes(
 handover_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),content_revision bigint NOT NULL DEFAULT 1 CHECK(content_revision>0),
 created_by uuid NOT NULL,created_by_epoch integer NOT NULL,updated_by uuid NOT NULL,updated_by_epoch integer NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','COMPLETED')),completed_at timestamptz,completed_by uuid,completed_by_epoch integer,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(school_id,handover_id),FOREIGN KEY(school_id,created_by,created_by_epoch) REFERENCES workspace.membership_terms,
 FOREIGN KEY(school_id,updated_by,updated_by_epoch) REFERENCES workspace.membership_terms,FOREIGN KEY(school_id,completed_by,completed_by_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_revisions(
 school_id uuid NOT NULL,handover_id uuid NOT NULL,version bigint NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),body text NOT NULL CHECK(length(body)<=400),
 actor_id uuid NOT NULL,actor_epoch integer NOT NULL,target_roles text[] NOT NULL,explicit_targets uuid[] NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(school_id,handover_id,version),FOREIGN KEY(school_id,handover_id) REFERENCES workspace.handover_notes(school_id,handover_id),FOREIGN KEY(school_id,actor_id,actor_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_targets(
 school_id uuid NOT NULL,handover_id uuid NOT NULL,revision bigint NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,role_at_publish text NOT NULL,
 PRIMARY KEY(school_id,handover_id,revision,membership_id,epoch),FOREIGN KEY(school_id,handover_id,revision) REFERENCES workspace.handover_revisions,
 FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_acknowledgements(
 school_id uuid NOT NULL,handover_id uuid NOT NULL,revision bigint NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(school_id,handover_id,revision,membership_id,epoch),FOREIGN KEY(school_id,handover_id,revision,membership_id,epoch) REFERENCES workspace.handover_targets);
CREATE INDEX s04_events_range ON workspace.shared_events(school_id,start_at,end_at);
CREATE INDEX s04_targets_actor ON workspace.handover_targets(school_id,membership_id,epoch,handover_id,revision);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['shared_events','shared_event_history','handover_notes','handover_revisions','handover_targets','handover_acknowledgements']LOOP EXECUTE format('ALTER TABLE workspace.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE workspace.%I FORCE ROW LEVEL SECURITY',t);END LOOP;END$$;
-- Reader receives metadata columns only, not note/revision content.
GRANT SELECT(school_id,handover_id,content_revision,created_by,created_by_epoch) ON workspace.handover_notes TO ws_authz_reader;
GRANT SELECT ON workspace.handover_targets TO ws_authz_reader;
CREATE POLICY s04_note_metadata ON workspace.handover_notes FOR SELECT TO ws_authz_reader USING(true);
CREATE POLICY s04_target_metadata ON workspace.handover_targets FOR SELECT TO ws_authz_reader USING(true);
RESET ROLE;
CREATE FUNCTION workspace_private.s04_safe(t text,b text) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.s03_safe(t,b) AND(t||' '||b)!~'(증상|질병|검사[ ]?결과|건강[ ]?상태|개인정보)' $$;
ALTER FUNCTION workspace_private.s04_safe(text,text) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_manage(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.member_role(s) IN('SCHOOL_ADMIN','HEALTH_TEACHER') $$;
ALTER FUNCTION workspace_private.s04_manage(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_permission(s uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.membership_permission_overrides o ON o.school_id=m.school_id AND o.membership_id=m.id AND o.epoch=m.epoch
 WHERE m.school_id=s AND m.actor_id=workspace_private.actor() AND o.permission=p AND o.effect='allow' AND((p='handover.create' AND o.scope='school')OR(p='handover.complete' AND o.scope='targeted'))) $$;
ALTER FUNCTION workspace_private.s04_permission(uuid,text) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_denied(s uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.membership_permission_overrides o ON o.school_id=m.school_id AND o.membership_id=m.id AND o.epoch=m.epoch WHERE m.school_id=s AND m.actor_id=workspace_private.actor() AND o.permission=p AND o.effect='deny') $$;
ALTER FUNCTION workspace_private.s04_denied(uuid,text) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_create_allowed(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT NOT workspace_private.s04_denied(s,'handover.create') AND(workspace_private.s04_manage(s) OR(workspace_private.member_role(s)='HEALTH_ASSISTANT' AND workspace_private.s04_permission(s,'handover.create'))) $$;
ALTER FUNCTION workspace_private.s04_create_allowed(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_target(s uuid,h uuid,v bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND EXISTS(SELECT 1 FROM workspace.handover_targets t JOIN workspace.school_memberships m ON m.school_id=t.school_id AND m.id=t.membership_id AND m.epoch=t.epoch WHERE t.school_id=s AND t.handover_id=h AND t.revision=v AND m.actor_id=workspace_private.actor()) $$;
ALTER FUNCTION workspace_private.s04_target(uuid,uuid,bigint) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_author(s uuid,h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.member_role(s)='HEALTH_TEACHER' AND EXISTS(SELECT 1 FROM workspace.handover_notes n JOIN workspace.school_memberships m ON m.school_id=n.school_id AND m.id=n.created_by AND m.epoch=n.created_by_epoch WHERE n.school_id=s AND n.handover_id=h AND m.actor_id=workspace_private.actor()) $$;
ALTER FUNCTION workspace_private.s04_author(uuid,uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_visible(s uuid,h uuid,v bigint DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND(workspace_private.admin(s) OR workspace_private.s04_author(s,h) OR workspace_private.s04_target(s,h,coalesce(v,(SELECT content_revision FROM workspace.handover_notes WHERE school_id=s AND handover_id=h)))) $$;
ALTER FUNCTION workspace_private.s04_visible(uuid,uuid,bigint) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_editable(s uuid,h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.admin(s) OR workspace_private.s04_author(s,h) $$;
ALTER FUNCTION workspace_private.s04_editable(uuid,uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_completable(s uuid,h uuid,v bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT NOT workspace_private.s04_denied(s,'handover.complete') AND(workspace_private.admin(s) OR(workspace_private.s04_target(s,h,v) AND(workspace_private.member_role(s)='HEALTH_TEACHER' OR workspace_private.s04_permission(s,'handover.complete')))) $$;
ALTER FUNCTION workspace_private.s04_completable(uuid,uuid,bigint) OWNER TO ws_authz_reader;
GRANT SELECT,INSERT,UPDATE ON workspace.shared_events,workspace.handover_notes TO ws_runtime;
GRANT SELECT,INSERT ON workspace.shared_event_history,workspace.handover_revisions,workspace.handover_targets,workspace.handover_acknowledgements TO ws_runtime;
CREATE POLICY s04_events_read ON workspace.shared_events FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY s04_events_insert ON workspace.shared_events FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_manage(school_id));
CREATE POLICY s04_events_update ON workspace.shared_events FOR UPDATE TO ws_runtime USING(workspace_private.s04_manage(school_id))WITH CHECK(workspace_private.s04_manage(school_id));
CREATE POLICY s04_event_history_read ON workspace.shared_event_history FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY s04_event_history_insert ON workspace.shared_event_history FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_manage(school_id));
CREATE POLICY s04_notes_read ON workspace.handover_notes FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id));
CREATE POLICY s04_notes_insert ON workspace.handover_notes FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_create_allowed(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=handover_notes.school_id AND m.id=created_by AND m.epoch=created_by_epoch AND m.actor_id=workspace_private.actor()));
CREATE POLICY s04_notes_update ON workspace.handover_notes FOR UPDATE TO ws_runtime USING(workspace_private.s04_editable(school_id,handover_id) OR workspace_private.s04_completable(school_id,handover_id,content_revision))WITH CHECK(workspace_private.s04_visible(school_id,handover_id));
CREATE POLICY s04_revision_read ON workspace.handover_revisions FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id,version));
CREATE POLICY s04_revision_insert ON workspace.handover_revisions FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_create_allowed(school_id));
CREATE POLICY s04_target_read ON workspace.handover_targets FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id,revision));
CREATE POLICY s04_target_insert ON workspace.handover_targets FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_create_allowed(school_id));
CREATE POLICY s04_ack_read ON workspace.handover_acknowledgements FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id,revision));
CREATE POLICY s04_ack_insert ON workspace.handover_acknowledgements FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_target(school_id,handover_id,revision) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=handover_acknowledgements.school_id AND m.id=membership_id AND m.epoch=handover_acknowledgements.epoch AND m.actor_id=workspace_private.actor()));
CREATE FUNCTION workspace_private.s04_enter(s uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN PERFORM workspace_private.enter(s);END$$;
ALTER FUNCTION workspace_private.s04_enter(uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_list(s uuid,f timestamptz,t timestamptz) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);IF f IS NULL OR t IS NULL OR t<=f OR t-f>interval '93 days' THEN RAISE EXCEPTION 'input_rejected';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY q.start_at,q.event_id),'[]')INTO v FROM(SELECT * FROM workspace.shared_events WHERE school_id=s AND end_at>f AND start_at<t ORDER BY start_at,event_id LIMIT 100)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_event_list(uuid,timestamptz,timestamptz) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_get(s uuid,e uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT to_jsonb(x)INTO v FROM workspace.shared_events x WHERE school_id=s AND event_id=e;IF v IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_event_get(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_save(s uuid,e uuid,t text,b text,f timestamptz,z timestamptz,d boolean,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_events;a uuid;ep integer;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s04_safe(t,b) OR f IS NULL OR z IS NULL OR z<=f OR d IS NULL OR(d AND((f AT TIME ZONE 'Asia/Seoul')::time<>'00:00'::time OR(z AT TIME ZONE 'Asia/Seoul')::time<>'00:00'::time)) THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(e,t,b,f,z,d,ev));v:=workspace_private.receipt(s,r,'s04_event_save',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT id,epoch INTO a,ep FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF e IS NULL THEN IF ev<>0 OR ev IS NULL THEN RAISE EXCEPTION 'conflict';END IF;
 INSERT INTO workspace.shared_events(school_id,title,description,start_at,end_at,all_day,created_by,created_by_epoch,updated_by,updated_by_epoch)VALUES(s,t,b,f,z,d,a,ep,a,ep)RETURNING *INTO x;
 ELSE SELECT *INTO x FROM workspace.shared_events WHERE school_id=s AND event_id=e FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version IS DISTINCT FROM ev OR x.status<>'SCHEDULED' THEN RAISE EXCEPTION 'conflict';END IF;
 UPDATE workspace.shared_events SET title=t,description=b,start_at=f,end_at=z,all_day=d,version=version+1,updated_by=a,updated_by_epoch=ep,updated_at=clock_timestamp()WHERE school_id=s AND event_id=e RETURNING *INTO x;END IF;
 INSERT INTO workspace.shared_event_history(school_id,event_id,version,action,actor_id,actor_epoch,start_at,end_at,all_day,status)VALUES(s,x.event_id,x.version,'SAVE',a,ep,f,z,d,x.status);
 RETURN workspace_private.finish(s,r,'s04_event_save',p,jsonb_build_object('event_id',x.event_id,'version',x.version),x.event_id);END$$;
ALTER FUNCTION workspace_private.s04_event_save(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_cancel(s uuid,e uuid,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE x workspace.shared_events;a uuid;ep integer;p jsonb:=workspace_private.s03_hash(jsonb_build_array(e,ev));v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s04_event_cancel',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT *INTO x FROM workspace.shared_events WHERE school_id=s AND event_id=e FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version IS DISTINCT FROM ev OR x.status<>'SCHEDULED' THEN RAISE EXCEPTION 'conflict';END IF;
 SELECT id,epoch INTO a,ep FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 UPDATE workspace.shared_events SET status='CANCELLED',version=version+1,updated_at=clock_timestamp(),updated_by=a,updated_by_epoch=ep WHERE school_id=s AND event_id=e RETURNING *INTO x;
 INSERT INTO workspace.shared_event_history(school_id,event_id,version,action,actor_id,actor_epoch,start_at,end_at,all_day,status)VALUES(s,e,x.version,'CANCEL',a,ep,x.start_at,x.end_at,x.all_day,x.status);
 RETURN workspace_private.finish(s,r,'s04_event_cancel',p,jsonb_build_object('event_id',e,'version',x.version),e);END$$;
ALTER FUNCTION workspace_private.s04_event_cancel(uuid,uuid,bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_history(s uuid,e uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);PERFORM workspace_private.s04_event_get(s,e);SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY version DESC),'[]')INTO v FROM(SELECT h.version,h.action,h.start_at,h.end_at,h.all_day,h.status,h.created_at,m.member_code FROM workspace.shared_event_history h JOIN workspace.school_memberships m ON m.school_id=h.school_id AND m.id=h.actor_id WHERE h.school_id=s AND h.event_id=e ORDER BY version DESC LIMIT 50)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_event_history(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_expand(s uuid,ids uuid[],roles text[])RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE out_ids uuid[];m uuid;BEGIN
 IF ids IS NULL OR roles IS NULL OR cardinality(ids)>50 OR cardinality(roles)>3 OR array_position(ids,NULL)IS NOT NULL OR array_position(roles,NULL)IS NOT NULL OR EXISTS(SELECT 1 FROM unnest(roles)q WHERE q NOT IN('SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT')) THEN RAISE EXCEPTION 'input_rejected';END IF;
 FOREACH m IN ARRAY ids LOOP IF workspace_private.s03_valid_epoch(s,m)IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;END LOOP;
 SELECT array_agg(x.id ORDER BY x.id)INTO out_ids FROM(SELECT DISTINCT m.id FROM workspace.school_memberships m WHERE m.school_id=s AND(m.id=ANY(ids)OR m.role=ANY(roles))AND workspace_private.s03_valid_epoch(s,m.id)=m.epoch)x;
 IF out_ids IS NULL OR cardinality(out_ids)>200 THEN RAISE EXCEPTION 'input_rejected';END IF;RETURN out_ids;END$$;
ALTER FUNCTION workspace_private.s04_expand(uuid,uuid[],text[])OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_publish(s uuid,h uuid,v bigint,t text,b text,ids uuid[],roles text[],targets uuid[])RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE a uuid;e integer;BEGIN
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.handover_revisions(school_id,handover_id,version,title,body,actor_id,actor_epoch,target_roles,explicit_targets)VALUES(s,h,v,t,b,a,e,roles,ids);
 INSERT INTO workspace.handover_targets(school_id,handover_id,revision,membership_id,epoch,role_at_publish)SELECT s,h,v,m.id,m.epoch,m.role FROM workspace.school_memberships m WHERE m.school_id=s AND m.id=ANY(targets);
END$$;
ALTER FUNCTION workspace_private.s04_publish(uuid,uuid,bigint,text,text,uuid[],text[],uuid[])OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_json(s uuid,h uuid)RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(n)||jsonb_build_object('title',r.title,'body',r.body,'target_roles',r.target_roles,'explicit_targets',r.explicit_targets,
 'can_edit',workspace_private.s04_editable(s,h),'can_complete',workspace_private.s04_completable(s,h,n.content_revision),
 'ack_required',workspace_private.s04_target(s,h,n.content_revision),
 'acknowledged',EXISTS(SELECT 1 FROM workspace.handover_acknowledgements a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id AND m.epoch=a.epoch WHERE a.school_id=s AND a.handover_id=h AND a.revision=n.content_revision AND m.actor_id=workspace_private.actor()),
 'author_code',(SELECT member_code FROM workspace.school_memberships WHERE school_id=s AND id=n.created_by),
 'targets',(SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id',q.membership_id,'epoch',q.epoch,'member_code',m.member_code,'role_at_publish',q.role_at_publish,'active',coalesce(workspace_private.s03_valid_epoch(s,q.membership_id)=q.epoch,false),'acknowledged',EXISTS(SELECT 1 FROM workspace.handover_acknowledgements a WHERE a.school_id=q.school_id AND a.handover_id=q.handover_id AND a.revision=q.revision AND a.membership_id=q.membership_id AND a.epoch=q.epoch))ORDER BY m.member_code),'[]')FROM workspace.handover_targets q JOIN workspace.school_memberships m ON m.school_id=q.school_id AND m.id=q.membership_id WHERE q.school_id=s AND q.handover_id=h AND q.revision=n.content_revision))
 FROM workspace.handover_notes n JOIN workspace.handover_revisions r ON r.school_id=n.school_id AND r.handover_id=n.handover_id AND r.version=n.content_revision WHERE n.school_id=s AND n.handover_id=h $$;
ALTER FUNCTION workspace_private.s04_note_json(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_list(s uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT coalesce(jsonb_agg(q.data ORDER BY q.needs_ack DESC,q.created_at DESC),'[]')INTO v FROM(SELECT workspace_private.s04_note_json(s,n.handover_id)data,n.created_at,
 workspace_private.s04_target(s,n.handover_id,n.content_revision)AND NOT EXISTS(SELECT 1 FROM workspace.handover_acknowledgements a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id AND m.epoch=a.epoch WHERE a.school_id=s AND a.handover_id=n.handover_id AND a.revision=n.content_revision AND m.actor_id=workspace_private.actor())needs_ack
 FROM workspace.handover_notes n WHERE n.school_id=s ORDER BY needs_ack DESC,n.created_at DESC LIMIT 100)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_note_list(uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_get(s uuid,h uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);v:=workspace_private.s04_note_json(s,h);IF v IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_note_get(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_create(s uuid,t text,b text,ids uuid[],roles text[],ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE h uuid:=gen_random_uuid();a uuid;e integer;p jsonb;v jsonb;targets uuid[];BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_create_allowed(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s04_safe(t,b) THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(t,b,ids,roles,ev));v:=workspace_private.receipt(s,r,'s04_note_create',p);IF v IS NOT NULL THEN RETURN v;END IF;IF ev<>0 OR ev IS NULL THEN RAISE EXCEPTION 'conflict';END IF;
 targets:=workspace_private.s04_expand(s,ids,roles);SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF workspace_private.member_role(s)='HEALTH_ASSISTANT'AND NOT(a=ANY(targets))THEN RAISE EXCEPTION 'access_denied';END IF;
 INSERT INTO workspace.handover_notes(handover_id,school_id,created_by,created_by_epoch,updated_by,updated_by_epoch)VALUES(h,s,a,e,a,e);
 PERFORM workspace_private.s04_publish(s,h,1,t,b,ids,roles,targets);
 RETURN workspace_private.finish(s,r,'s04_note_create',p,jsonb_build_object('handover_id',h,'version',1),h);END$$;
ALTER FUNCTION workspace_private.s04_note_create(uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_edit(s uuid,h uuid,t text,b text,ids uuid[],roles text[],ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE n workspace.handover_notes;a uuid;e integer;p jsonb;v jsonb;targets uuid[];BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_editable(s,h) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s04_safe(t,b) THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(h,t,b,ids,roles,ev));v:=workspace_private.receipt(s,r,'s04_note_edit',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT *INTO n FROM workspace.handover_notes WHERE school_id=s AND handover_id=h FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF n.version IS DISTINCT FROM ev THEN RAISE EXCEPTION 'conflict';END IF;
 targets:=workspace_private.s04_expand(s,ids,roles);SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 PERFORM workspace_private.s04_publish(s,h,ev+1,t,b,ids,roles,targets);
 UPDATE workspace.handover_notes SET version=version+1,content_revision=version+1,status='OPEN',completed_at=NULL,completed_by=NULL,completed_by_epoch=NULL,updated_by=a,updated_by_epoch=e,updated_at=clock_timestamp()WHERE school_id=s AND handover_id=h;
 RETURN workspace_private.finish(s,r,'s04_note_edit',p,jsonb_build_object('handover_id',h,'version',ev+1),h);END$$;
ALTER FUNCTION workspace_private.s04_note_edit(uuid,uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_ack(s uuid,h uuid,mid uuid,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE n workspace.handover_notes;a uuid;e integer;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();IF mid IS DISTINCT FROM a THEN RAISE EXCEPTION 'access_denied';END IF;
 SELECT *INTO n FROM workspace.handover_notes WHERE school_id=s AND handover_id=h;IF NOT FOUND OR NOT workspace_private.s04_target(s,h,n.content_revision)THEN RAISE EXCEPTION 'access_denied';END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(h,a,e,ev,n.content_revision));v:=workspace_private.receipt(s,r,'s04_note_ack',p);IF v IS NOT NULL THEN RETURN v;END IF;IF n.version IS DISTINCT FROM ev THEN RAISE EXCEPTION 'conflict';END IF;
 INSERT INTO workspace.handover_acknowledgements(school_id,handover_id,revision,membership_id,epoch)VALUES(s,h,n.content_revision,a,e)ON CONFLICT DO NOTHING;
 RETURN workspace_private.finish(s,r,'s04_note_ack',p,jsonb_build_object('acknowledged',true,'revision',n.content_revision),h);END$$;
ALTER FUNCTION workspace_private.s04_note_ack(uuid,uuid,uuid,bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_complete(s uuid,h uuid,done boolean,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE n workspace.handover_notes;a uuid;e integer;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT *INTO n FROM workspace.handover_notes WHERE school_id=s AND handover_id=h FOR UPDATE;
 IF NOT FOUND OR NOT workspace_private.s04_completable(s,h,n.content_revision) OR done IS NULL OR(NOT done AND NOT workspace_private.admin(s))THEN RAISE EXCEPTION 'access_denied';END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(h,done,ev,n.content_revision));v:=workspace_private.receipt(s,r,'s04_note_complete',p);IF v IS NOT NULL THEN RETURN v;END IF;IF n.version IS DISTINCT FROM ev THEN RAISE EXCEPTION 'conflict';END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 UPDATE workspace.handover_notes SET status=CASE WHEN done THEN 'COMPLETED' ELSE 'OPEN' END,completed_at=CASE WHEN done THEN clock_timestamp() ELSE NULL END,completed_by=CASE WHEN done THEN a ELSE NULL END,completed_by_epoch=CASE WHEN done THEN e ELSE NULL END,version=version+1,updated_by=a,updated_by_epoch=e,updated_at=clock_timestamp()WHERE school_id=s AND handover_id=h;
 RETURN workspace_private.finish(s,r,'s04_note_complete',p,jsonb_build_object('handover_id',h,'version',ev+1),h);END$$;
ALTER FUNCTION workspace_private.s04_note_complete(uuid,uuid,boolean,bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_history(s uuid,h uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);PERFORM workspace_private.s04_note_get(s,h);
 SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY version DESC),'[]')INTO v FROM(SELECT r.version,r.title,r.body,r.created_at,m.member_code FROM workspace.handover_revisions r JOIN workspace.school_memberships m ON m.school_id=r.school_id AND m.id=r.actor_id WHERE r.school_id=s AND r.handover_id=h ORDER BY version DESC LIMIT 50)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_note_history(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_context(s uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT jsonb_build_object('membership_id',m.id,'epoch',m.epoch,'role',m.role,'can_create_handover',workspace_private.s04_create_allowed(s),'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'epoch',x.epoch,'member_code',x.member_code,'role',x.role)ORDER BY x.member_code),'[]')FROM workspace.school_memberships x WHERE x.school_id=s AND workspace_private.s03_valid_epoch(s,x.id)=x.epoch))INTO v FROM workspace.school_memberships m WHERE m.school_id=s AND m.actor_id=workspace_private.actor();RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_context(uuid)OWNER TO ws_runtime;
-- Fixed identity/version stamps also protect internal runtime writes.
CREATE FUNCTION workspace_private.s04_guard()RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE a uuid;e integer;BEGIN
 IF TG_TABLE_NAME='shared_events' THEN
 IF NEW.school_id<>OLD.school_id OR NEW.event_id<>OLD.event_id OR NEW.created_by<>OLD.created_by OR NEW.created_by_epoch<>OLD.created_by_epoch OR NEW.created_at<>OLD.created_at OR NOT workspace_private.s04_manage(OLD.school_id)THEN RAISE EXCEPTION 'access_denied';END IF;
 ELSE
 IF NEW.school_id<>OLD.school_id OR NEW.handover_id<>OLD.handover_id OR NEW.created_by<>OLD.created_by OR NEW.created_by_epoch<>OLD.created_by_epoch OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NEW.content_revision<>OLD.content_revision THEN IF NOT workspace_private.s04_editable(OLD.school_id,OLD.handover_id)OR NEW.content_revision<>OLD.version+1 THEN RAISE EXCEPTION 'access_denied';END IF;
 ELSE IF NOT workspace_private.s04_completable(OLD.school_id,OLD.handover_id,OLD.content_revision)THEN RAISE EXCEPTION 'access_denied';END IF;END IF;
 END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=OLD.school_id AND actor_id=workspace_private.actor();NEW.updated_by:=a;NEW.updated_by_epoch:=e;NEW.updated_at:=clock_timestamp();NEW.version:=OLD.version+1;RETURN NEW;END$$;
ALTER FUNCTION workspace_private.s04_guard()OWNER TO ws_runtime;
CREATE TRIGGER s04_events_identity BEFORE UPDATE ON workspace.shared_events FOR EACH ROW EXECUTE FUNCTION workspace_private.s04_guard();
CREATE TRIGGER s04_notes_identity BEFORE UPDATE ON workspace.handover_notes FOR EACH ROW EXECUTE FUNCTION workspace_private.s04_guard();
DO $$DECLARE x record;BEGIN FOR x IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' AND p.proname LIKE 's04_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ws_runtime',x.sig);END LOOP;END$$;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_list(uuid,timestamptz,timestamptz)TO authenticated;
CREATE FUNCTION public.ws_v1_list_events(p_school_id uuid,p_from timestamptz,p_to timestamptz)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_list(p_school_id,p_from,p_to)$$;
ALTER FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_get(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_get_event(p_school_id uuid,p_event_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_get(p_school_id,p_event_id)$$;
ALTER FUNCTION public.ws_v1_get_event(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_event(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_event(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_save(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_save_event(p_school_id uuid,p_event_id uuid,p_title text,p_description text,p_start_at timestamptz,p_end_at timestamptz,p_all_day boolean,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_save(p_school_id,p_event_id,p_title,p_description,p_start_at,p_end_at,p_all_day,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_save_event(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_save_event(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_save_event(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_cancel(uuid,uuid,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_cancel_event(p_school_id uuid,p_event_id uuid,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_cancel(p_school_id,p_event_id,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_cancel_event(uuid,uuid,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_cancel_event(uuid,uuid,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_cancel_event(uuid,uuid,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_history(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_list_event_history(p_school_id uuid,p_event_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_history(p_school_id,p_event_id)$$;
ALTER FUNCTION public.ws_v1_list_event_history(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_event_history(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_event_history(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_list(uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_list_handovers(p_school_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_list(p_school_id)$$;
ALTER FUNCTION public.ws_v1_list_handovers(uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_handovers(uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_handovers(uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_get(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_get_handover(p_school_id uuid,p_handover_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_get(p_school_id,p_handover_id)$$;
ALTER FUNCTION public.ws_v1_get_handover(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_handover(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_handover(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_create(uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_create_handover(p_school_id uuid,p_title text,p_body text,p_member_ids uuid[],p_target_roles text[],p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_create(p_school_id,p_title,p_body,p_member_ids,p_target_roles,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_edit(uuid,uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_edit_handover(p_school_id uuid,p_handover_id uuid,p_title text,p_body text,p_member_ids uuid[],p_target_roles text[],p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_edit(p_school_id,p_handover_id,p_title,p_body,p_member_ids,p_target_roles,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_ack(uuid,uuid,uuid,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_ack_handover(p_school_id uuid,p_handover_id uuid,p_membership_id uuid,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_ack(p_school_id,p_handover_id,p_membership_id,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_complete(uuid,uuid,boolean,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_complete_handover(p_school_id uuid,p_handover_id uuid,p_completed boolean,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_complete(p_school_id,p_handover_id,p_completed,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_history(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_list_handover_history(p_school_id uuid,p_handover_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_history(p_school_id,p_handover_id)$$;
ALTER FUNCTION public.ws_v1_list_handover_history(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_handover_history(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_handover_history(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_context(uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_get_activity_context(p_school_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_context(p_school_id)$$;
ALTER FUNCTION public.ws_v1_get_activity_context(uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_activity_context(uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_activity_context(uuid)TO authenticated;
COMMIT;
