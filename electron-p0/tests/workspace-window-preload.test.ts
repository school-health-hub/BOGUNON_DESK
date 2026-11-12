import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {expect,it,vi} from 'vitest';

it('exposes only the typed Workspace close request and resolution surface',async()=>{
  const exposed:Record<string,unknown>={},listeners=new Map<string,Function>();
  const invoke=vi.fn(async()=>undefined),removeListener=vi.fn((channel:string)=>listeners.delete(channel));
  const code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:()=>({
    contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},
    ipcRenderer:{invoke,on:(channel:string,listener:Function)=>listeners.set(channel,listener),removeListener},
    webUtils:{getPathForFile:()=>''},
  })});
  const bridge=exposed.electronP0 as {onWorkspaceCloseRequest:(listener:(request:{id:number})=>void)=>()=>void;resolveWorkspaceClose:(resolution:{id:number;allow:boolean})=>Promise<void>};
  const listener=vi.fn(),dispose=bridge.onWorkspaceCloseRequest(listener);

  listeners.get('p0:workspace-window:close-request')?.({}, {id:7});
  await bridge.resolveWorkspaceClose({id:7,allow:false});
  dispose();

  expect(listener).toHaveBeenCalledWith({id:7});
  expect(invoke).toHaveBeenCalledWith('p0:workspace-window:resolve-close',{id:7,allow:false});
  expect(removeListener).toHaveBeenCalledWith('p0:workspace-window:close-request',expect.any(Function));
});
