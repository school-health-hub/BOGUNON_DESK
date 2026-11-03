import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';import {it,expect,vi} from 'vitest';
it('exposes only named AI operations, never token/key reads, URL, fetch or arbitrary invoke',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:null}));const code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error('Unexpected dependency');return {contextBridge:{exposeInMainWorld:(name:string,value:unknown)=>{exposed[name]=value;}},ipcRenderer:{invoke}};}});
 const bridge=exposed.electronWork.ai;expect(Object.isFrozen(bridge)).toBe(true);expect(Object.keys(bridge).sort()).toEqual(['status','connectFromClipboard','restore','selectModel','disconnect','cancel','generate'].sort());
 for(const method of ['status','restore','disconnect','cancel']){await bridge[method]();expect(invoke.mock.calls.at(-1)).toEqual([`p2:ai:${method}`]);}
 for(const [method,input] of [['connectFromClipboard',{provider:'openai',remember:false}],['selectModel',{model:'gpt-synthetic'}],['generate',{tool:'finder',prompt:'합성'}]]){await bridge[method as string](input);expect(invoke.mock.calls.at(-1)).toEqual([`p2:ai:${method}`,input]);}
 const html=readFileSync('electron-p0/renderer/index.html','utf8');expect(html).not.toMatch(/api\.openai|generativelanguage/);
});
