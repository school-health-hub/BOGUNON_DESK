-- REVIEW ONLY: separate operating target + metadata read approval required.
-- Catalog metadata only. No Auth/application rows, function bodies, secrets or role passwords.
-- PostgreSQL 17 catalog fields; stop and review on incompatible server versions.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='1s';
SET LOCAL search_path=pg_catalog;
SELECT current_database(),current_user,session_user,current_setting('server_version');
SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl FROM pg_namespace
WHERE nspname IN('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap','workspace_instructor','workspace_instructor_private');
SELECT rolname,rolsuper,rolbypassrls,rolcanlogin,rolcreaterole,rolinherit FROM pg_roles
WHERE rolname IN('postgres','ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator','ws_h3_installer');
SELECT pg_get_userbyid(roleid) AS granted_role,pg_get_userbyid(member) AS member,admin_option,inherit_option,set_option
FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE left(rolname,3)='ws_') OR member IN(SELECT oid FROM pg_roles WHERE left(rolname,3)='ws_');
-- Report every overload sharing a reserved name; absence is not operating readiness.
WITH expected(boundary,name,args) AS (VALUES
 ('SCHOOL54','ws_c_membership_status','uuid'),
 ('SCHOOL54','ws_s02_admin','uuid'),
 ('SCHOOL54','ws_s02_directory','text, text'),
 ('SCHOOL54','ws_s02_expiry','uuid, uuid, timestamp with time zone, bigint, uuid'),
 ('SCHOOL54','ws_s02_self',''),
 ('SCHOOL54','ws_s02_space','uuid, uuid'),
 ('SCHOOL54','ws_s02_transfers','uuid'),
 ('SCHOOL54','ws_s02_withdraw','uuid, uuid, bigint, uuid'),
 ('SCHOOL54','ws_v1_accept_admin_change','uuid, uuid, bigint, uuid'),
 ('SCHOOL54','ws_v1_ack_handover','uuid, uuid, uuid, bigint, uuid'),
 ('SCHOOL54','ws_v1_adjust_inventory','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_assign_task','uuid, uuid, uuid[], bigint, uuid'),
 ('SCHOOL54','ws_v1_bootstrap',''),
 ('SCHOOL54','ws_v1_cancel_event','uuid, uuid, bigint, uuid'),
 ('SCHOOL54','ws_v1_change_assigned_task_status','uuid, uuid, text, bigint, uuid'),
 ('SCHOOL54','ws_v1_close_task','uuid, uuid, text, bigint, uuid'),
 ('SCHOOL54','ws_v1_complete_handover','uuid, uuid, boolean, bigint, uuid'),
 ('SCHOOL54','ws_v1_create_handover','uuid, text, text, uuid[], text[], bigint, uuid'),
 ('SCHOOL54','ws_v1_create_inventory_item','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_create_task','uuid, text, text, text, date, uuid[], uuid'),
 ('SCHOOL54','ws_v1_decide_join','uuid, uuid, text, text, timestamp with time zone, bigint, uuid'),
 ('SCHOOL54','ws_v1_dispose_inventory','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_edit_handover','uuid, uuid, text, text, uuid[], text[], bigint, uuid'),
 ('SCHOOL54','ws_v1_edit_inventory_item','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_edit_task','uuid, uuid, text, text, text, date, bigint, uuid'),
 ('SCHOOL54','ws_v1_get_activity_context','uuid'),
 ('SCHOOL54','ws_v1_get_context','uuid'),
 ('SCHOOL54','ws_v1_get_event','uuid, uuid'),
 ('SCHOOL54','ws_v1_get_handover','uuid, uuid'),
 ('SCHOOL54','ws_v1_get_inventory_context','uuid, jsonb'),
 ('SCHOOL54','ws_v1_get_inventory_item','uuid, jsonb'),
 ('SCHOOL54','ws_v1_get_task','uuid, uuid'),
 ('SCHOOL54','ws_v1_leave_school','uuid, bigint, uuid'),
 ('SCHOOL54','ws_v1_list_event_history','uuid, uuid'),
 ('SCHOOL54','ws_v1_list_events','uuid, timestamp with time zone, timestamp with time zone'),
 ('SCHOOL54','ws_v1_list_handover_history','uuid, uuid'),
 ('SCHOOL54','ws_v1_list_handovers','uuid'),
 ('SCHOOL54','ws_v1_list_inventory_alerts','uuid, jsonb'),
 ('SCHOOL54','ws_v1_list_inventory_items','uuid, jsonb'),
 ('SCHOOL54','ws_v1_list_inventory_locations','uuid, jsonb'),
 ('SCHOOL54','ws_v1_list_inventory_lots','uuid, jsonb'),
 ('SCHOOL54','ws_v1_list_inventory_movements','uuid, jsonb'),
 ('SCHOOL54','ws_v1_list_task_history','uuid, uuid'),
 ('SCHOOL54','ws_v1_list_tasks','uuid, text, text, text, boolean'),
 ('SCHOOL54','ws_v1_propose_admin_change','uuid, uuid, text, uuid'),
 ('SCHOOL54','ws_v1_receive_inventory','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_request_join','uuid, text, uuid'),
 ('SCHOOL54','ws_v1_revoke_current_session','uuid'),
 ('SCHOOL54','ws_v1_save_event','uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, boolean, bigint, uuid'),
 ('SCHOOL54','ws_v1_save_inventory_location','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_set_inventory_lot_state','uuid, jsonb, bigint, uuid'),
 ('SCHOOL54','ws_v1_set_member_role','uuid, uuid, text, bigint, uuid'),
 ('SCHOOL54','ws_v1_set_membership_state','uuid, uuid, text, bigint, uuid'),
 ('SCHOOL54','ws_v1_use_inventory','uuid, jsonb, bigint, uuid'),
 ('INSTRUCTOR2','ws_v1_instructor_read','uuid, text'),
 ('INSTRUCTOR2','ws_v1_instructor_write','uuid, text, jsonb, bigint, uuid')
)
SELECT e.boundary,e.name,e.args AS expected_types,oidvectortypes(p.proargtypes) AS existing_types,
 p.oid IS NOT NULL AS name_present,coalesce(oidvectortypes(p.proargtypes)=e.args,false) AS exact_signature,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl,pg_get_function_result(p.oid) AS returns
FROM expected e LEFT JOIN (pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public') ON p.proname=e.name
ORDER BY e.boundary,e.name,existing_types;
-- Effective EXECUTE includes privileges inherited through PUBLIC and roles.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS args,r.rolname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,has_function_privilege(r.oid,p.oid,'EXECUTE') AS effective_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
WHERE (n.nspname IN('workspace_private','workspace_bootstrap','workspace_auth_bridge','workspace_instructor_private') OR (n.nspname='public' AND left(p.proname,3)='ws_'))
AND r.rolname IN('anon','authenticated','service_role','ws_owner','ws_runtime','ws_authz_reader') ORDER BY n.nspname,p.proname,r.rolname;
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap','workspace_instructor','workspace_instructor_private') AND c.relkind='r';
SELECT pg_get_userbyid(d.defaclrole) AS creator,coalesce(n.nspname,'GLOBAL') AS schema,d.defaclobjtype,d.defaclacl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace;
SELECT extname,extversion FROM pg_extension ORDER BY extname;
ROLLBACK;
