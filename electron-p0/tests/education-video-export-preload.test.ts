import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';import {it,expect,vi} from 'vitest';
it('exposes a frozen, zero-argument Finder save method without renderer paths or a raw IPC API',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:{status:'canceled'}}));
 const emitted=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(emitted,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error('Unexpected dependency');return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.educationVideo;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api).sort()).toEqual(['load','save','import','export','exportFile','recover','searchProvider'].sort());
 expect(await api.exportFile({path:'forged.json'})).toEqual({ok:true,data:{status:'canceled'}});expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:export-file']);expect(exposed.electronWork.invoke).toBeUndefined();
});

it('exposes only typed search operations with no raw key/URL/IPC passthrough',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:null}));const code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error();return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.educationVideo.searchProvider;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api).sort()).toEqual(['status','connectFromClipboard','restore','disconnect','search','cancel','openVideo'].sort());await api.status('forged');expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:search:status']);await api.connectFromClipboard({remember:false});expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:search:connectFromClipboard',{remember:false}]);await api.openVideo({videoId:'QaVideo0001'});expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:search:openVideo',{videoId:'QaVideo0001'}]);expect(api.fetch).toBeUndefined();expect(api.invoke).toBeUndefined();
});
