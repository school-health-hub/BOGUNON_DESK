import {describe,it,expect} from 'vitest';
import {MonitorProfiles} from '../main/monitor-profiles';
import type {MonitorDocument,MonitorObservation} from '../monitor-protocol';
const display=(displayId:number,identityKey:string|null=`device-${displayId}`):MonitorObservation=>({displayId,identityKey,identityKind:identityKey?'device-path':'uncertain',label:`Display ${displayId}`,primary:displayId===1,bounds:{x:0,y:0,width:1920,height:1080},workArea:{x:0,y:0,width:1920,height:1040},scaleFactor:1});
const memory=()=>{let value:MonitorDocument|null=null;return {read:async()=>value,write:async(next:MonitorDocument)=>{value=structuredClone(next);},flush:async()=>undefined};};
describe('monitor profile authority',()=>{
 it('retains identity through display ID, order, DPI changes and reconnect',async()=>{
  const owner=new MonitorProfiles(memory(),()=>undefined);
  const first=await owner.initialize([display(1),display(2),display(3)]);
  const id=first.profiles[0].id;
  await owner.reconcile([display(3),display(2)]);
  expect((await owner.read()).profiles.find(p=>p.id===id)?.dormant).toBe(true);
  await owner.reconcile([display(3),{...display(9,'device-1'),scaleFactor:1.5},display(2)]);
  expect(owner.profileForDisplay(9)?.id).toBe(id);
  expect((await owner.read()).profiles).toHaveLength(3);
 });
 it('does not persist or claim ambiguous identities',async()=>{
  const store=memory(),owner=new MonitorProfiles(store,()=>undefined);
  const first=await owner.initialize([display(1)]);
  await owner.reconcile([display(2,'device-1'),display(3,'device-1'),display(4,null)]);
  expect((await store.read())?.profiles).toHaveLength(1);
  expect((await owner.read()).profiles.find(p=>p.id===first.profiles[0].id)?.dormant).toBe(true);
  const uncertain=owner.profileForDisplay(2);
  await expect(owner.write({revision:(await owner.read()).revision,profileId:uncertain?.id??'',visible:false,layout:{}})).rejects.toThrow('식별');
 });
});

const dashboard=()=>({version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[{id:'widget-clock',type:'clock',x:0,y:0,w:3,h:2,visible:true}]});
it('isolates explicit layouts and rejects stale revisions without changing other profiles',async()=>{
 const store=memory(),owner=new MonitorProfiles(store,()=>undefined);
 const initial=await owner.initialize([display(1),display(2)]),first=initial.profiles[0];
 const saved=await owner.write({revision:initial.revision,profileId:first.id,visible:false,layout:dashboard()});
 expect(saved.profiles.find(p=>p.id===first.id)?.layout).toEqual(dashboard());
 expect(saved.profiles.find(p=>p.id!==first.id)?.layout).toBe(null);
 await expect(owner.write({revision:initial.revision,profileId:first.id,visible:true,layout:dashboard()})).rejects.toThrow('다시 불러온');
 const restarted=new MonitorProfiles(store,()=>undefined);await restarted.initialize([display(4,'device-1')]);
 expect(restarted.profileForDisplay(4)?.visible).toBe(false);
});
it('does not write again for repeated unchanged topology',async()=>{
 const store=memory(),owner=new MonitorProfiles(store,()=>undefined);
 const first=await owner.initialize([display(1)]);
 const repeated=await owner.reconcile([display(1)]);
 expect(repeated.revision).toBe(first.revision);
});
it('reports read-only snapshot after persistence failure',async()=>{
 const owner=new MonitorProfiles({read:async()=>null,write:async()=>{throw new Error('Synthetic write failure');},flush:async()=>undefined},()=>undefined);
 const state=await owner.initialize([display(1)]);
 expect(state.writable).toBe(false);expect(state.error).toContain('Synthetic write failure');
});

it.each([
 ['disconnect',[]],
 ['identity collision',[display(2,'device-1'),display(3,'device-1')]],
] as const)('rejects direct writes to a persisted dormant UUID after %s',async(_reason,observations)=>{
 const store=memory(),owner=new MonitorProfiles(store,()=>undefined);
 const initial=await owner.initialize([display(1)]),id=initial.profiles[0].id;
 await owner.write({revision:initial.revision,profileId:id,visible:true,layout:dashboard()});
 await owner.reconcile(observations);
 const before=JSON.stringify(await store.read()),snapshot=await owner.read();
 await expect(owner.write({revision:snapshot.revision,profileId:id,visible:false,layout:{...dashboard(),widgets:[]}})).rejects.toThrow('다시 연결');
 expect(JSON.stringify(await store.read())).toBe(before);
 expect((await owner.read()).revision).toBe(snapshot.revision);
 expect((await owner.read()).profiles.find(p=>p.id===id)?.layout).toEqual(dashboard());
});
