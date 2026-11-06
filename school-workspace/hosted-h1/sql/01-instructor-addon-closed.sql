-- H1 REVIEW ONLY: separate two-RPC addon, never part of the D0 manifest54.
-- No automatic operating install/activation. Parent D0 is required CLOSED.
BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(hashtextextended('bogunon:h1:instructor',0));
DO $guard$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR current_setting('bogunon.h1_plan',true)IS DISTINCT FROM 'REVIEW-CLOSED' THEN RAISE EXCEPTION 'h1_explicit_review_required';END IF;
 SET LOCAL ROLE ws_owner;
 IF (SELECT count(*)FROM workspace_private.h3_rpc_manifest)<>54 OR NOT EXISTS(SELECT 1 FROM workspace_private.h3_release WHERE state='closed' AND digest='16243d5a443e6b7d40fc92a1ea14f3cd451798583aca740f3f1550d80354360f')THEN RAISE EXCEPTION 'd0_closed_parent_required';END IF;RESET ROLE;
 IF to_regnamespace('workspace_instructor')IS NOT NULL OR to_regnamespace('workspace_instructor_private')IS NOT NULL OR to_regprocedure('public.ws_v1_instructor_read(uuid,text)')IS NOT NULL OR to_regprocedure('public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid)')IS NOT NULL THEN RAISE EXCEPTION 'addon_already_present_review_required';END IF;
END$guard$;
CREATE SCHEMA workspace_instructor AUTHORIZATION ws_owner;
CREATE SCHEMA workspace_instructor_private AUTHORIZATION ws_owner;
REVOKE ALL ON SCHEMA workspace_instructor,workspace_instructor_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA workspace_instructor,workspace_instructor_private TO ws_runtime;
SET LOCAL ROLE ws_owner;
CREATE TABLE workspace_instructor_private.release(state text PRIMARY KEY CHECK(state IN('closed','active')));
ALTER TABLE workspace_instructor_private.release ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_instructor_private.release FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON workspace_instructor_private.release TO ws_owner USING(true)WITH CHECK(true);
REVOKE ALL ON workspace_instructor_private.release FROM PUBLIC,anon,authenticated,service_role,ws_runtime;
INSERT INTO workspace_instructor_private.release VALUES('closed');
CREATE FUNCTION workspace_instructor_private.parent_open()RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM workspace_private.h3_release WHERE state='active')OR NOT EXISTS(SELECT 1 FROM workspace_instructor_private.release WHERE state='active')THEN RAISE EXCEPTION 'workspace_closed';END IF;
END$guard$;
REVOKE ALL ON FUNCTION workspace_instructor_private.parent_open()FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION workspace_instructor_private.parent_open()TO ws_runtime;
RESET ROLE;
SET ROLE ws_owner;
CREATE TABLE workspace_instructor.instructor_schedules(
 school_id uuid PRIMARY KEY REFERENCES workspace.schools(id),
 settings jsonb NOT NULL,logs jsonb NOT NULL DEFAULT '[]',version bigint NOT NULL CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(jsonb_typeof(settings)='object'),CHECK(jsonb_typeof(logs)='array' AND jsonb_array_length(logs)<=5000));
