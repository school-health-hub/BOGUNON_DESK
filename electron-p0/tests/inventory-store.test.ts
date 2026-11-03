import {describe,expect,it} from 'vitest';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {InventoryStore,validateInventoryDocument} from '../main/inventory-store';
import {createSyntheticInventory} from '../../src/inventory-management/model';

describe('Electron Inventory isolated store',()=>{
 it('persists and reloads the bounded v1 document',async()=>{
  const root=await mkdtemp(join(tmpdir(),'inventory-store-'));const store=new InventoryStore(root);
  const saved=await store.save(createSyntheticInventory('2026-11-02'));
  expect(await new InventoryStore(root).load()).toEqual({document:saved.document,recovered:false});
 });
 it('rejects path, credential and cross-item lot fields',()=>{
  const valid=createSyntheticInventory('2026-11-02');
  for(const value of [{...valid,path:'C:/private'},{...valid,token:'secret'},{...valid,lots:[{...valid.lots[0],itemId:'other'}]},{...valid,lots:[valid.lots[0],valid.lots[0]]},{...valid,lots:[{...valid.lots[0],expirationDate:'2026-99-99'}]}])expect(()=>validateInventoryDocument(value)).toThrow();
 });
 it('preserves corrupt primary bytes and recovers the last good backup',async()=>{
  const root=await mkdtemp(join(tmpdir(),'inventory-recover-'));const store=new InventoryStore(root);
  const first=createSyntheticInventory('2026-11-02');await store.save(first);await store.save({...first,updatedAt:'2026-11-02T10:00:00.000Z'});
  await writeFile(join(root,'inventory.json'),'SYNTHETIC CORRUPT');const loaded=await new InventoryStore(root).load();
  expect(loaded.recovered).toBe(true);expect(loaded.document?.updatedAt).toBe(first.updatedAt);expect(await readFile(join(root,'inventory.json'),'utf8')).toBe('SYNTHETIC CORRUPT');
 });
});

import {rename,readdir} from 'node:fs/promises';
import {applyInventoryMovement} from '../../src/inventory-management/model';
it('rejects stale saves and keeps v1 backups/history with no schema migration',async()=>{
 const root=await mkdtemp(join(tmpdir(),'inventory-cas-')),store=new InventoryStore(root),legacy=createSyntheticInventory('2026-11-02');
 await store.save(legacy);const updated=applyInventoryMovement(legacy,{kind:'use',itemId:'synthetic-gloves',quantity:1,reason:'합성 사용'},'2026-11-02T10:00:00Z');
 const saved=await store.save(updated,legacy.updatedAt);const bytes=await readFile(join(root,'inventory.json'));
 await expect(store.save(legacy,legacy.updatedAt)).rejects.toThrow();expect(await readFile(join(root,'inventory.json'))).toEqual(bytes);expect(JSON.parse(await readFile(join(root,'inventory.backup.json'),'utf8'))).toEqual(legacy);
 await expect(store.save({...saved.document,movements:[]},saved.document.updatedAt)).rejects.toThrow('append only');
 expect(Object.keys(saved.document).sort()).toEqual(['version','updatedAt','items','lots','movements'].sort());
});
it('preserves original and backup when atomic replacement fails and cleans temp files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'inventory-write-fail-')),seed=createSyntheticInventory('2026-11-02');await new InventoryStore(root).save(seed);
 const bytes=await readFile(join(root,'inventory.json'));const commit=async(temp:string,target:string)=>{if(target.endsWith('inventory.json'))throw Object.assign(Error('denied'),{code:'EPERM'});await rename(temp,target);};
 await expect(new InventoryStore(root,commit).save({...seed,updatedAt:'2026-11-03T00:00:00Z'},seed.updatedAt)).rejects.toThrow();expect(await readFile(join(root,'inventory.json'))).toEqual(bytes);expect(JSON.parse(await readFile(join(root,'inventory.backup.json'),'utf8'))).toEqual(seed);expect((await readdir(root)).some(name=>name.endsWith('.tmp'))).toBe(false);
});
it('does not overwrite a corrupt original or good recovery backup',async()=>{
 const root=await mkdtemp(join(tmpdir(),'inventory-readonly-')),doc=createSyntheticInventory('2026-11-02');await writeFile(join(root,'inventory.backup.json'),JSON.stringify(doc));await writeFile(join(root,'inventory.json'),'broken synthetic');
 const store=new InventoryStore(root);expect((await store.load()).recovered).toBe(true);await expect(store.save(doc,doc.updatedAt)).rejects.toThrow('read only');expect(await readFile(join(root,'inventory.json'),'utf8')).toBe('broken synthetic');expect(JSON.parse(await readFile(join(root,'inventory.backup.json'),'utf8'))).toEqual(doc);
});
it('rejects overflow totals and rolled dates at Main boundary',()=>{
 const doc=createSyntheticInventory('2026-11-02');expect(()=>validateInventoryDocument({...doc,lots:doc.lots.map(l=>({...l,balance:Number.MAX_SAFE_INTEGER}))})).toThrow('overflow');expect(()=>validateInventoryDocument({...doc,lots:[{...doc.lots[0],expirationDate:'2027-02-30'}]})).toThrow();
});
