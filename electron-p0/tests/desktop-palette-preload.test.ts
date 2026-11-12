import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

describe('Desktop palette preload boundary', () => {
  it('exposes only palette plus local widget stores and no sensitive workspace APIs', async () => {
    const exposed: Record<string, unknown> = {};
    const invoke = vi.fn(async () => ({ ok: true, data: null }));
    const code = ts.transpileModule(readFileSync('electron-p0/preload/palette-preload.cts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(code, { exports: {}, process: { sandboxed: true, contextIsolated: true }, require: () => ({ contextBridge: { exposeInMainWorld: (key: string, value: unknown) => { exposed[key] = value; } }, ipcRenderer: { invoke } }) });
    expect(Object.keys(exposed).sort()).toEqual(['electronPalette', 'electronWork']);
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
});
