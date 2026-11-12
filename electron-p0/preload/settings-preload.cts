import {contextBridge,ipcRenderer} from 'electron';
import type {SurfaceSettingsBridge,SettingsWindowBridge,SurfaceSettingsSnapshot,SurfaceSettingsWrite} from '../desktop-surface-protocol.js';
if(!process.sandboxed||!process.contextIsolated)throw new Error('Settings requires a sandboxed isolated preload');
const call=<T,>(channel:string,...args:readonly unknown[]):Promise<T>=>ipcRenderer.invoke(channel,...args);
const settings:SurfaceSettingsBridge=Object.freeze({
 onResume:(listener:()=>void)=>{const callback=()=>listener();ipcRenderer.on('p0:surface-settings:resume',callback);return()=>{ipcRenderer.removeListener('p0:surface-settings:resume',callback);};},
 onFlush:(listener:()=>Promise<void>)=>{const callback=(_event:unknown,id:number)=>{void listener().then(()=>ipcRenderer.invoke('p0:surface-settings:flush-result',id,true),()=>ipcRenderer.invoke('p0:surface-settings:flush-result',id,false)).catch(()=>{});};ipcRenderer.on('p0:surface-settings:flush-request',callback);return()=>{ipcRenderer.removeListener('p0:surface-settings:flush-request',callback);};},
 read:()=>call<SurfaceSettingsSnapshot>('p0:surface-settings:read'),write:(request:SurfaceSettingsWrite)=>call<SurfaceSettingsSnapshot>('p0:surface-settings:write',request),
 subscribe:(listener:Parameters<SurfaceSettingsBridge['subscribe']>[0])=>{const callback=(_event:unknown,snapshot:Parameters<typeof listener>[0])=>listener(snapshot);ipcRenderer.on('p0:surface-settings:changed',callback);return()=>{ipcRenderer.removeListener('p0:surface-settings:changed',callback);};},
});
const windowBridge:SettingsWindowBridge=Object.freeze({
 info:()=>call<import('../protocol.js').P0Info>('p0:settings-window:info'),ready:()=>call<void>('p0:settings-window:ready'),
 close:()=>call<void>('p0:settings-window:close'),openWorkspace:()=>call<void>('p0:settings-window:open-workspace'),
 onSection:(listener:Parameters<SettingsWindowBridge['onSection']>[0])=>{const callback=(_event:unknown,section:Parameters<typeof listener>[0])=>listener(section);ipcRenderer.on('p0:settings-window:section',callback);return()=>{ipcRenderer.removeListener('p0:settings-window:section',callback);};},
});
contextBridge.exposeInMainWorld('electronSurfaceSettings',settings);
contextBridge.exposeInMainWorld('electronSchoolSettings',Object.freeze({subscribe:(listener:()=>void)=>{const callback=()=>listener();ipcRenderer.on('p0:school-settings:changed',callback);return()=>{ipcRenderer.removeListener('p0:school-settings:changed',callback);};}}));
contextBridge.exposeInMainWorld('electronSettingsWindow',windowBridge);
const methods=(group:string,names:readonly string[])=>Object.freeze(Object.fromEntries(names.map(name=>[name,(...args:readonly unknown[])=>call('p0:settings:'+group+':'+name,...args)])));
contextBridge.exposeInMainWorld('electronWork',Object.freeze({
 school:methods('school',['load','search','select','cancel']),
 account:methods('account',['status','signIn','signOut','cancel','refresh','applySchool']),
 admin:methods('admin',['schoolAddresses','applySchoolAddresses','openSystem','cancel']),
 ai:methods('ai',['status','connectFromClipboard','restore','selectModel','cancel','disconnect']),
 chatgpt:methods('chatgpt',['status','signIn','refreshModels','selectModel','acknowledge','disconnect','cancel']),
}));