ALTER TABLE workspace_instructor.instructor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_instructor.instructor_schedules FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON workspace_instructor.instructor_schedules TO ws_runtime;
CREATE POLICY instructor_read ON workspace_instructor.instructor_schedules FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY instructor_insert ON workspace_instructor.instructor_schedules FOR INSERT TO ws_runtime WITH CHECK(workspace_private.member_role(school_id) IN('HEALTH_TEACHER','SCHOOL_ADMIN'));
CREATE POLICY instructor_update ON workspace_instructor.instructor_schedules FOR UPDATE TO ws_runtime USING(workspace_private.member_role(school_id) IN('HEALTH_TEACHER','SCHOOL_ADMIN')) WITH CHECK(workspace_private.member_role(school_id) IN('HEALTH_TEACHER','SCHOOL_ADMIN'));
RESET ROLE;
CREATE FUNCTION workspace_instructor_private.instructor_validate(settings jsonb,logs jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE k text;n numeric;l jsonb;seen text[]:='{}';ident text;BEGIN
 IF jsonb_typeof(settings)<>'object' OR jsonb_typeof(logs)<>'array' OR jsonb_array_length(logs)>5000 OR octet_length(logs::text)>4000000 THEN RAISE EXCEPTION 'input_rejected';END IF;
 IF (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(settings)x) IS DISTINCT FROM ARRAY['hourlyRate','id','monthlyHourLimit','monthlyInsurance','name','operationEndDate','operationStartDate','subject','totalBudget','weeklyHourLimit','weeklyHours'] THEN RAISE EXCEPTION 'input_rejected';END IF;
 FOREACH k IN ARRAY ARRAY['id','name','subject','operationStartDate','operationEndDate'] LOOP IF jsonb_typeof(settings->k)<>'string' THEN RAISE EXCEPTION 'input_rejected';END IF;END LOOP;
 PERFORM (settings->>'id')::uuid;
 IF length(btrim(settings->>'name')) NOT BETWEEN 1 AND 120 OR length(btrim(settings->>'subject')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'input_rejected';END IF;
 FOREACH k IN ARRAY ARRAY['hourlyRate','monthlyHourLimit','monthlyInsurance','totalBudget','weeklyHourLimit','weeklyHours'] LOOP
  IF jsonb_typeof(settings->k)<>'number' THEN RAISE EXCEPTION 'input_rejected';END IF;n:=(settings->>k)::numeric;
  IF n<0 OR round(n,2)<>n OR n>(CASE WHEN k='weeklyHours' OR k='weeklyHourLimit' THEN 168 WHEN k='monthlyHourLimit' THEN 744 WHEN k='totalBudget' THEN 999999999999.99 ELSE 9999999999.99 END) OR (k IN('weeklyHourLimit','monthlyHourLimit') AND n=0) THEN RAISE EXCEPTION 'input_rejected';END IF;
 END LOOP;
 IF settings->>'operationStartDate' !~ '^\d{4}-\d{2}-\d{2}$' OR settings->>'operationEndDate' !~ '^\d{4}-\d{2}-\d{2}$' OR (settings->>'operationEndDate')::date<(settings->>'operationStartDate')::date THEN RAISE EXCEPTION 'input_rejected';END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(logs) LOOP
  IF jsonb_typeof(l)<>'object' OR (SELECT array_agg(x ORDER BY x)FROM jsonb_object_keys(l)x) IS DISTINCT FROM ARRAY['date','endTime','id','instructorId','note','startTime'] OR l->>'instructorId' IS DISTINCT FROM settings->>'id' THEN RAISE EXCEPTION 'input_rejected';END IF;
  FOREACH k IN ARRAY ARRAY['id','instructorId','date','startTime','endTime'] LOOP IF jsonb_typeof(l->k)<>'string' THEN RAISE EXCEPTION 'input_rejected';END IF;END LOOP;
  PERFORM (l->>'id')::uuid;
  IF l->>'id'=ANY(seen) THEN RAISE EXCEPTION 'input_rejected';END IF;seen:=array_append(seen,l->>'id');
  IF l->>'date' !~ '^\d{4}-\d{2}-\d{2}$' OR l->>'startTime' !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' OR l->>'endTime' !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' OR (l->>'endTime')::time<=(l->>'startTime')::time OR jsonb_typeof(l->'note') NOT IN('string','null') OR length(l->>'note')>2000 THEN RAISE EXCEPTION 'input_rejected';END IF;
  PERFORM (l->>'date')::date;
 END LOOP;
END$$;
ALTER FUNCTION workspace_instructor_private.instructor_validate(jsonb,jsonb) OWNER TO ws_runtime;
CREATE FUNCTION workspace_instructor_private.instructor_read(s uuid,m text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace_instructor.instructor_schedules;role text;rows jsonb;BEGIN
 PERFORM workspace_instructor_private.parent_open();PERFORM workspace_private.enter(s);role:=workspace_private.member_role(s);
 IF role NOT IN('SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT') THEN RAISE EXCEPTION 'access_denied';END IF;
 IF m IS NULL OR m !~ '^\d{4}-(0[1-9]|1[0-2])$' OR left(m,4)::integer<100 THEN RAISE EXCEPTION 'input_rejected';END IF;
 SELECT * INTO x FROM workspace_instructor.instructor_schedules WHERE school_id=s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',l->>'id','date',l->>'date','startTime',l->>'startTime','endTime',l->>'endTime') ORDER BY l->>'date',l->>'startTime'),'[]') INTO rows FROM jsonb_array_elements(coalesce(x.logs,'[]'))l WHERE left(l->>'date',7)=m;
 RETURN jsonb_build_object('school',s,'month',m,'role',role,'version',coalesce(x.version,0),'name',coalesce(x.settings->>'name',''),'schedule',rows,'instructor',CASE WHEN role IN('SCHOOL_ADMIN','HEALTH_TEACHER') THEN x.settings ELSE NULL END,'logs',CASE WHEN role IN('SCHOOL_ADMIN','HEALTH_TEACHER') THEN coalesce(x.logs,'[]') ELSE '[]'::jsonb END);
END$$;
ALTER FUNCTION workspace_instructor_private.instructor_read(uuid,text) OWNER TO ws_runtime;
CREATE FUNCTION workspace_instructor_private.instructor_write(s uuid,k text,payload jsonb,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace_instructor.instructor_schedules;st jsonb;ls jsonb;l jsonb;id text;ident text;h jsonb;v jsonb;BEGIN
 PERFORM workspace_instructor_private.parent_open();PERFORM workspace_private.enter(s);
 IF workspace_private.member_role(s) NOT IN('SCHOOL_ADMIN','HEALTH_TEACHER') THEN RAISE EXCEPTION 'access_denied';END IF;
 IF k IS NULL OR k NOT IN('settings','save','delete','import') OR payload IS NULL OR octet_length(payload::text)>1048576 OR ev IS NULL OR ev<0 THEN RAISE EXCEPTION 'input_rejected';END IF;
 h:=workspace_private.s03_hash(jsonb_build_array(k,payload,ev));v:=workspace_private.receipt(s,r,'instructor_write',h);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace_instructor.instructor_schedules WHERE school_id=s FOR UPDATE;
 IF coalesce(x.version,0)<>ev THEN RAISE EXCEPTION 'conflict';END IF;st:=x.settings;ls:=coalesce(x.logs,'[]');
 IF k='settings' THEN st:=payload||jsonb_build_object('id',coalesce(x.settings->>'id',gen_random_uuid()::text));
 ELSE
  IF st IS NULL THEN RAISE EXCEPTION 'input_rejected';END IF;
  IF k='delete' THEN
   IF jsonb_typeof(payload)<>'object' OR payload - 'id'<>'{}' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ls)z WHERE z->>'id'=payload->>'id') THEN RAISE EXCEPTION 'input_rejected';END IF;
   SELECT coalesce(jsonb_agg(z),'[]')INTO ls FROM jsonb_array_elements(ls)z WHERE z->>'id'<>payload->>'id';
  ELSE
   IF k='import' AND (jsonb_typeof(payload)<>'array' OR jsonb_array_length(payload)>1000) THEN RAISE EXCEPTION 'input_rejected';END IF;
   FOR l IN SELECT value FROM jsonb_array_elements(CASE WHEN k='save' THEN jsonb_build_array(payload) ELSE payload END) LOOP
    id:=l->>'id';IF k='import' AND l?'id' THEN RAISE EXCEPTION 'input_rejected';END IF;
    IF id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ls)z WHERE z->>'id'=id) THEN RAISE EXCEPTION 'input_rejected';END IF;
    ident:=concat_ws('|',l->>'instructorId',l->>'date',l->>'startTime',l->>'endTime');
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(ls)z WHERE concat_ws('|',z->>'instructorId',z->>'date',z->>'startTime',z->>'endTime')=ident AND z->>'id' IS DISTINCT FROM id) THEN RAISE EXCEPTION 'conflict';END IF;
    SELECT coalesce(jsonb_agg(z),'[]')INTO ls FROM jsonb_array_elements(ls)z WHERE z->>'id' IS DISTINCT FROM id;
    ls:=ls||jsonb_build_array(l||jsonb_build_object('id',coalesce(id,gen_random_uuid()::text)));
   END LOOP;
  END IF;
 END IF;
 PERFORM workspace_instructor_private.instructor_validate(st,ls);
 INSERT INTO workspace_instructor.instructor_schedules(school_id,settings,logs,version)VALUES(s,st,ls,ev+1)ON CONFLICT(school_id)DO UPDATE SET settings=excluded.settings,logs=excluded.logs,version=excluded.version,updated_at=clock_timestamp();
 RETURN workspace_private.finish(s,r,'instructor_write',h,jsonb_build_object('version',ev+1));
