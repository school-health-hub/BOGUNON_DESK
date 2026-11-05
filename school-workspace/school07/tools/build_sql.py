from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1]
# CLI-created migration file is retained; body derives from reviewed source fragments.
specs={
'list_inventory_items':('read','list'), 'get_inventory_item':('read','get'), 'list_inventory_lots':('read','lots'), 'list_inventory_movements':('read','movements'),'list_inventory_alerts':('read','alerts'),'list_inventory_locations':('read','locations'),'get_inventory_context':('read','context'),
'create_inventory_item':('write','create'),'edit_inventory_item':('write','edit'),'save_inventory_location':('write','location'),'receive_inventory':('write','receive'),'use_inventory':('write','use'),'adjust_inventory':('write','adjust'),'dispose_inventory':('write','dispose'),'set_inventory_lot_state':('write','state')}
s='BEGIN;\nSET LOCAL lock_timeout=\'5s\';\nSELECT pg_advisory_xact_lock(hashtextextended(\'bogunon:school06:install\',0));\nDO $$BEGIN IF current_database()<>\'school01a\' OR current_setting(\'bogunon.ws_install_mode\',true) IS DISTINCT FROM \'isolated\' THEN RAISE EXCEPTION \'local_only\';END IF;\nIF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase=\'core\' AND state IN(\'closed\',\'active\'))THEN RAISE EXCEPTION \'school06_required\';END IF;END$$;\n'
# Keep immutable SCHOOL06 structural guard: unknown prior changes must fail.
fp=(R.parent/'school06/sql/fingerprint-expression.sql').read_text().strip().rstrip(';')
s+='DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase=\'core\'AND fingerprint='+fp+')THEN RAISE EXCEPTION \'parent_catalog_drift\';END IF;END$$;\n'
s+='\n'.join((R/'sql'/p).read_text()for p in ['tables.sql','functions.sql'])
activation=[];closure=[];contracts={}
for name,(kind,op)in specs.items():
 fields={'p_school_id':'uuid','p_payload':'jsonb'}
 if kind=='write':fields.update(p_expected_version='bigint',p_request_id='uuid')
 params=','.join(k+' '+v for k,v in fields.items());types=','.join(fields.values());args=','.join(fields);helper='s07_'+name
 s+=f"\nCREATE FUNCTION workspace_private.{helper}({params})RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$SELECT workspace_private.s07_{kind}(p_school_id,'{op}',p_payload"+(',p_expected_version,p_request_id'if kind=='write'else'')+f")$$;\nALTER FUNCTION workspace_private.{helper}({types})OWNER TO ws_runtime;\n"
 s+=f"CREATE FUNCTION public.ws_v1_{name}({params})RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.{helper}({args})$$;\nALTER FUNCTION public.ws_v1_{name}({types})OWNER TO ws_owner;\n"
 activation.append(f'GRANT EXECUTE ON FUNCTION public.ws_v1_{name}({types}),workspace_private.{helper}({types})TO authenticated;')
 closure.append(f'REVOKE ALL ON FUNCTION public.ws_v1_{name}({types}),workspace_private.{helper}({types})FROM authenticated,anon,PUBLIC;')
 contracts['ws_v1_'+name]=fields
