import { contextBridge, ipcRenderer } from 'electron';
import type { PaletteBridge, PaletteWorkBridge } from '../palette-protocol.js';
if (!process.sandboxed || !process.contextIsolated) throw new Error('Desktop palette requires a sandboxed isolated preload');
function call<T>(channel: string, ...args: readonly unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}
const palette: PaletteBridge = {
  readSettings: () => call('p0:palette:read-settings'),
  readProjection:()=>call('p0:palette:read-projection'),
  setInteractive: (interactive) => call('p0:palette:set-interactive', interactive),
  setHitRegions: (regions) => call('p0:palette:set-hit-regions', regions),
  openWorkspace: (entry) => entry === undefined ? call('p0:palette:open-workspace') : call('p0:palette:open-workspace', entry),
  openSettings: (section) => call('p0:palette:open-settings', section ?? 'account'),
  ready: () => call('p0:palette:ready'),
  onSettingsChanged: (listener) => {
    const callback = (_event: unknown, snapshot: Parameters<typeof listener>[0]) => listener(snapshot);
    ipcRenderer.on('p0:surface-settings:changed', callback);
    return () => { ipcRenderer.removeListener('p0:surface-settings:changed', callback); };
  },
};
const work: PaletteWorkBridge = {
  events: { load: () => call('p0:palette:events:load'), save: (event, expectedRevision, expectedUpdatedAt) => call('p0:palette:events:save', event, expectedRevision, expectedUpdatedAt), remove: (id, expectedRevision, expectedUpdatedAt, confirmed) => call('p0:palette:events:remove', id, expectedRevision, expectedUpdatedAt, confirmed) },
  tasks: { load: () => call('p0:palette:tasks:load'), save: (document, expectedRevision) => call('p0:palette:tasks:save', document, expectedRevision) },
  memo: { read: () => call('p0:palette:memo:read'), write: (document) => call('p0:palette:memo:write', document) },
};
contextBridge.exposeInMainWorld('electronPalette', palette);
contextBridge.exposeInMainWorld('electronWork', work);
