import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {expect,it,vi} from 'vitest';
import type {SurfaceSettingsBridge,SettingsWindowBridge,WorkspaceNavigationBridge} from '../desktop-surface-protocol';
import type {MonitorProfilesBridge,MonitorSnapshot} from '../monitor-protocol';

type IpcListener=(_event:unknown,payload:unknown)=>void;
function loadPreload(path:string){
  const exposed:Record<string,unknown>={};
  const listeners=new Map<string,IpcListener>();
  const invoke=vi.fn(async(..._args:unknown[])=>undefined);
  const removeListener=vi.fn((channel:string)=>listeners.delete(channel));
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:()=>({
    contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},
    ipcRenderer:{invoke,on:(channel:string,listener:IpcListener)=>listeners.set(channel,listener),removeListener},
    webUtils:{getPathForFile:()=>''},
  })});
  return {exposed,listeners,invoke,removeListener};
}

it('restricts Settings to configuration owners without exposing product execution or raw IPC',()=>{
  const {exposed}=loadPreload('electron-p0/preload/settings-preload.cts');
  expect(Object.keys(exposed).sort()).toEqual(['electronMonitorProfiles','electronSchoolSettings','electronSettingsWindow','electronSurfaceSettings','electronWork']);
  expect(exposed.electronSurfaceSettings).toMatchObject({read:expect.any(Function),write:expect.any(Function),subscribe:expect.any(Function)});
  const work=exposed.electronWork;
  expect(work).toBeTypeOf('object');
  expect(Object.keys(Object(work)).sort()).toEqual(['account','admin','ai','chatgpt','school']);
  expect(work).toHaveProperty('admin.applySchoolAddresses');
  expect(work).toHaveProperty('admin.openSystem');
  expect(work).toHaveProperty('admin.cancel');
  expect(Object.isFrozen(work)).toBe(true);
  for(const owner of Object.values(Object(work)))expect(Object.isFrozen(owner)).toBe(true);
  expect(Object.keys(Object(Reflect.get(Object(work),'account'))).sort()).toEqual(['applySchool','cancel','refresh','signIn','signOut','status']);
  expect(Object.keys(Object(Reflect.get(Object(work),'school'))).sort()).toEqual(['cancel','load','search','select']);
  expect(Object.keys(Object(Reflect.get(Object(work),'admin'))).sort()).toEqual(['applySchoolAddresses','cancel','openSystem','schoolAddresses']);
  expect(Object.keys(Object(Reflect.get(Object(work),'ai'))).sort()).toEqual(['cancel','connectFromClipboard','disconnect','restore','selectModel','status']);
  expect(Object.keys(Object(Reflect.get(Object(work),'chatgpt'))).sort()).toEqual(['acknowledge','cancel','disconnect','refreshModels','selectModel','signIn','status']);
  expect(work).toHaveProperty('account.status');
  expect(work).toHaveProperty('school.load');
  expect(work).toHaveProperty('admin.schoolAddresses');
  expect(work).not.toHaveProperty('ai.generate');
  expect(work).not.toHaveProperty('chatgpt.generate');
  for(const forbidden of ['invoke','send','on','finance','inventoryLocalQa','fileDrop','purchase','newsletter','recordHelper','workFolders'])expect(work).not.toHaveProperty(forbidden);
});

it('exposes only fixed monitor profile operations and strips native events from profile snapshots',async()=>{
  const {exposed,listeners,invoke,removeListener}=loadPreload('electron-p0/preload/settings-preload.cts');
  const bridge=exposed.electronMonitorProfiles as MonitorProfilesBridge;
  expect(Object.keys(bridge).sort()).toEqual(['read','subscribe','write']);
  expect(Object.isFrozen(bridge)).toBe(true);
  await bridge.read();
  expect(invoke).toHaveBeenLastCalledWith('p0:monitor-profiles:read');
  const request={revision:4,profileId:'synthetic-monitor',layout:{version:1},visible:true};
  await bridge.write(request);
  expect(invoke).toHaveBeenLastCalledWith('p0:monitor-profiles:write',request);
  const snapshot:MonitorSnapshot={revision:5,profiles:[],writable:true,error:null};
  const listener=vi.fn(),dispose=bridge.subscribe(listener);
  const callback=listeners.get('p0:monitor-profiles:changed');
  expect(callback).toBeTypeOf('function');
  callback?.({secret:'native event'},snapshot);
  expect(listener).toHaveBeenCalledExactlyOnceWith(snapshot);
  dispose();
  expect(removeListener).toHaveBeenCalledWith('p0:monitor-profiles:changed',callback);
  expect(listeners.has('p0:monitor-profiles:changed')).toBe(false);
});

