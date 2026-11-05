import{it,expect}from'vitest';import{createRuntime}from'../../school-workspace/school05/server/provider.js';import{sql}from'./school05-native-pg.js';
import type{State}from'../../school-workspace/school07/core/types.js';import type{SecretSession}from'../../school-workspace/auth/server/ports.js';
const A='10000000-0000-0000-0000-000000000001',B=A.slice(0,-1)+'2';
it('WINDOWS PostgreSQL17 actual RPC: replay/conflict, nonnegative stock, expired lot, school boundary, suspended membership and audit',async()=>{
 let session:SecretSession|null=null;const r=await createRuntime({vault:{load:async()=>session,save:async s=>{session=s;},clear:async()=>{session=null;}}});
 const stock=(a:string,i:Record<string,unknown>)=>r.inventory!(a,i) as Promise<State>;
 try{
 await r.school('login',{});await r.school('select',{school:A});await stock('select',{school:A});
 const made=await stock('create',{payload:{name:'Windows RPC 계약 합성 물품',category:'소모품',specification:'합성',unit:'개',minimum_quantity:10},version:0,request_id:crypto.randomUUID()});expect(made.success).toBe(true);const item=made.item!.item_id;
 const today=made.context!.today,rid=crypto.randomUUID(),payload={item_id:item,quantity:4,expiry_date:today};const received=await stock('receive',{payload,version:0,request_id:rid});expect(received.item?.available_quantity).toBe(4);const lot=received.lots[0]!;
 const replay=await stock('receive',{payload,version:0,request_id:rid});expect(replay.success).toBe(true);expect(replay.item?.available_quantity).toBe(4);
 const excess=await stock('use',{payload:{item_id:item,lot_id:lot.lot_id,quantity:5},version:1,request_id:crypto.randomUUID()});expect(excess.success).toBe(false);
 const useId=crypto.randomUUID(),use={item_id:item,lot_id:lot.lot_id,quantity:1};expect((await stock('use',{payload:use,version:1,request_id:useId})).item?.available_quantity).toBe(3);
 expect((await stock('use',{payload:use,version:1,request_id:useId})).item?.available_quantity).toBe(3);
 expect((await stock('use',{payload:{...use,quantity:2},version:1,request_id:useId})).phase).toBe('conflict');
 expect((await stock('use',{payload:use,version:1,request_id:crypto.randomUUID()})).phase).toBe('conflict');
 const old=await stock('receive',{payload:{item_id:item,quantity:2,expiry_date:'2020-01-01'},version:0,request_id:crypto.randomUUID()});const expired=old.lots.find(l=>l.expiry_date==='2020-01-01')!;expect(old.item?.available_quantity).toBe(3);
 expect((await stock('use',{payload:{item_id:item,lot_id:expired.lot_id,quantity:1},version:expired.version,request_id:crypto.randomUUID()})).success).toBe(false);
 expect(await sql("SELECT (SELECT count(*) FROM workspace.shared_inventory_movements)=(SELECT count(*) FROM workspace.audit_entries WHERE action IN('s07_receive','s07_use','s07_adjust','s07_dispose','s07_state'))")).toBe('t');
 expect(await sql('SELECT bool_and(quantity>=0) FROM workspace.shared_inventory_lots')).toBe('t');
 await r.school('select',{school:B});expect((await stock('select',{school:B})).context?.manage).toBe(false);expect((await stock('detail',{item_id:item})).item).toBeUndefined();
 await r.school('select',{school:A});await sql("UPDATE workspace.school_memberships SET status='suspended' WHERE id='20000000-0000-0000-0000-000000000003' AND school_id='"+A+"'");expect((await stock('select',{school:A})).context).toBeUndefined();
 }finally{await sql("UPDATE workspace.school_memberships SET status='active' WHERE id='20000000-0000-0000-0000-000000000003' AND school_id='"+A+"'");await r.dispose();}
});
