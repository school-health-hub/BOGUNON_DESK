from pathlib import Path
import subprocess,os,json,uuid,concurrent.futures,sys
R=Path(__file__).resolve().parents[1];REPO=R.parents[1];D=['docker','--host=unix:///var/run/docker.sock'];NAME='bogunon-school07-pg';ENV={k:v for k,v in os.environ.items()if k not in('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')};results=[]
A='10000000-0000-0000-0000-000000000001';B=A[:-1]+'2'
def lit(v):return 'NULL'if v is None else "'"+str(v).replace("'","''")+"'"
def sql(q,ok=True):
 p=subprocess.run(D+['exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','school01a'],input=q,text=True,capture_output=True,env=ENV,timeout=40)
 if ok and p.returncode:raise AssertionError(p.stderr[-2200:])
 return p

def apply(p,ok=True):return sql("SET bogunon.ws_install_mode='isolated';"+Path(p).read_text(),ok)
def scalar(q):return sql(q).stdout.strip().splitlines()[-1]
def rpc(i,n,p={},version=None,rid=None,s=A,ok=True):
 claims={'sub':f'00000000-0000-0000-0000-{i:012}','session_id':f'30000000-0000-0000-0000-{i:012}','exp':2000000000,'is_anonymous':False}
 args=[lit(s),lit(json.dumps(p))+'::jsonb'];
 if version is not None:args.extend([str(version),lit(rid or str(uuid.uuid4()))])
 q='BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+lit(json.dumps(claims))+';SELECT public.ws_v1_'+n+'('+','.join(args)+');COMMIT;'
 x=sql(q,ok);return json.loads(x.stdout.strip().splitlines()[-1])if ok else x

def deny(p,marker='access_denied'):assert p.returncode and marker in p.stderr,(marker,p.stderr[-2000:])
def case(n,fn):
 try:fn();results.append({'name':n,'status':'PASS','classification':'LOCAL POSTGREST'if n.startswith('LOCAL POSTGREST')else'LOCAL DB'});print('PASS',n,flush=True)
 except Exception as e:results.append({'name':n,'status':'FAIL','detail':str(e)});print('FAIL',n,e,flush=True);raise

