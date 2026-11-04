import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {it,expect,vi} from 'vitest';
it('exposes only typed ChatGPT operations with no token, URL or arbitrary native execution',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:null}));
 const code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error('Unexpected dependency');return {contextBridge:{exposeInMainWorld:(name:string,value:unknown)=>{exposed[name]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.chatgpt;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api).sort()).toEqual(['status','signIn','refreshModels','selectModel','acknowledge','disconnect','generate','cancel'].sort());
 for(const action of ['status','signIn','refreshModels','acknowledge','disconnect','cancel']){await api[action]();expect(invoke).toHaveBeenLastCalledWith('p2:chatgpt:'+action);}
 await api.selectModel({model:'gpt-synthetic'});expect(invoke).toHaveBeenLastCalledWith('p2:chatgpt:selectModel',{model:'gpt-synthetic'});
 await api.generate({tool:'finder',prompt:'합성'});expect(invoke).toHaveBeenLastCalledWith('p2:chatgpt:generate',{tool:'finder',prompt:'합성'});
});
