import {describe,it,expect,afterEach} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MonitorProfileStore,monitorDefaults,validateMonitorDocument} from '../main/monitor-profile-store';
const roots:string[]=[];
const root=async()=>{const value=await mkdtemp(join(tmpdir(),'monitor-store-'));roots.push(value);return value;};
afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
describe('monitor sidecar persistence',()=>{
 it('restores primary and preserves the previous good backup without changing legacy bytes',async()=>{
  const path=await root(),store=new MonitorProfileStore(path);
  await writeFile(join(path,'layout.json'),'SYNTHETIC LEGACY');
  await store.write(monitorDefaults());await store.write({...monitorDefaults(),revision:1});
  expect((await new MonitorProfileStore(path).read())?.revision).toBe(1);
  expect(JSON.parse(await readFile(join(path,'monitor-profiles.backup.json'),'utf8')).revision).toBe(0);
  expect(await readFile(join(path,'layout.json'),'utf8')).toBe('SYNTHETIC LEGACY');
 });
 it('recovers backup read-only and preserves corrupt primary bytes',async()=>{
  const path=await root(),store=new MonitorProfileStore(path);
  await store.write(monitorDefaults());await store.write({...monitorDefaults(),revision:1});
  await writeFile(join(path,'monitor-profiles.json'),'SYNTHETIC CORRUPT');
  const restored=new MonitorProfileStore(path);
  expect((await restored.read())?.revision).toBe(0);expect(restored.writable).toBe(false);
  await expect(restored.write(monitorDefaults())).rejects.toThrow('read-only');
  expect(await readFile(join(path,'monitor-profiles.json'),'utf8')).toBe('SYNTHETIC CORRUPT');
 });
 it('falls back read-only when both documents are corrupt',async()=>{
  const path=await root();await writeFile(join(path,'monitor-profiles.json'),'bad');await writeFile(join(path,'monitor-profiles.backup.json'),'bad');
  const store=new MonitorProfileStore(path);
  expect(await store.read()).toEqual(monitorDefaults());expect(store.writable).toBe(false);
 });
 it('preserves primary when backup cannot be written',async()=>{
  const path=await root(),store=new MonitorProfileStore(path);await store.write(monitorDefaults());
  const before=await readFile(join(path,'monitor-profiles.json'),'utf8');
  await mkdir(join(path,'monitor-profiles.backup.json'));
  await expect(store.write({...monitorDefaults(),revision:1})).rejects.toThrow('not saved');
  expect(await readFile(join(path,'monitor-profiles.json'),'utf8')).toBe(before);expect(store.writable).toBe(false);
 });
 it('rejects unknown document fields',()=>{expect(()=>validateMonitorDocument({...monitorDefaults(),secret:'synthetic'})).toThrow();});
});

it.each(['disconnect','collision'] as const)('preserves actual sidecar and backup bytes on dormant write after %s',async(reason)=>{
 const path=await root(),store=new MonitorProfileStore(path);
 const {MonitorProfiles}=await import('../main/monitor-profiles');
 const bounds={x:0,y:0,width:1920,height:1080};
 const observation={displayId:1,identityKey:'synthetic-device',identityKind:'device-path',label:'Synthetic display',primary:true,bounds,workArea:bounds,scaleFactor:1} as const;
 const owner=new MonitorProfiles(store,()=>undefined),initial=await owner.initialize([observation]);
 const id=initial.profiles[0].id;
 await owner.reconcile(reason==='disconnect'?[]:[observation,{...observation,displayId:2}]);
 const state=await owner.read();
 const primary=await readFile(join(path,'monitor-profiles.json'));
 const backup=await readFile(join(path,'monitor-profiles.backup.json'));
 await expect(owner.write({revision:state.revision,profileId:id,visible:false,layout:{version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[]}})).rejects.toThrow('다시 연결');
 expect(await readFile(join(path,'monitor-profiles.json'))).toEqual(primary);
 expect(await readFile(join(path,'monitor-profiles.backup.json'))).toEqual(backup);
 expect((await owner.read()).revision).toBe(state.revision);
});
