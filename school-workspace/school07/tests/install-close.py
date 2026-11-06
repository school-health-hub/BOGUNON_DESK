"""Additional child-release/catalog tests after UI/regressions; local owned DB only."""
from pathlib import Path
import runpy,json
R=Path(__file__).resolve().parents[1];d=runpy.run_path(str(R/'tests/run.py'));sql=d['sql'];scalar=d['scalar'];apply=d['apply'];case=d['case'];assertion=d['assertion'];migration=next((R/'supabase/migrations').glob('*.sql'))
(R/'evidence/object-inventory.json').write_text(sql((R.parent/'school06/sql/inventory-readonly.sql').read_text()).stdout.strip())
case('all four inventory tables FORCE RLS, owner differs from runtime',lambda:assertion(scalar("SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind='r'AND c.relname=ANY(ARRAY['shared_inventory_items','shared_inventory_lots','shared_inventory_movements','shared_inventory_locations'])AND c.relforcerowsecurity AND c.relrowsecurity AND pg_get_userbyid(c.relowner)='ws_owner'")=='4'))
case('child ledger cannot be rewritten by runtime or authenticated',lambda:assertion(scalar("SELECT has_table_privilege('ws_runtime','workspace_private.s07_install_manifest','UPDATE')OR has_table_privilege('authenticated','workspace_private.s07_install_manifest','UPDATE')")=='f'))
def upper_bound():
 sql("INSERT INTO workspace.membership_permission_overrides VALUES('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',1,'inventory.manage','allow','school')")
 d['deny'](d['rpc'](4,'create_inventory_item',{'name':'권한 상한 확인'},0,ok=False))
 d['deny'](d['rpc'](3,'create_inventory_item',{'name':'다른 학교 교사 권한 전이 금지'},0,s=d['B'],ok=False))
 sql("DELETE FROM workspace.membership_permission_overrides WHERE membership_id='20000000-0000-0000-0000-000000000004'AND permission='inventory.manage'")
case('assistant permission ceiling and role per school cannot inherit teacher rights',upper_bound)
case('combined release replay after full old/new suites remains no-op',lambda:apply(migration))
count=scalar('SELECT count(*)FROM workspace.shared_inventory_movements')
case('inventory close disables new authenticated execution without deleting data',lambda:apply(R/'sql/close-inventory.sql'))
assert scalar('SELECT count(*)FROM workspace.shared_inventory_movements')==count
assert scalar("SELECT has_function_privilege('authenticated','public.ws_v1_list_inventory_items(uuid,jsonb)','EXECUTE')")=='f'
case('normal close repeat/reopen is controlled and preserves data',lambda:(apply(migration),apply(R/'sql/activate-local.sql')))
sql("ALTER FUNCTION public.ws_v1_list_inventory_items(uuid,jsonb)SET search_path='public'")
case('public inventory wrapper drift is detected by child fingerprint',lambda:assertion(apply(migration,False).returncode!=0))
case('activation refuses drift instead of blessing new metadata',lambda:assertion(apply(R/'sql/activate-local.sql',False).returncode!=0))
case('emergency close marks unverified and retains history',lambda:apply(R/'sql/close-inventory.sql'))
assert scalar("SELECT state FROM workspace_private.s07_install_manifest")=='closed_unverified'
assert scalar('SELECT count(*)FROM workspace.shared_inventory_movements')==count
(R/'evidence/install-close-results.json').write_text(json.dumps({'checks':d['results'],'pass':len(d['results']),'fail':0,'classification':'LOCAL DB'},indent=2))
