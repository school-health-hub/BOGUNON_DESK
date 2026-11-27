import {contextBridge,ipcRenderer,type IpcRendererEvent} from 'electron';
import type {UpdateState} from '../update-protocol.js';
if(!process.sandboxed||!process.contextIsolated)throw new Error('Update window requires an isolated sandbox');
contextBridge.exposeInMainWorld('electronUpdate',Object.freeze({
  status:()=>ipcRenderer.invoke('p0:update:status') as Promise<UpdateState>,
  check:()=>ipcRenderer.invoke('p0:update:check') as Promise<UpdateState>,
  download:()=>ipcRenderer.invoke('p0:update:download') as Promise<UpdateState>,
  cancel:()=>ipcRenderer.invoke('p0:update:cancel') as Promise<UpdateState>,
  install:()=>ipcRenderer.invoke('p0:update:install') as Promise<UpdateState>,
  dismiss:()=>ipcRenderer.send('p0:update:dismiss'),
  confirmInstall:(id:string,approved:boolean)=>ipcRenderer.invoke('p0:update:confirm-install',id,approved) as Promise<void>,
  onState:(listener:(state:UpdateState)=>void)=>{const callback=(_event:IpcRendererEvent,state:UpdateState)=>listener(state);ipcRenderer.on('p0:update:state',callback);return()=>ipcRenderer.removeListener('p0:update:state',callback);},
}));
