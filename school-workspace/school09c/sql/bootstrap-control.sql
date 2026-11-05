-- Draft policy executable ONLY in isolation. Two independently provisioned DB operator principals.
-- No public RPC, no end-user operation, no service_role request path, no real verification asserted.
CREATE ROLE ws_bootstrap_executor NOLOGIN NOBYPASSRLS;
CREATE ROLE ws_bootstrap_operator NOLOGIN NOBYPASSRLS;
CREATE SCHEMA workspace_bootstrap AUTHORIZATION ws_owner;
REVOKE ALL ON SCHEMA workspace_bootstrap FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader;
GRANT USAGE ON SCHEMA workspace_bootstrap TO ws_bootstrap_executor,ws_bootstrap_operator;
GRANT USAGE ON SCHEMA workspace TO ws_bootstrap_executor;
SET LOCAL ROLE ws_owner;
CREATE TABLE workspace_bootstrap.operators(db_principal name PRIMARY KEY,actor_id uuid NOT NULL UNIQUE REFERENCES workspace.accounts,active boolean NOT NULL DEFAULT true);
CREATE TABLE workspace_bootstrap.cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 first_request_id uuid NOT NULL UNIQUE REFERENCES workspace.first_admin_requests,
 target_actor_id uuid NOT NULL REFERENCES workspace.accounts,target_membership_id uuid NOT NULL,
 proposer name NOT NULL REFERENCES workspace_bootstrap.operators,approver name REFERENCES workspace_bootstrap.operators,
 evidence_sha256 text NOT NULL CHECK(evidence_sha256~'^[a-f0-9]{64}$'),consent_ref uuid NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '24 hours'),
 state text NOT NULL DEFAULT 'proposed' CHECK(state IN('proposed','approved')),version bigint NOT NULL DEFAULT 1,
 UNIQUE(school_id,id),FOREIGN KEY(school_id,target_membership_id)REFERENCES workspace.school_memberships(school_id,id),CHECK(approver IS NULL OR approver<>proposer));
CREATE UNIQUE INDEX first_bootstrap_pending ON workspace_bootstrap.cases(school_id)WHERE state='proposed';
CREATE TABLE workspace_bootstrap.receipts(operator_name name NOT NULL,request_id uuid NOT NULL,command text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(operator_name,request_id));
CREATE TABLE workspace_bootstrap.audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES workspace_bootstrap.cases,school_id uuid NOT NULL,operator_name name NOT NULL,action text NOT NULL,request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(school_id,case_id)REFERENCES workspace_bootstrap.cases(school_id,id));
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['operators','cases','receipts','audit']LOOP
 EXECUTE format('ALTER TABLE workspace_bootstrap.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE workspace_bootstrap.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON workspace_bootstrap.%I FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader,ws_bootstrap_operator',t);
 EXECUTE format('CREATE POLICY operator_exec ON workspace_bootstrap.%I TO ws_bootstrap_executor USING(true)WITH CHECK(true)',t);
END LOOP;END$$;
GRANT SELECT ON workspace_bootstrap.operators TO ws_bootstrap_executor;
GRANT SELECT,INSERT,UPDATE ON workspace_bootstrap.cases TO ws_bootstrap_executor;
GRANT SELECT,INSERT ON workspace_bootstrap.receipts TO ws_bootstrap_executor;
GRANT INSERT ON workspace_bootstrap.audit TO ws_bootstrap_executor;
GRANT SELECT ON workspace.accounts,workspace.s02_directory,workspace.schools,workspace.first_admin_requests,workspace.school_memberships,workspace.membership_terms TO ws_bootstrap_executor;
GRANT UPDATE ON workspace.schools,workspace.first_admin_requests,workspace.school_memberships TO ws_bootstrap_executor;
GRANT INSERT ON workspace.school_memberships,workspace.membership_terms,workspace.audit_entries,workspace.role_change_history TO ws_bootstrap_executor;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['accounts','s02_directory','schools','first_admin_requests','school_memberships','membership_terms','audit_entries','role_change_history']LOOP
 EXECUTE format('CREATE POLICY bootstrap_exec ON workspace.%I TO ws_bootstrap_executor USING(true)WITH CHECK(true)',t);
END LOOP;END$$;
RESET ROLE;
CREATE FUNCTION workspace_bootstrap.command(op text,s uuid,target uuid,case_id uuid,proof text,consent uuid,ev bigint,r uuid)RETURNS jsonb
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;q workspace.first_admin_requests;c workspace_bootstrap.cases;m workspace.school_memberships;
 payload_value jsonb:=jsonb_build_array(op,s,target,case_id,proof,consent,ev);v jsonb;mid uuid;cid uuid;