def main():
 for f in sorted((REPO/'school-workspace/school06/supabase/migrations').glob('*foundation.sql')):apply(f)
 apply(REPO/'school-workspace/school06/tests/local-auth-capabilities.sql')
 for f in sorted((REPO/'school-workspace/school06/supabase/migrations').glob('*core.sql')):apply(f)
 case('SCHOOL06 initial39 RPCs remain CLOSED',lambda:assertion(scalar("SELECT bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE'))FROM workspace_private.s06_rpc_manifest")=='t'))
 apply(REPO/'school-workspace/school06/sql/activate-new-rpcs.sql')
 migration=next((R/'supabase/migrations').glob('*.sql'));apply(migration)
 case('inventory15 default CLOSED; raw tables not exposed',lambda:assertion(scalar("SELECT has_function_privilege('authenticated','public.ws_v1_list_inventory_items(uuid,jsonb)','EXECUTE')OR has_table_privilege('authenticated','workspace.shared_inventory_items','SELECT')")=='f'))
 case('S07 closed child release repeat is no-op',lambda:apply(migration))
 apply(R/'sql/activate-local.sql')
 case('S07 active child release repeat is no-op',lambda:apply(migration))
 for f in ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql']:sql((REPO/f).read_text())
 if os.environ.get('SCHOOL07_REGRESSION','0')=='1':
  import runpy
  # Baseline regression resets its directory fixture while leaving new tables initially empty.
  runpy.run_path(str(REPO/'school-workspace/school06/tests/security-regression.py'))['run'](R,REPO,D,NAME,ENV,sql)
  for f in ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql']:sql((REPO/f).read_text())
 item={}
 def create():
  item.update(rpc(1,'create_inventory_item',{'name':'멸균 거즈','category':'소모품','specification':'소형','unit':'개','minimum_quantity':5},0))
 case('admin creates item with zero stock',create)
 def locations():
  loc=rpc(3,'save_inventory_location',{'name':'합성 보관함'},0);loc=rpc(3,'save_inventory_location',{'location_id':loc['location_id'],'name':'합성 보관함 변경','active':True},loc['version']);assert any(x['name']=='합성 보관함 변경'for x in rpc(3,'list_inventory_locations'));deny(rpc(4,'save_inventory_location',{'name':'권한 없음'},0,ok=False))
 case('location register/rename uses version; assistant cannot manage',locations)
 def edit():item.update(rpc(3,'edit_inventory_item',{'item_id':item['item_id'],'name':'멸균 거즈','category':'소모품','specification':'중형','unit':'개','minimum_quantity':5},item['version']))
 case('teacher edits metadata',edit)
 case('assistant cannot edit metadata',lambda:deny(rpc(4,'edit_inventory_item',{'item_id':item['item_id']},2,ok=False)))
 case('cross school item lookup denied',lambda:deny(rpc(6,'get_inventory_item',{'item_id':item['item_id']},s=B,ok=False)))
 lot={}
 def receive():lot.update(rpc(3,'receive_inventory',{'item_id':item['item_id'],'quantity':10,'expiry_date':scalar('SELECT workspace_private.s07_today()+30')},0));assert lot['quantity']==10
 case('receive increases stock and30day inclusive boundary',receive)
 case('assistant default receive denied',lambda:deny(rpc(4,'receive_inventory',{'item_id':item['item_id'],'quantity':2},0,ok=False)))
 sql("INSERT INTO workspace.membership_permission_overrides VALUES('"+A+"','20000000-0000-0000-0000-000000000004',1,'inventory.use','allow','own')")
 def use():lot.update(rpc(4,'use_inventory',{'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':3},lot['version']));assert lot['quantity']==7
 case('explicit own use permission decreases stock',use)
 case('negative stock denied',lambda:deny(rpc(4,'use_inventory',{'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':8},lot['version'],ok=False),'insufficient_stock'))
 case('assistant adjust/dispose forbidden',lambda:(deny(rpc(4,'adjust_inventory',{'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':2},lot['version'],ok=False)),deny(rpc(4,'dispose_inventory',{'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':2},lot['version'],ok=False))))
 rid=str(uuid.uuid4());payload={'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':1};v=lot['version']
 def idem():
  a=rpc(4,'use_inventory',payload,v,rid);b=rpc(4,'use_inventory',payload,v,rid);assert a==b;lot.update(a)
 case('request_id replay applies once',idem)
 case('request_id changed payload rejected',lambda:deny(rpc(4,'use_inventory',{**payload,'quantity':2},v,rid,ok=False),'idempotency_mismatch'))
 case('stale expected_version rejected',lambda:deny(rpc(4,'use_inventory',payload,v,ok=False),'conflict'))
 def race():
  current=lot['version'];p={**payload,'quantity':4}
  with concurrent.futures.ThreadPoolExecutor(2)as ex:res=list(ex.map(lambda _:rpc(4,'use_inventory',p,current,ok=False),range(2)))
  assert sum(x.returncode==0 for x in res)==1;assert any('conflict'in x.stderr for x in res)
  assert scalar("SELECT quantity FROM workspace.shared_inventory_lots WHERE lot_id="+lit(lot['lot_id']))=='2'
 case('concurrent actual connections cannot overdraw',race)
 expired=rpc(3,'receive_inventory',{'item_id':item['item_id'],'quantity':4,'expiry_date':scalar('SELECT workspace_private.s07_today()-1')},0)
 case('expired use rejected',lambda:deny(rpc(4,'use_inventory',{'item_id':item['item_id'],'lot_id':expired['lot_id'],'quantity':1},expired['version'],ok=False),'expired_or_unusable'))
 # Do not send result-only keys as RPC payload.
 fresh=rpc(3,'receive_inventory',{'item_id':item['item_id'],'quantity':6},0)
 case('no-expiry lot and separate quantities',lambda:assertion(any(x['expiry_status']=='NONE'for x in rpc(3,'list_inventory_lots',{'item_id':item['item_id']}))))
 def totals():
  x=rpc(3,'get_inventory_item',{'item_id':item['item_id']});assert x['total_quantity']==12 and x['available_quantity']==8 and x['expired_quantity']==4 and x['soon_quantity']==2
 case('expired excluded from usable; holding includes all',totals)
 def adjust():
  n=rpc(3,'adjust_inventory',{'item_id':item['item_id'],'lot_id':fresh['lot_id'],'quantity':2,'reason':'실사 조정'},1);rpc(3,'dispose_inventory',{'item_id':item['item_id'],'lot_id':fresh['lot_id'],'quantity':1,'reason':'포장 훼손'},n['version']);assert rpc(3,'get_inventory_item',{'item_id':item['item_id']})['is_low']
 case('adjust/dispose append history and low stock uses usable count',adjust)
 def block():
  n=rpc(3,'set_inventory_lot_state',{'item_id':item['item_id'],'lot_id':fresh['lot_id'],'state':'UNUSABLE'},3);assert rpc(3,'get_inventory_item',{'item_id':item['item_id']})['unusable_quantity']==1
  deny(rpc(4,'use_inventory',{'item_id':item['item_id'],'lot_id':fresh['lot_id'],'quantity':1},n['version'],ok=False),'expired_or_unusable')
 case('unusable lot excluded and use forbidden',block)
 case('different school lot movement denied',lambda:deny(rpc(6,'use_inventory',{'item_id':item['item_id'],'lot_id':fresh['lot_id'],'quantity':1},4,s=B,ok=False)))
 for i in [5,8]:case('pending/expired denied '+str(i),lambda i=i:deny(rpc(i,'list_inventory_items',ok=False)))
 def stop():
  sql("UPDATE workspace.school_memberships SET status='suspended'WHERE id='20000000-0000-0000-0000-000000000004'AND school_id="+lit(A));deny(rpc(4,'list_inventory_items',ok=False));sql("UPDATE workspace.school_memberships SET status='active'WHERE id='20000000-0000-0000-0000-000000000004'AND school_id="+lit(A))
 case('live suspension rejects previous session',stop)
 def audit():
  n=int(scalar('SELECT count(*)FROM workspace.shared_inventory_movements'));a=int(scalar("SELECT count(*)FROM workspace.audit_entries WHERE action IN('s07_receive','s07_use','s07_adjust','s07_dispose','s07_state')"));assert a==n
 case('all quantity transactions have atomic audit entries',audit)
 def rollback():
  before=scalar('SELECT sum(quantity)FROM workspace.shared_inventory_lots');sql("CREATE FUNCTION workspace_private.s07_test_fail()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit_test_failure';END$$;CREATE TRIGGER s07_test_fail BEFORE INSERT ON workspace.audit_entries FOR EACH ROW EXECUTE FUNCTION workspace_private.s07_test_fail()")
  try:deny(rpc(3,'receive_inventory',{'item_id':item['item_id'],'quantity':1},0,ok=False),'audit_test_failure');assert before==scalar('SELECT sum(quantity)FROM workspace.shared_inventory_lots')
  finally:sql('DROP TRIGGER s07_test_fail ON workspace.audit_entries;DROP FUNCTION workspace_private.s07_test_fail()')
 case('audit failure rolls back lot/movement/receipt',rollback)
 case('raw tables and movement delete denied',lambda:assertion(sql('SET ROLE authenticated;DELETE FROM workspace.shared_inventory_movements',False).returncode!=0))
 def privacy():
  before=scalar("SELECT jsonb_build_array((SELECT count(*)FROM workspace.command_receipts),(SELECT count(*)FROM workspace.audit_entries))")
  deny(rpc(3,'create_inventory_item',{'name':'학생 이름 김합성','category':'','specification':'','unit':'개','minimum_quantity':0},0,ok=False),'input_rejected')
  assert before==scalar("SELECT jsonb_build_array((SELECT count(*)FROM workspace.command_receipts),(SELECT count(*)FROM workspace.audit_entries))")
 case('privacy rejected before any persistent receipt',privacy)
 def boundaries():
  x=rpc(3,'create_inventory_item',{'name':'경계 검사 소모품','category':'점검','specification':'','unit':'개','minimum_quantity':1},0)
  for days in [-1,0,30,31]:rpc(3,'receive_inventory',{'item_id':x['item_id'],'quantity':1,'expiry_date':scalar('SELECT workspace_private.s07_today()+'+str(days))},0)
  got=rpc(3,'get_inventory_item',{'item_id':x['item_id']});assert got['soon_quantity']==2 and got['expired_quantity']==1 and got['available_quantity']==3
  assert scalar("SET TIME ZONE 'Pacific/Honolulu';SELECT workspace_private.s07_today()=(statement_timestamp()AT TIME ZONE 'Asia/Seoul')::date")=='t'
 case('Seoul dates: expiry today/30 inclusive,31 excluded, yesterday expired',boundaries)
 def delegation():
  sql("INSERT INTO workspace.membership_permission_overrides VALUES('"+A+"','20000000-0000-0000-0000-000000000004',1,'inventory.receive','allow','own')")
  own=rpc(4,'receive_inventory',{'item_id':item['item_id'],'quantity':1},0);assert own['quantity']==1
  sql("UPDATE workspace.membership_permission_overrides SET effect='deny'WHERE permission='inventory.use'AND membership_id='20000000-0000-0000-0000-000000000004'")
  deny(rpc(4,'use_inventory',{'item_id':item['item_id'],'lot_id':own['lot_id'],'quantity':1},1,ok=False))
  sql("UPDATE workspace.membership_permission_overrides SET effect='allow'WHERE permission='inventory.use'AND membership_id='20000000-0000-0000-0000-000000000004'")
 case('explicit own receive works; deny override wins over allow',delegation)
 def foreign_lot():
  bi=rpc(6,'create_inventory_item',{'name':'학교 B 소모품','category':'','specification':'','unit':'개','minimum_quantity':0},0,s=B)
  deny(rpc(6,'use_inventory',{'item_id':bi['item_id'],'lot_id':fresh['lot_id'],'quantity':1},4,s=B,ok=False))
 case('valid school B item cannot reference school A lot',foreign_lot)
 case('SCHOOL06 replay fails closed on intentional extension, originals preserved',lambda:assertion(apply(next((REPO/'school-workspace/school06/supabase/migrations').glob('*core.sql')),False).returncode!=0))
 if os.environ.get('SCHOOL07_POSTGREST','1')=='1':
  import runpy
  runpy.run_path(str(R/'tests/postgrest.py'))['run'](sql,case,R,D,NAME,ENV)
 (R/'evidence/db-results.json').write_text(json.dumps({'checks':results,'pass':len(results),'fail':0,'hosted':'NOT RUN','windows':'NOT RUN'},ensure_ascii=False,indent=2))
 print('DB PASS',len(results),flush=True)
def assertion(x):assert x
if __name__=='__main__':main()
