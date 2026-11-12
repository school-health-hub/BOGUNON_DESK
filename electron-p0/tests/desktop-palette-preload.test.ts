import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { PaletteBridge, PaletteProjection } from '../palette-protocol';

type IpcListener = (_event: unknown, payload: unknown) => void;
function loadPreload() {
  const exposed: Record<string, unknown> = {};
  const listeners = new Map<string, IpcListener>();
  const invoke = vi.fn(async (..._args: readonly unknown[]) => ({ ok: true, data: null }));
  const removeListener = vi.fn((channel: string) => listeners.delete(channel));
  const code = ts.transpileModule(readFileSync('electron-p0/preload/palette-preload.cts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports: {}, process: { sandboxed: true, contextIsolated: true }, require: () => ({ contextBridge: { exposeInMainWorld: (key: string, value: unknown) => { exposed[key] = value; } }, ipcRenderer: { invoke, on: (channel: string, listener: IpcListener) => listeners.set(channel, listener), removeListener } }) });
  return { exposed, listeners, invoke, removeListener };
}

describe('Desktop palette preload boundary', () => {
  it('exposes only palette plus local widget stores and no sensitive workspace APIs', async () => {
    const { exposed, invoke } = loadPreload();
    expect(Object.keys(exposed).sort()).toEqual(['electronPalette', 'electronWork']);
    expect(exposed).not.toHaveProperty('electronMonitorProfiles');
    expect(Object.keys(Object(exposed.electronPalette)).sort()).toEqual(['onSettingsChanged','openSettings','openWorkspace','readProjection','readSettings','ready','setHitRegions','setInteractive']);
    const work = exposed.electronWork as Record<string, unknown>;
    expect(Object.keys(work).sort()).toEqual(['events', 'memo', 'tasks']);
    expect(work).not.toHaveProperty('finance');
    expect(work).not.toHaveProperty('school');
    expect(work).not.toHaveProperty('ai');
    const palette = exposed.electronPalette as { setInteractive(value: boolean): Promise<unknown> };
    await palette.setInteractive(true);
    expect(invoke).toHaveBeenLastCalledWith('p0:palette:set-interactive', true);
    const regions = [{ x: 10, y: 20, width: 30, height: 40 }];
    await (exposed.electronPalette as { setHitRegions(value: typeof regions): Promise<unknown> }).setHitRegions(regions);
    expect(invoke).toHaveBeenLastCalledWith('p0:palette:set-hit-regions', regions);
  });

  it('reads a monitor projection on a fixed channel while retaining the legacy settings reader', async () => {
    const { exposed, invoke } = loadPreload();
    const palette = exposed.electronPalette as PaletteBridge;
    await palette.readProjection();
    expect(invoke).toHaveBeenLastCalledWith('p0:palette:read-projection');
    await palette.readSettings();
    expect(invoke).toHaveBeenLastCalledWith('p0:palette:read-settings');
  });

  it('forwards only projection payloads and removes the exact listener on unsubscribe', () => {
    const { exposed, listeners, removeListener } = loadPreload();
    const palette = exposed.electronPalette as PaletteBridge;
    const snapshot: PaletteProjection = { revision: 8, value: null, monitorLayout: { synthetic: true } };
    const listener = vi.fn(), dispose = palette.onSettingsChanged(listener);
    const callback = listeners.get('p0:surface-settings:changed');
    expect(callback).toBeTypeOf('function');
    callback?.({ secret: 'native event' }, snapshot);
    expect(listener).toHaveBeenCalledExactlyOnceWith(snapshot);
    dispose();
    expect(removeListener).toHaveBeenCalledWith('p0:surface-settings:changed', callback);
    expect(listeners.has('p0:surface-settings:changed')).toBe(false);
  });
});