BEGIN
 IF NOT pg_catalog.pg_has_role(session_user,'ws_bootstrap_operator','MEMBER')THEN RAISE EXCEPTION 'operator_required';END IF;
 SELECT actor_id INTO actor FROM workspace_bootstrap.operators WHERE db_principal=session_user AND active;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE id=actor AND status='active'AND user_id IS NOT NULL)THEN RAISE EXCEPTION 'operator_required';END IF;
 IF ev IS NULL OR ev<0 THEN RAISE EXCEPTION 'expected_version_required';END IF;
 IF r IS NULL OR s IS NULL THEN RAISE EXCEPTION 'request_id_required';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('school01a:'||s::text,0));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bootstrap:'||session_user||r::text,0));
 SELECT result INTO v FROM workspace_bootstrap.receipts WHERE operator_name=session_user AND request_id=r;
 IF FOUND THEN
 IF NOT EXISTS(SELECT 1 FROM workspace_bootstrap.receipts WHERE operator_name=session_user AND request_id=r AND command=op AND receipts.payload=payload_value)THEN RAISE EXCEPTION 'idempotency_mismatch';END IF;
 RETURN v;END IF;
 IF op='propose' THEN
 IF target IS NULL OR target=actor OR proof IS NULL OR proof!~'^[a-f0-9]{64}$'OR consent IS NULL OR ev<>0 THEN RAISE EXCEPTION 'verification_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.schools z JOIN workspace.s02_directory d ON d.school_id=z.id WHERE z.id=s AND z.state='unclaimed')THEN RAISE EXCEPTION 'bootstrap_not_allowed';END IF;
 IF EXISTS(SELECT 1 FROM workspace.school_memberships WHERE school_id=s AND role='SCHOOL_ADMIN')THEN RAISE EXCEPTION 'bootstrap_not_allowed';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE id=target AND status='active'AND user_id IS NOT NULL)THEN RAISE EXCEPTION 'invalid_target';END IF;
 SELECT * INTO q FROM workspace.first_admin_requests WHERE school_id=s AND actor_id=target AND state='pending'FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_required';END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND actor_id=target;
 IF FOUND AND(m.status<>'pending'OR m.role IS NOT NULL)THEN RAISE EXCEPTION 'invalid_target';END IF;
 IF NOT FOUND THEN
 INSERT INTO workspace.school_memberships(school_id,actor_id,member_code,status)VALUES(s,target,'M-'||replace(gen_random_uuid()::text,'-',''),'pending')RETURNING *INTO m;
 INSERT INTO workspace.membership_terms(school_id,membership_id,epoch)VALUES(s,m.id,m.epoch);
 END IF;
 INSERT INTO workspace_bootstrap.cases(school_id,first_request_id,target_actor_id,target_membership_id,proposer,evidence_sha256,consent_ref)VALUES(s,q.id,target,m.id,session_user,proof,consent)RETURNING id INTO cid;
 v:=jsonb_build_object('case_id',cid,'version',1,'state','proposed');
 ELSIF op='approve' THEN
 SELECT *INTO c FROM workspace_bootstrap.cases WHERE school_id=s AND id=case_id FOR UPDATE;
 IF NOT FOUND OR c.proposer=session_user OR c.target_actor_id=actor THEN RAISE EXCEPTION 'independent_operator_required';END IF;
 IF c.state<>'proposed'OR c.version<>ev OR c.expires_at<=statement_timestamp()THEN RAISE EXCEPTION 'conflict';END IF;
 IF proof IS DISTINCT FROM c.evidence_sha256 OR consent IS DISTINCT FROM c.consent_ref OR target IS DISTINCT FROM c.target_actor_id THEN RAISE EXCEPTION 'verification_mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.schools WHERE id=s AND state='unclaimed')OR EXISTS(SELECT 1 FROM workspace.school_memberships WHERE school_id=s AND role='SCHOOL_ADMIN')THEN RAISE EXCEPTION 'bootstrap_not_allowed';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE id=c.target_actor_id AND status='active'AND user_id IS NOT NULL)THEN RAISE EXCEPTION 'invalid_target';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.first_admin_requests WHERE school_id=s AND id=c.first_request_id AND actor_id=c.target_actor_id AND state='pending')THEN RAISE EXCEPTION 'request_required';END IF;
 SELECT *INTO m FROM workspace.school_memberships WHERE school_id=s AND id=c.target_membership_id FOR UPDATE;
 IF m.status<>'pending'OR m.role IS NOT NULL THEN RAISE EXCEPTION 'invalid_target';END IF;
 UPDATE workspace.school_memberships SET role='SCHOOL_ADMIN',status='active',approved_at=clock_timestamp(),version=version+1 WHERE school_id=s AND id=m.id;
 UPDATE workspace.first_admin_requests SET state='verified',version=version+1 WHERE school_id=s AND id=c.first_request_id;
 UPDATE workspace.schools SET state='active',authz_version=authz_version+1 WHERE id=s;
 UPDATE workspace_bootstrap.cases SET state='approved',approver=session_user,version=version+1 WHERE id=c.id;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)VALUES(s,m.id,m.epoch,actor,'first_admin_bootstrap',NULL,'SCHOOL_ADMIN');
 cid:=c.id;v:=jsonb_build_object('case_id',cid,'membership_id',m.id,'state','approved','version',c.version+1);
 ELSE RAISE EXCEPTION 'invalid_command';END IF;
 INSERT INTO workspace.audit_entries(school_id,actor_id,action,request_id,entity_id)VALUES(s,actor,'first_admin_'||op,r,cid);
 INSERT INTO workspace_bootstrap.audit(case_id,school_id,operator_name,action,request_id)VALUES(cid,s,session_user,op,r);
 INSERT INTO workspace_bootstrap.receipts VALUES(session_user,r,op,payload_value,v);
 RETURN v;
END $$;
ALTER FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)OWNER TO ws_bootstrap_executor;
REVOKE ALL ON FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader,ws_bootstrap_operator;
-- Operator EXECUTE remains CLOSED until separate isolated QA activation; no end-user grant.

-- Remove any additional creator default-ACL grants, not only PUBLIC/anon/authenticated.
DO $$DECLARE g record;f oid:='workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)'::regprocedure;BEGIN
 FOR g IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f AND x.grantee<>p.proowner LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f::regprocedure,CASE WHEN g.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(g.grantee))END);
 END LOOP;
END$$;