# Remove unexpected default function grants, not just anon/PUBLIC. Only new s07/public inventory functions.
s+="""DO $$DECLARE f record;a record;BEGIN FOR f IN SELECT p.oid::regprocedure sig,p.proowner,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE(n.nspname='workspace_private'AND left(p.proname,4)='s07_')OR(n.nspname='public'AND p.proname LIKE 'ws_v1_%inventory%')LOOP
FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))WHERE grantee<>f.proowner AND grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.sig,CASE WHEN a.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(a.grantee))END);END LOOP;END LOOP;END$$;\nCOMMIT;\n"""
public_array='ARRAY['+','.join("'ws_v1_"+n+"'"for n in specs)+']::text[]'
s=s.replace("p.proname LIKE 'ws_v1_%inventory%'",'p.proname=ANY('+public_array+')')
parent_fp=fp
fp=fp.replace("WHERE n.nspname='workspace_private' OR","WHERE (n.nspname='public'AND p.proname=ANY("+public_array+"))OR n.nspname='workspace_private' OR")
# Explicit child release ledger; never reseed/alter the frozen SCHOOL06 manifest.
start=s.index('SET LOCAL ROLE ws_owner;');body=s[start:].removesuffix('COMMIT;\n');digest=hashlib.sha256(body.encode()).hexdigest()
localguard="IF current_database()<>'school01a'OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 'local_only';END IF;"
wrapped="BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));DO $installer$ BEGIN "+localguard
wrapped+="IF to_regclass('workspace_private.s07_install_manifest')IS NOT NULL THEN IF NOT EXISTS(SELECT 1 FROM workspace_private.s07_install_manifest WHERE digest='"+digest+"'AND fingerprint="+fp+")THEN RAISE EXCEPTION 's07_catalog_drift';END IF;RETURN;END IF;"
wrapped+="IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core'AND state IN('closed','active')AND fingerprint="+parent_fp+")THEN RAISE EXCEPTION 'parent_catalog_drift';END IF;"
wrapped+="EXECUTE $inventory_body$"+body+"$inventory_body$;"
wrapped+="CREATE TABLE workspace_private.s07_install_manifest(digest text PRIMARY KEY,fingerprint text NOT NULL,closed_fingerprint text NOT NULL,state text NOT NULL);ALTER TABLE workspace_private.s07_install_manifest OWNER TO ws_owner;ALTER TABLE workspace_private.s07_install_manifest ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.s07_install_manifest FORCE ROW LEVEL SECURITY;"
wrapped+="REVOKE ALL ON workspace_private.s07_install_manifest FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader;EXECUTE format('GRANT SELECT,INSERT,UPDATE ON workspace_private.s07_install_manifest TO %I',current_user);EXECUTE format('CREATE POLICY s07_installer ON workspace_private.s07_install_manifest TO %I USING(true)WITH CHECK(true)',current_user);"
wrapped+="INSERT INTO workspace_private.s07_install_manifest VALUES('"+digest+"',"+fp+","+fp+",'closed');END$installer$;COMMIT;\n"
next((R/'supabase/migrations').glob('*.sql')).write_text('-- LOCAL ONLY explicit SCHOOL07 child release; preserved SCHOOL06 package unchanged.\n'+wrapped)

activation_guard="DO $$BEGIN "+localguard+"IF NOT EXISTS(SELECT 1 FROM workspace_private.s07_install_manifest WHERE state IN('closed','active')AND fingerprint="+fp+")THEN RAISE EXCEPTION 's07_catalog_drift';END IF;END$$;"
(R/'sql/activate-local.sql').write_text("-- QA ONLY, does not enable production or alter SCHOOL06.\nBEGIN;SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));"+activation_guard+'\n'+'\n'.join(activation)+"\nUPDATE workspace_private.s07_install_manifest SET state='active',fingerprint="+fp+';\nCOMMIT;\n')
(R/'sql/close-inventory.sql').write_text("-- LOCAL data-preserving close, no drift blessing.\nBEGIN;DO $close$ DECLARE before_ok boolean;BEGIN "+localguard+"SELECT fingerprint="+fp+"INTO before_ok FROM workspace_private.s07_install_manifest;"+'\n'.join(closure)+"UPDATE workspace_private.s07_install_manifest SET state=CASE WHEN before_ok AND closed_fingerprint="+fp+"THEN 'closed'ELSE 'closed_unverified'END,fingerprint=CASE WHEN before_ok AND closed_fingerprint="+fp+"THEN closed_fingerprint ELSE fingerprint END;END$close$;COMMIT;\n")
(R/'core/signature.ts').write_text('export const signature='+json.dumps(contracts)+' as const;\n')
(R/'sql/rpc-contracts.json').write_text(json.dumps(contracts,indent=2))
print('Generated15 purpose RPCs; local extension default CLOSED; SCHOOL06 unmodified')
