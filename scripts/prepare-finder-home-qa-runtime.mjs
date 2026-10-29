// Preparation only: no app launch, authentication or external communication.
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { identifier, rejectLinkedAncestors, validateOutputRoot } from './finder-home-qa-paths.mjs';

export function prepareRuntime(root, sourceSha) {
  const selected = validateOutputRoot(root, {}); // Hosted paths are never runtime paths.
  if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '')) throw new Error('Exact executable source SHA required.');
  rejectLinkedAncestors(selected);
  mkdirSync(selected, { recursive: true });
  const marker = join(selected, '.finder-home-qa-runtime-owner.json');
  const expected = { schema: 2, identifier, sourceSha, purpose: 'offline-finder-runtime' };
  // lstat detects even a dangling symlink; a marker is never followed blindly.
  let metadata;
  try { metadata = lstatSync(marker); } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  if (metadata) {
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 8192
        || realpathSync.native(marker).toLowerCase() !== resolve(marker).toLowerCase()) throw new Error('Invalid QA marker.');
    const owner = JSON.parse(readFileSync(marker, 'utf8'));
    if (Object.entries(expected).some(([key, value]) => owner[key] !== value)) throw new Error('QA owner/source mismatch.');
  } else {
    if (readdirSync(selected).length !== 0) throw new Error('Refusing an unowned nonempty QA directory.');
    writeFileSync(marker, `${JSON.stringify(expected, null, 2)}\n`, { flag: 'wx', flush: true });
  }
  for (const child of ['data', 'webview']) rejectLinkedAncestors(join(selected, child));
  rejectLinkedAncestors(join(selected, 'data', identifier, 'education-video'));
  return { root: selected, identifier, sourceSha, marker, appExecution: 'NOT RUN' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = prepareRuntime(process.env.BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT, process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
}
