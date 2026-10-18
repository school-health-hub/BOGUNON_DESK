import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const sources = ['src/surface/main.tsx', 'src/surface/SurfaceRoot.tsx'];
const forbidden = new Set([
  'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'fetch', 'XMLHttpRequest',
  'WebSocket', 'Worker', 'SharedWorker', 'serviceWorker', 'location', 'open',
  'invoke', 'Channel', '__TAURI_INTERNALS__', 'eval', 'Function',
]);

describe('disconnected renderer source contract', () => {
  it.each(sources)('keeps %s free of storage, navigation and IPC APIs', (file) => {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const violations = [];
    const visit = (node) => {
      if (ts.isIdentifier(node) && forbidden.has(node.text)) violations.push(node.text);
      if (ts.isElementAccessExpression(node)) violations.push('computed browser access');
      if (ts.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier.text;
        if (!['react', 'react-dom/client', './SurfaceRoot', './surface.css'].includes(specifier)) violations.push(specifier);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(violations).toEqual([]);
  });

  it('denies connections and uses only the dedicated entrypoint', () => {
    const html = readFileSync('surface.html', 'utf8');
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('src="/src/surface/main.tsx"');
    expect(html).not.toContain('/src/main.tsx');
    expect(html).not.toMatch(/https?:|<iframe|<form|<a\s/);
  });
});