it('uses fixed Settings read/write and event channels and removes the exact settings listener',async()=>{
  const {exposed,listeners,invoke,removeListener}=loadPreload('electron-p0/preload/settings-preload.cts');
  const bridge=exposed.electronSurfaceSettings as SurfaceSettingsBridge;
  const snapshot={revision:3,value:null};
  const listener=vi.fn(),dispose=bridge.subscribe(listener);
  const callback=listeners.get('p0:surface-settings:changed');
  callback?.({secret:'native event'},snapshot);
  expect(listener).toHaveBeenCalledExactlyOnceWith(snapshot);
  await bridge.read();
  expect(invoke).toHaveBeenLastCalledWith('p0:surface-settings:read');
  const request={revision:3,value:{version:1 as const,dashboard:null,dock:null}};
  await bridge.write(request);
  expect(invoke).toHaveBeenLastCalledWith('p0:surface-settings:write',request);
  dispose();
  expect(removeListener).toHaveBeenCalledWith('p0:surface-settings:changed',callback);
  expect(listeners.has('p0:surface-settings:changed')).toBe(false);
});

it('keeps new Workspace navigation separate from the existing SCHOOL product global',()=>{
  const {exposed}=loadPreload('electron-p0/preload/preload.cts');
  expect(Object.keys(Object(exposed.electronDesktopNavigation)).sort()).toEqual(['onEntry','openSettings','ready']);
  expect(Object.keys(Object(exposed.electronSurfaceSettings)).sort()).toEqual(['onFlush','onResume','read','subscribe','write']);
  expect(exposed.electronDesktopNavigation).not.toBe(exposed.electronWorkspace);
  expect(exposed).not.toHaveProperty('electronMonitorProfiles');
});

it('sends Settings window actions on fixed channels and forwards only section payloads',async()=>{
  const {exposed,listeners,invoke,removeListener}=loadPreload('electron-p0/preload/settings-preload.cts');
  const bridge=exposed.electronSettingsWindow as SettingsWindowBridge;
  expect(Object.keys(bridge).sort()).toEqual(['close','info','onSection','openWorkspace','ready']);
  expect(Object.isFrozen(bridge)).toBe(true);
  await bridge.info();expect(invoke).toHaveBeenLastCalledWith('p0:settings-window:info');
  await bridge.ready();expect(invoke).toHaveBeenLastCalledWith('p0:settings-window:ready');
  await bridge.close();expect(invoke).toHaveBeenLastCalledWith('p0:settings-window:close');
  await bridge.openWorkspace();expect(invoke).toHaveBeenLastCalledWith('p0:settings-window:open-workspace');
  const listener=vi.fn(),dispose=bridge.onSection(listener);
  const callback=listeners.get('p0:settings-window:section');
  callback?.({secret:'native event'},'dock');
  expect(listener).toHaveBeenCalledExactlyOnceWith('dock');
  dispose();expect(removeListener).toHaveBeenCalledWith('p0:settings-window:section',callback);
});

it('routes Workspace readiness and Settings requests without changing the SCHOOL bridge',async()=>{
  const {exposed,listeners,invoke,removeListener}=loadPreload('electron-p0/preload/preload.cts');
  const bridge=exposed.electronDesktopNavigation as WorkspaceNavigationBridge;
  expect(Object.isFrozen(bridge)).toBe(true);
  await bridge.ready();expect(invoke).toHaveBeenLastCalledWith('p0:desktop-navigation:ready');
  await bridge.openSettings();expect(invoke).toHaveBeenLastCalledWith('p0:desktop-navigation:open-settings','account');
  await bridge.openSettings('appearance');expect(invoke).toHaveBeenLastCalledWith('p0:desktop-navigation:open-settings','appearance');
  const listener=vi.fn(),dispose=bridge.onEntry(listener),entry={kind:'module',moduleId:'finance'};
  const callback=listeners.get('p0:desktop-navigation:entry');
  callback?.({secret:'native event'},entry);
  expect(listener).toHaveBeenCalledExactlyOnceWith(entry);
  dispose();expect(removeListener).toHaveBeenCalledWith('p0:desktop-navigation:entry',callback);
  expect(exposed.electronWorkspace).toHaveProperty('school');
  expect(exposed.electronWorkspace).toHaveProperty('inventory');
  expect(exposed.electronWorkspace).not.toHaveProperty('openSettings');
});

