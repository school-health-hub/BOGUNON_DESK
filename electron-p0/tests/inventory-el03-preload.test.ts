import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {expect,it,vi} from 'vitest';
import {INVENTORY_QA_ACTIONS} from '../inventory-qa-protocol';
it('exposes only typed business methods and existing health, never raw transport/URL/token/invoke',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>null);
 const emitted=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(emitted,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error('Unexpected preload dependency');return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value}},ipcRenderer:{invoke}}}});
 const local=exposed.electronWork.inventoryLocalQa;expect(Object.keys(local).sort()).toEqual(['business','status']);expect(Object.keys(local.business).sort()).toEqual([...INVENTORY_QA_ACTIONS].sort());expect(Object.isFrozen(local.business)).toBe(true);
 const zero=['logout','authState','dispose'];for(const method of INVENTORY_QA_ACTIONS){const input={synthetic:true};await local.business[method](...(zero.includes(method)?[]:[input]));expect(invoke.mock.calls.at(-1)).toEqual([`p2:inventory-local-qa:${method}`,...(zero.includes(method)?[]:[input])]);}
 await local.status();expect(invoke.mock.calls.at(-1)).toEqual(['p2:inventory-local-qa:status']);
});
