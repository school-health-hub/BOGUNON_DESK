import {contextBridge,ipcRenderer} from 'electron';
import type {PaletteBridge,PaletteRect,PaletteSurface,PaletteWidgetAction} from '../palette-protocol.js';
import type {P0Settings,MemoDocument,IpcResult} from '../protocol.js';
import type {EventLoad} from '../local-events.js';
import type {LocalTaskLoad} from '../local-tasks.js';
if(!process.sandboxed||!process.contextIsolated)throw new Error('Desktop Palette requires a sandboxed isolated preload');
const call=<T,>(channel:string,...args:readonly unknown[])=>ipcRenderer.invoke(channel,...args) as Promise<T>;
const bridge:PaletteBridge=Object.freeze({
  readSurface:()=>call<PaletteSurface>('p0:palette:read-surface'),writeLayout:(layout:unknown)=>call<PaletteSurface>('p0:palette:write-layout',layout),
  updateWidget:(action:PaletteWidgetAction)=>call<PaletteSurface>('p0:palette:update-widget',action),setDockMonitor:()=>call<PaletteSurface>('p0:palette:set-dock-monitor'),onSurfaceChanged:(listener:()=>void)=>{const run=()=>listener();ipcRenderer.on('p0:palette:surface-changed',run);return()=>ipcRenderer.removeListener('p0:palette:surface-changed',run);},
  beginEdit:()=>call<void>('p0:palette:begin-edit'),finishEdit:(commit:boolean)=>call<PaletteSurface>('p0:palette:finish-edit',commit),
  readSettings:()=>call<P0Settings|null>('p0:palette:read-settings'),ready:()=>call<void>('p0:palette:ready'),setHitRegions:(regions:readonly PaletteRect[])=>call<void>('p0:palette:set-hit-regions',regions),setInteractive:(interactive:boolean)=>call<void>('p0:palette:set-interactive',interactive),
  openWorkspace:()=>call<void>('p0:palette:open-workspace'),openSettings:()=>call<void>('p0:palette:open-settings'),
  readMemo:()=>call<IpcResult<MemoDocument>>('p0:palette:memo:read'),writeMemo:(document:MemoDocument)=>call<IpcResult<MemoDocument>>('p0:palette:memo:write',document),readEvents:()=>call<IpcResult<EventLoad>>('p0:palette:events:load'),readTasks:()=>call<IpcResult<LocalTaskLoad>>('p0:palette:tasks:load'),
});
contextBridge.exposeInMainWorld('electronPalette',bridge);
