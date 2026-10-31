import { contextBridge, ipcRenderer } from 'electron';
import type { P0Bridge, P0Settings } from '../protocol.js';
if (!process.sandboxed || !process.contextIsolated) throw new Error('PoC requires a sandboxed isolated preload');
const bridge: P0Bridge = Object.freeze({
  info: () => ipcRenderer.invoke('p0:info'),
  readSettings: () => ipcRenderer.invoke('p0:read-settings'),
  writeSettings: (settings: P0Settings) => ipcRenderer.invoke('p0:write-settings',settings),
});
contextBridge.exposeInMainWorld('electronP0',bridge);
