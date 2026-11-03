import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {expect,it,vi} from 'vitest';
it('keeps the local API explicit and sends only a document and optional concurrency token',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>null);
 const code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error('Unexpected dependency');return {contextBridge:{exposeInMainWorld:(name:string,value:unknown)=>{exposed[name]=value;}},ipcRenderer:{invoke}};}});
 const inventory=exposed.electronWork.inventory;expect(Object.keys(inventory).sort()).toEqual(['load','save']);expect(Object.isFrozen(inventory)).toBe(true);
 const document={version:1,items:[],lots:[],movements:[],updatedAt:'synthetic'};
 await inventory.load();expect(invoke.mock.calls.at(-1)).toEqual(['p2:inventory:load']);
 await inventory.save(document);expect(invoke.mock.calls.at(-1)).toEqual(['p2:inventory:save',document]);
 await inventory.save(document,null);expect(invoke.mock.calls.at(-1)).toEqual(['p2:inventory:save',document,null]);
 await inventory.save(document,'2026-11-02T00:00:00Z');expect(invoke.mock.calls.at(-1)).toEqual(['p2:inventory:save',document,'2026-11-02T00:00:00Z']);
});
