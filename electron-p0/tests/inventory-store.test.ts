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