END$$;
ALTER FUNCTION workspace_instructor_private.instructor_write(uuid,text,jsonb,bigint,uuid) OWNER TO ws_runtime;
REVOKE ALL ON FUNCTION workspace_instructor_private.instructor_validate(jsonb,jsonb),workspace_instructor_private.instructor_read(uuid,text),workspace_instructor_private.instructor_write(uuid,text,jsonb,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_instructor_private.instructor_read(uuid,text),workspace_instructor_private.instructor_write(uuid,text,jsonb,bigint,uuid) TO ws_runtime;
CREATE FUNCTION public.ws_v1_instructor_read(p_school_id uuid,p_month text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT workspace_instructor_private.instructor_read(p_school_id,p_month)$$;
CREATE FUNCTION public.ws_v1_instructor_write(p_school_id uuid,p_kind text,p_payload jsonb,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT workspace_instructor_private.instructor_write(p_school_id,p_kind,p_payload,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_instructor_read(uuid,text) OWNER TO ws_owner;
ALTER FUNCTION public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_instructor_read(uuid,text),public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid) FROM PUBLIC,anon;



REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workspace_instructor_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.ws_v1_instructor_read(uuid,text),public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
DO $acl$DECLARE x record;BEGIN
 FOR x IN SELECT p.oid::regprocedure AS sig,a.grantee FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a WHERE (n.nspname='workspace_instructor_private' OR(n.nspname='public'AND p.proname IN('ws_v1_instructor_read','ws_v1_instructor_write')))AND a.grantee<>p.proowner AND a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='ws_runtime') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',x.sig,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee))END);
 END LOOP;
 FOR x IN SELECT c.oid::regclass AS rel,a.grantee FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE n.nspname IN('workspace_instructor','workspace_instructor_private')AND c.relkind='r'AND a.grantee<>c.relowner AND a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='ws_runtime') LOOP
 EXECUTE format('REVOKE ALL ON TABLE %s FROM %s',x.rel,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee))END);
 END LOOP;
END$acl$;
COMMIT;
