import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';import {it,expect,vi} from 'vitest';
it('exposes a frozen, zero-argument Finder save method without renderer paths or a raw IPC API',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:{status:'canceled'}}));
 const emitted=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(emitted,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error('Unexpected dependency');return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.educationVideo;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api).sort()).toEqual(['load','save','import','export','exportFile','recover'].sort());
 expect(await api.exportFile({path:'forged.json'})).toEqual({ok:true,data:{status:'canceled'}});expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:export-file']);expect(exposed.electronWork.invoke).toBeUndefined();
});
