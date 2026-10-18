import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const applicationModules = new Set([
  'surface.html',
  'src/surface/main.tsx',
  'src/surface/SurfaceRoot.tsx',
  'src/surface/surface.css',
]);
const runtimeModules = new Set(['\0rolldown/runtime.js']);
const normalize = (value) => value.replaceAll(String.fromCharCode(92), '/');

/** Inspect loaded modules as well as emitted chunks, including tree-shaken imports. */
export function surfaceIsolation() {
  let root;
  const loaded = new Map();
  const idFor = (id) => {
    if (runtimeModules.has(id)) return `virtual:${id.slice(1)}`;
    if (id.startsWith('\0') || /^(?:https?:|data:|node:)/.test(id)) {
      throw new Error('Surface isolation rejected a virtual or external dependency');
    }
    const clean = normalize(id);
    const local = normalize(relative(root, clean));
    if (applicationModules.has(local)) return local;
    const packagePath = normalize(resolve(root, 'node_modules')) + '/';
    if (clean.startsWith(packagePath)) {
      const packageRelative = clean.slice(packagePath.length);
      if (/^(?:react|react-dom|scheduler)\/[a-zA-Z0-9_./-]+\.js$/.test(packageRelative)
          && !packageRelative.split('/').includes('..')) return `npm:${packageRelative}`;
    }
    throw new Error(`Surface isolation rejected dependency outside the renderer allowlist: ${local}`);
  };
  return {
    name: 'surface-isolation',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) { root = config.root; },
    async transform(source, id) {
      if (!normalize(id).startsWith(normalize(root) + '/src/surface/')) return;
      const owner = idFor(id);
      if (!/[.](?:tsx?|jsx?)$/.test(id)) return;
      const parsed = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const imports = [];
      const visit = (node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          if (node.moduleSpecifier) imports.push(node.moduleSpecifier);
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          if (node.arguments.length !== 1) throw new Error('Surface isolation rejected dynamic import');
          imports.push(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
      const edges = [];
      for (const specifier of imports) {
        if (!ts.isStringLiteral(specifier)) throw new Error('Surface isolation rejected computed import');
        const resolved = await this.resolve(specifier.text, id, { skipSelf: true });
        if (!resolved || resolved.external) throw new Error('Surface isolation rejected external import');
        edges.push(idFor(resolved.id));
      }
      loaded.set(owner, { id: owner, imports: [...new Set(edges)].sort() });
    },
    moduleParsed(info) {
      const id = idFor(info.id);
      const imports = [...info.importedIds, ...info.dynamicallyImportedIds].map(idFor);
      loaded.set(id, { id, imports: [...new Set([...(loaded.get(id)?.imports ?? []), ...imports])].sort() });
    },
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        if (!info) this.error('Surface isolation could not inspect a loaded module');
        const key = idFor(id);
        loaded.set(key, { id: key, imports: [...new Set([...(loaded.get(key)?.imports ?? []), ...[
          ...info.importedIds, ...info.dynamicallyImportedIds,
        ].map(idFor)])].sort() });
      }
      const chunks = Object.values(bundle).filter((item) => item.type === 'chunk').map((chunk) => {
        const modules = Object.keys(chunk.modules).map(idFor).sort();
        for (const name of [...chunk.imports, ...chunk.dynamicImports]) {
          if (!bundle[name] || bundle[name].type !== 'chunk') {
            this.error('Surface isolation rejected an external emitted import');
          }
        }
        return { file: chunk.fileName, modules, imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          sha256: createHash('sha256').update(chunk.code).digest('hex') };
      });
      this.emitFile({ type: 'asset', fileName: '.vite/surface-isolation.json', source: JSON.stringify({
        schema_version: 1,
        scope: 'static-surface-renderer-only',
        modules: [...loaded.values()].sort((left, right) => left.id.localeCompare(right.id)),
        chunks,
      }, null, 2) + '\n' });
    },
  };
}