it.each(['settings-preload.cts','preload.cts'])('rejects an unsandboxed or unisolated %s before exposing bridges',path=>{
  const code=ts.transpileModule(readFileSync('electron-p0/preload/'+path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const process of [{sandboxed:false,contextIsolated:true},{sandboxed:true,contextIsolated:false}]){
    const exposeInMainWorld=vi.fn();
    expect(()=>runInNewContext(code,{exports:{},process,require:()=>({contextBridge:{exposeInMainWorld},ipcRenderer:{}})})).toThrow(/sandboxed isolated/);
    expect(exposeInMainWorld).not.toHaveBeenCalled();
  }
});

it.each(['settings-preload.cts','preload.cts'])('strips native event and payload from school settings notifications in %s',path=>{
  const {exposed,listeners,removeListener}=loadPreload('electron-p0/preload/'+path);
  const bridge=exposed.electronSchoolSettings as {readonly subscribe:(listener:()=>void)=>()=>void};
  expect(Object.keys(bridge)).toEqual(['subscribe']);
  expect(Object.isFrozen(bridge)).toBe(true);
  const listener=vi.fn(),dispose=bridge.subscribe(listener);
  const callback=listeners.get('p0:school-settings:changed');
  callback?.({secret:'native event'},{privateSchoolData:'must not cross'});
  expect(listener).toHaveBeenCalledExactlyOnceWith();
  dispose();
  expect(removeListener).toHaveBeenCalledWith('p0:school-settings:changed',callback);
  expect(listeners.has('p0:school-settings:changed')).toBe(false);
});

it.each(['settings-preload.cts','preload.cts'])('strips native event and payload from settings resume notifications in %s',path=>{
  const {exposed,listeners,removeListener}=loadPreload('electron-p0/preload/'+path);
  const bridge=exposed.electronSurfaceSettings as SurfaceSettingsBridge;
  const listener=vi.fn(),dispose=bridge.onResume?.(listener);
  const callback=listeners.get('p0:surface-settings:resume');
  callback?.({secret:'native event'},{privateState:'must not cross'});
  expect(listener).toHaveBeenCalledExactlyOnceWith();
  expect(dispose).toBeTypeOf('function');
  dispose?.();
  expect(removeListener).toHaveBeenCalledWith('p0:surface-settings:resume',callback);
  expect(listeners.has('p0:surface-settings:resume')).toBe(false);
});

it.each([
  ['settings-preload.cts',true],['settings-preload.cts',false],
  ['preload.cts',true],['preload.cts',false],
] as const)('reports flush result from %s with success=%s without exposing native event or request ID',async(path,success)=>{
  const {exposed,listeners,invoke,removeListener}=loadPreload('electron-p0/preload/'+path);
  const bridge=exposed.electronSurfaceSettings as SurfaceSettingsBridge;
  const listener=success?vi.fn(async()=>undefined):vi.fn(async()=>{throw new Error('synthetic save failure');});
  const dispose=bridge.onFlush?.(listener);
  const callback=listeners.get('p0:surface-settings:flush-request');
  callback?.({secret:'native event'},73);
  await Promise.resolve();
  expect(listener).toHaveBeenCalledExactlyOnceWith();
  expect(invoke).toHaveBeenCalledExactlyOnceWith('p0:surface-settings:flush-result',73,success);
  expect(dispose).toBeTypeOf('function');
  dispose?.();
  expect(removeListener).toHaveBeenCalledWith('p0:surface-settings:flush-request',callback);
  expect(listeners.has('p0:surface-settings:flush-request')).toBe(false);
});
