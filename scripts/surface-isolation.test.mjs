import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { build } from 'vite';
import { surfaceIsolation } from './surface-isolation.mjs';

async function fixture(source, files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'surface-graph-'));
  await mkdir(join(root, 'src/surface'), { recursive: true });
  await writeFile(join(root, 'surface.html'), '<div id="surface-root"></div><script type="module" src="/src/surface/main.tsx"></script>');
  await writeFile(join(root, 'src/surface/main.tsx'), source);
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(root, name, '..'), { recursive: true });
    await writeFile(join(root, name), content);
  }
  return root;
}

async function compile(root) {
  return build({ configFile: false, root, logLevel: 'silent', publicDir: false,
    plugins: [surfaceIsolation()], build: { write: false, modulePreload: false,
      rolldownOptions: { input: join(root, 'surface.html') } } });
}

describe('Surface emitted dependency graph boundary', () => {
  it('emits sanitized module edges and chunk hashes for an isolated entry', async () => {
    const root = await fixture('document.querySelector("#surface-root").textContent = "Unavailable";');
    try {
      const result = await compile(root);
      const output = Array.isArray(result) ? result[0].output : result.output;
      const graph = JSON.parse(output.find((item) => item.fileName === '.vite/surface-isolation.json').source);
      expect(graph.modules.some((item) => item.id === 'src/surface/main.tsx')).toBe(true);
      expect(JSON.stringify(graph)).not.toContain(root);
      expect(graph.chunks.every((chunk) => /^[a-f0-9]{64}$/.test(chunk.sha256))).toBe(true);
    } finally { await rm(root, { recursive: true }); }
  });

  it.each([
    ['Main application', 'src/App.tsx', 'export const forbidden = 1;'],
    ['Tauri command bridge', 'src/tauri.ts', 'export const forbidden = 1;'],
    ['authentication provider', 'src/AuthService.ts', 'export const forbidden = 1;'],
  ])('rejects a tree-shaken %s import from the loaded graph', async (_label, path, source) => {
    const root = await fixture(`import { forbidden } from '../../${path}'; document.body.textContent = 'Unavailable';`, { [path]: source });
    try { await expect(compile(root)).rejects.toThrow(/Surface isolation rejected/); }
    finally { await rm(root, { recursive: true }); }
  });

  it('rejects an external dependency rather than trusting unresolved imports', async () => {
    const root = await fixture('import "https://example.invalid/external.js";');
    try { await expect(compile(root)).rejects.toThrow(/Surface isolation rejected/); }
    finally { await rm(root, { recursive: true }); }
  });
});
