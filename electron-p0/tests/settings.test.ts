import { describe,it,expect } from 'vitest';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SettingsStore,validateSettings } from '../main/settings';
const settings=()=>({version:1,dashboard:{version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[{id:'widget-clock',type:'clock',x:0,y:0,w:3,h:2,visible:true}]},dock:{version:2,items:[{id:'home',visible:true}]}});
describe('PoC-only atomic settings',()=>{
 it('rejects finance/secrets, duplicate IDs and invalid geometry before changing bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'p0-settings-')),store=new SettingsStore(root),good=settings();await store.write(good);
  const before=await readFile(join(root,'layout.json'),'utf8');
  const invalid=[{...good,financeDb:'no'}, {...good,password:'synthetic'}, {...good,dashboard:{...good.dashboard,widgets:[{...good.dashboard.widgets[0],x:12}]}}, {...good,dashboard:{...good.dashboard,widgets:[...good.dashboard.widgets,...good.dashboard.widgets]}}];
  for(const bad of invalid)expect(()=>store.write(bad)).toThrow();
  expect(await readFile(join(root,'layout.json'),'utf8')).toBe(before);
 });
 it('serializes writes and survives a new store instance',async()=>{
  const root=await mkdtemp(join(tmpdir(),'p0-restart-')),store=new SettingsStore(root),first=settings(),last=settings();last.dashboard.widgets[0].visible=false;
  await Promise.all([store.write(first),store.write(last)]);
  expect(await new SettingsStore(root).read()).toEqual(last);
 });
 it('preserves corrupt settings instead of silently resetting',async()=>{
  const root=await mkdtemp(join(tmpdir(),'p0-corrupt-'));await writeFile(join(root,'layout.json'),'SYNTHETIC CORRUPT');
  await expect(new SettingsStore(root).read()).rejects.toThrow('preserved');expect(await readFile(join(root,'layout.json'),'utf8')).toBe('SYNTHETIC CORRUPT');
 });
 it('bounds settings and accepts only the existing schema',()=>{expect(validateSettings(settings())).toEqual(settings());expect(()=>validateSettings({...settings(),version:2})).toThrow();});
});
