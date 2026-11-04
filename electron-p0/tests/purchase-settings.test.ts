import {afterEach,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {PurchaseSettingsStore,PurchaseSettingsConflict,emptyPurchaseSettings,validatePurchaseSettings,createPurchaseSettingsHandlers} from '../main/purchase-settings';
import {normalizePurchaseDraftTemplates as originalDraft} from '../../src/purchase/purchaseDraftSettings';
import {normalizePurchaseImportTemplates as originalImport} from '../../src/purchase/purchaseImportSettings';
import {normalizePurchaseOutputColumns as originalColumns} from '../../src/purchase/purchaseDomain';
import {normalizePurchaseDraftTemplates,normalizePurchaseImportTemplates} from '../main/purchase-settings-normalize';
import {defaultPurchaseDraftTemplate} from '../renderer/purchase/purchase/purchaseDraft';
const dirs:string[]=[];
async function root(){const d=await mkdtemp(join(tmpdir(),'purchase-settings-'));dirs.push(d);return d;}
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const draft={...defaultPurchaseDraftTemplate,id:'draft-template-synthetic',name:'합성 양식'};
const mapping={id:'import-template-synthetic',name:'합성 CSV',headerSignature:['대상','개입','예상값'],mapping:{name:0,quantity:1,unitPrice:2}};
const document=()=>({...emptyPurchaseSettings(),draftTemplates:[draft],importTemplates:[mapping],outputColumns:['name','note','amount'] as const});
it('selectively reuses the exact Tauri normalizer contract without touching its storage',()=>{
 const fixtures=[null,{},[],[draft],[{...draft,name:'  합성  ',titlePattern:'invalid',detailFieldOrder:['amount','amount']}],[draft,draft]];
 for(const value of fixtures)expect(normalizePurchaseDraftTemplates(value)).toEqual(originalDraft(value));
 for(const value of [null,{},[],[mapping],[mapping,mapping],[{...mapping,mapping:{name:0,quantity:0}}]])expect(normalizePurchaseImportTemplates(value)).toEqual(originalImport(value));
 expect(validatePurchaseSettings(document()).outputColumns).toEqual(originalColumns(document().outputColumns));
});
it('restores template CRUD, mapping and output order after new store instances with a preceding backup',async()=>{
 const dir=await root(),store=new PurchaseSettingsStore(dir);expect((await store.load()).document).toEqual(emptyPurchaseSettings());
 const one=await store.save(document(),0),two=await new PurchaseSettingsStore(dir).save({...one.document,draftTemplates:[{...draft,name:'합성 수정'}]},1);
 expect((await new PurchaseSettingsStore(dir).load()).document).toEqual(two.document);
 expect(JSON.parse(await readFile(join(dir,'settings.backup.json'),'utf8'))).toEqual(one.document);
 const deleted=await store.save({...two.document,draftTemplates:[],importTemplates:[]},2);
 expect((await new PurchaseSettingsStore(dir).load()).document).toEqual(deleted.document);
 expect(deleted.document.outputColumns).toEqual(['name','note','amount']);
 expect((await readdir(dir)).some(n=>n.endsWith('.tmp'))).toBe(false);
});
it('rejects schema/version/limit/unknown field/duplicate source corruption instead of silently normalizing it',()=>{
 const d=document();
 for(const invalid of [{...d,version:2},{...d,revision:-1},{...d,path:'forged'},{...d,items:[]},{...d,outputColumns:['note']},{...d,outputColumns:['name','name']},{...d,draftTemplates:[{...draft,titlePattern:'missing token'}]},{...d,draftTemplates:[draft,draft]},{...d,importTemplates:[{...mapping,mapping:{name:0,quantity:0}}]},{...d,importTemplates:[{...mapping,headerSignature:['a','','c']}]},{...d,draftTemplates:Array(11).fill(draft)}])expect(()=>validatePurchaseSettings(invalid)).toThrow();
 expect(()=>validatePurchaseSettings({...d,draftTemplates:[{...draft,id:'x'.repeat(201)}]})).toThrow();
});
it.each(['SYNTHETIC CORRUPT',JSON.stringify({...document(),version:2})])('preserves invalid primary bytes with read-only fallback: %s',async bytes=>{
 const dir=await root(),store=new PurchaseSettingsStore(dir),one=await store.save(document(),0);await store.save({...one.document,draftTemplates:[]},1);
 await writeFile(join(dir,'settings.json'),bytes);const recovered=await new PurchaseSettingsStore(dir).load();expect(recovered.recovered).toBe(true);expect(recovered.document).toEqual(one.document);
 await expect(store.save(recovered.document,1)).rejects.toThrow();expect(await readFile(join(dir,'settings.json'),'utf8')).toBe(bytes);
});
it('does not reset a corrupt file with no backup; write failure preserves previous valid primary and backup',async()=>{
 const dir=await root();await writeFile(join(dir,'settings.json'),'broken');const store=new PurchaseSettingsStore(dir);await expect(store.load()).rejects.toThrow();await expect(store.save(document(),0)).rejects.toThrow();expect(await readFile(join(dir,'settings.json'),'utf8')).toBe('broken');
 const clean=await root(),one=await new PurchaseSettingsStore(clean).save(document(),0),before=await readFile(join(clean,'settings.json'));
 const denied=new PurchaseSettingsStore(clean,async()=>{throw Error('synthetic denied');});await expect(denied.save({...one.document,draftTemplates:[]},1)).rejects.toThrow();expect(await readFile(join(clean,'settings.json'))).toEqual(before);expect(JSON.parse(await readFile(join(clean,'settings.backup.json'),'utf8'))).toEqual(one.document);
});
it('serializes writes and rejects stale concurrent revisions without losing prior templates',async()=>{
 const store=new PurchaseSettingsStore(await root()),one=await store.save(document(),0),a=store.save({...one.document,outputColumns:['name','amount']},1),b=store.save({...one.document,draftTemplates:[]},1);
 await a;await expect(b).rejects.toBeInstanceOf(PurchaseSettingsConflict);expect((await store.load()).document.draftTemplates).toEqual([draft]);
});
it('denies symlinked settings instead of following them',async()=>{
 const dir=await root(),other=join(await root(),'original.json');await writeFile(other,JSON.stringify(document()));await symlink(other,join(dir,'settings.json'));
 const store=new PurchaseSettingsStore(dir);await expect(store.load()).rejects.toThrow();await expect(store.save(document(),0)).rejects.toThrow();expect(await readFile(other,'utf8')).toBe(JSON.stringify(document()));
});
it('accepts only owned top-frame typed IPC with exact arguments and safe errors',async()=>{
 const url='file:///qa',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame},h=createPurchaseSettingsHandlers(wc,url,new PurchaseSettingsStore(await root()));
 expect(await h.load({...event,sender:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(await h.save({...event,senderFrame:{}},document(),0)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(await h.load(event,'path')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await h.save(event,document(),0,'path')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await h.save(event,{...document(),version:3},0)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await h.save(event,document(),0)).toMatchObject({ok:true,data:{document:{revision:1}}});
 expect(await h.save(event,document(),0)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
});
it('preload exposes frozen settings load/save without a filesystem or generic invoke bridge',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:{}}));
 const output=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(output,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error();return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.purchase.settings;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api)).toEqual(['load','save']);await api.load('forged');expect(invoke.mock.calls.at(-1)).toEqual(['p2:purchase:settings:load']);await api.save(document(),0);expect(invoke.mock.calls.at(-1)).toEqual(['p2:purchase:settings:save',document(),0]);expect(exposed.electronWork.invoke).toBeUndefined();
});
