/** Opt-in REAL local PostgreSQL/Auth test. No mock transport. Run via Run-IM2B1-local.mjs. */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createLocalQaConnection } from './localQa';
import type { InventoryLocalConnection } from './contracts';
// @ts-expect-error Node harness only; application does not import this test.
import { execFileSync } from 'node:child_process';
// @ts-expect-error Node harness only.
import process from 'node:process';
const enabled=process.env.INVENTORY_IM2B1_REAL_LOCAL==='1';
const endpoint='http://127.0.0.1:56321';
const clients:InventoryLocalConnection[]=[];
const school=crypto.randomUUID(),otherSchool=crypto.randomUUID(),item=crypto.randomUUID();
let teacher:InventoryLocalConnection, instructor:InventoryLocalConnection, outsider:InventoryLocalConnection, second:InventoryLocalConnection;
let teacherCredentials:{email:string;password:string};
let publicKey='';
function sql(query:string):void {
  execFileSync('docker',['exec','-i','supabase_db_inventory_qa','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,stdio:['pipe','pipe','pipe']});
}
async function actor() {
  const email=`im2b1-${crypto.randomUUID()}@example.invalid`,password=`${crypto.randomUUID()}Aa1!`;
  const response=await fetch(`${endpoint}/auth/v1/signup`,{method:'POST',redirect:'error',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!response.ok)throw Error('Synthetic local Auth fixture creation failed');
  const body=await response.json();const id=body.user?.id;
  if(typeof id!=='string' || !/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid synthetic actor');
  const client=createLocalQaConnection({endpoint,publishableKey:publicKey});clients.push(client);
  return {client,id,email,password};
}
describe.skipIf(!enabled)('IM-2B-1 REAL Local Auth/PostgreSQL integration',()=>{
  beforeAll(async()=>{
    publicKey=process.env.INVENTORY_QA_PUBLIC_KEY ?? '';
    if(!publicKey)throw Error('Run the guarded Inventory local QA runner');
    const a=await actor(),i=await actor(),b=await actor();
    teacher=a.client;instructor=i.client;outsider=b.client;teacherCredentials={email:a.email,password:a.password};
    sql(`insert into public.inventory_schools(school_id,display_name) values('${school}','Synthetic IM2B1 A'),('${otherSchool}','Synthetic IM2B1 B');
      insert into public.inventory_members(school_id,user_id,role) values('${school}','${a.id}','teacher_admin'),('${school}','${i.id}','instructor'),('${otherSchool}','${b.id}','teacher_admin');
      insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit) values('${item}','${school}','Synthetic IM2B1 item','piece','box',1);`);
    for(const [client,credentials,target] of [[teacher,a,school],[instructor,i,school],[outsider,b,otherSchool]] as const) {
      await client.login(credentials.email,credentials.password);await client.selectSchool(target);
    }
    second=createLocalQaConnection({endpoint,publishableKey:publicKey});clients.push(second);await second.login(a.email,a.password);await second.selectSchool(school);
  },60000);
  afterAll(()=>{for(const c of clients)c.dispose();publicKey='';teacherCredentials={email:'',password:''};});
  it('reads actual RLS and rejects cross-school selection and instructor purchase access',async()=>{
    expect((await teacher.listItems()).some(x=>x.item_id===item)).toBe(true);
    expect((await outsider.listItems()).some(x=>x.item_id===item)).toBe(false);
    await expect(outsider.selectSchool(school)).rejects.toMatchObject({code:'PERMISSION_DENIED'});
    await expect(instructor.purchaseBatches()).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  });
  it('executes all five stock RPCs, actual replay, scoped history and INSERT',async()=>{
    const received=await teacher.prepare('inventory_receive_stock',{p_item_id:item,p_purchase_quantity:'10',p_base_units_per_purchase_unit:'1',p_received_at:'2026-11-02T00:00:00Z',p_expires_on:null,p_purchase_link_id:null,p_reason:'Synthetic receive'}).execute();
    const lot=received.data.movements[0].lot_id;
    const use=instructor.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'});
    await use.execute();expect((await use.execute()).data.replayed).toBe(true);
    const disposed=await teacher.prepare('inventory_dispose_stock',{p_item_id:item,p_lot_id:lot,p_quantity:'1',p_reason:'Synthetic dispose'}).execute();
    await teacher.prepare('inventory_adjust_stock',{p_item_id:item,p_lot_id:lot,p_expected_quantity:'8',p_counted_quantity:'9',p_reason:'Synthetic count'}).execute();
    const history=await teacher.movements(item);const adjustment=history.find(m=>m.movement_type==='ADJUST')!;
    await teacher.prepare('inventory_reverse_movement',{p_original_movement_id:adjustment.movement_id,p_reason:'Synthetic reverse'}).execute();
    expect((await teacher.itemDetail(item)).totals.totalQuantity).toBe('8');expect(disposed.persisted).toBe(true);
    const state=instructor.authState();if(state.status!=='authenticated')throw Error('Local fixture signed out');
    expect((await instructor.movements(item)).every(m=>m.actor_user_id===state.userId)).toBe(true);
    const created=await teacher.registerItem({item_name:'Synthetic inserted',category:null,specification:null,base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:'1',recommended_stock:'0',minimum_stock:'0',is_active:true});
    expect(created.persisted).toBe(true);
    await expect(instructor.registerItem({item_name:'Synthetic denied',category:null,specification:null,base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:'1',recommended_stock:'0',minimum_stock:'0',is_active:true})).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  });
  it('creates batch, changes status, races partial receipts and replays same UUID across clients',async()=>{
    const batch=crypto.randomUUID();
    await teacher.prepare('inventory_create_purchase_batch',{p_batch_id:batch,p_note:null,p_lines:[{candidate_id:'synthetic-im2b1',item_id:item,requested_purchase_quantity:'10',base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:'1',specification_snapshot:null,expected_unit_price:null,currency:null}]}).execute();
    for(const status of ['APPROVED','ORDERED','AWAITING_RECEIPT'] as const)await teacher.prepare('inventory_set_purchase_batch_status',{p_batch_id:batch,p_target_status:status,p_reason:'Synthetic transition'}).execute();
    const progress=await teacher.purchaseProgress(batch),line=progress.lines[0].line_id;
    const receipt=(quantity:string)=>({p_batch_id:batch,p_receipt_id:crypto.randomUUID(),p_received_at:'2026-11-02T00:00:00Z',p_reason:'Synthetic partial receipt',p_lines:[{line_id:line,received_purchase_quantity:quantity,expires_on:null}]});
    const results=await Promise.allSettled([teacher.prepare('inventory_confirm_receipt',receipt('6')).execute(),second.prepare('inventory_confirm_receipt',receipt('6')).execute()]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const failure=results.find(r=>r.status==='rejected');expect(failure?.status==='rejected' && failure.reason.serverCode).toBe('PURCHASE_RECEIPT_EXCEEDS_REQUESTED');
    expect((await teacher.purchaseProgress(batch)).lines[0].received_base_quantity).toBe('6');
    const args=receipt('1'),request=crypto.randomUUID();
    const replay=await Promise.all([teacher.prepare('inventory_confirm_receipt',args,request).execute(),second.prepare('inventory_confirm_receipt',args,request).execute()]);
    expect(replay.filter(r=>r.data.replayed)).toHaveLength(1);
    expect((await teacher.purchaseProgress(batch)).lines[0].received_base_quantity).toBe('7');
  });
  it('logs out, rejects old prepared requests, and logs back in without cached rows',async()=>{
    const pending=teacher.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic pending'});
    await teacher.logout();await expect(teacher.listItems()).rejects.toMatchObject({code:'UNAUTHENTICATED'});
    await teacher.login(teacherCredentials.email,teacherCredentials.password);await teacher.selectSchool(school);
    await expect(pending.execute()).rejects.toMatchObject({code:'STALE_CONTEXT'});
  });
});
