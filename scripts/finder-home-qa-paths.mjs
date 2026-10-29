import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

export const identifier = 'kr.sungandi.schoolhealthdesk.finderhomeqa';
export const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const rootVariable = 'BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT';

export function validateOutputRoot(value, env = process.env) {
  if (typeof value !== 'string' || !/^[A-Z]:[\\/]/i.test(value) || value.includes('..') || value.includes('\0') || value.slice(2).includes(':')) {
    throw new Error('Finder QA requires an explicit isolated absolute output path; no fallback.');
  }
  const normalized = win32.normalize(value);
  const name = win32.basename(normalized);
  const parent = win32.dirname(normalized).toLowerCase();
  const home = /^[de]:\\bogunon_dev\\qa-output$/.test(parent);
  const hosted = env.GITHUB_ACTIONS === 'true' && env.CI === 'true' && typeof env.RUNNER_TEMP === 'string'
    && parent === win32.normalize(env.RUNNER_TEMP).toLowerCase();
  if ((!home && !hosted) || !/^finder-home-qa-[a-z0-9][a-z0-9-]{0,79}$/i.test(name)
      || /-(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) {
    throw new Error('Finder QA requires a direct child of the dedicated D/E QA parent or hosted build temp.');
  }
  return normalized.replaceAll('\\', '/');
}

export function rejectLinkedAncestors(path) {
  for (let cursor = resolve(path); ; cursor = resolve(cursor, '..')) {
    let metadata;
    try { metadata = lstatSync(cursor); } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    if (metadata) {
      if (metadata.isSymbolicLink() || realpathSync.native(cursor).toLowerCase() !== cursor.toLowerCase()) {
        throw new Error('Finder QA paths must not contain links or redirected directories.');
      }
      if (!metadata.isDirectory()) throw new Error('Finder QA path is not a directory.');
    }
    const parent = resolve(cursor, '..');
    if (parent === cursor) break;
  }
}

export function finderHomeQaPaths(value = process.env[rootVariable]) {
  const root = validateOutputRoot(value);
  if (!existsSync(win32.parse(root).root)) throw new Error('QA drive unavailable; no fallback.');
  rejectLinkedAncestors(root);
  return Object.freeze({ root, dist: join(root, 'dist'), cache: join(root, 'cache'),
    temp: join(root, 'temp'), logs: join(root, 'logs'), target: join(root, 'target'),
    webview: join(root, 'webview'), data: join(root, 'data', identifier),
    environment: join(root, 'environment') });
}

export function prepareFinderHomeQaPaths(paths) {
  const marker = join(paths.root, '.finder-home-qa-owner.json');
  const owner = { identifier, projectRoot };
  if (existsSync(paths.root)) {
    if (!existsSync(marker)) throw new Error('Existing output root has no Finder QA ownership marker.');
    const metadata = lstatSync(marker);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 8192 ||
        realpathSync.native(marker).toLowerCase() !== resolve(marker).toLowerCase()) {
      throw new Error('Finder QA ownership marker must be a bounded regular file without redirection.');
    }
    const existing = JSON.parse(readFileSync(marker, 'utf8'));
    if (existing.identifier !== identifier || existing.projectRoot !== projectRoot) {
      throw new Error('Finder QA output is owned by another workspace.');
    }
  } else {
    mkdirSync(paths.root, { recursive: true });
    writeFileSync(marker, `${JSON.stringify(owner, null, 2)}\n`, { flag: 'wx' });
  }
  for (const path of Object.values(paths)) {
    rejectLinkedAncestors(path);
    mkdirSync(path, { recursive: true });
  }
  return paths;
}

export function finderHomeQaEnvironment(paths) {
  return { ...process.env, [rootVariable]: paths.root, CARGO_TARGET_DIR: paths.target,
    TEMP: paths.temp, TMP: paths.temp, TMPDIR: paths.temp,
    XDG_CACHE_HOME: paths.cache, npm_config_cache: join(paths.cache, 'npm'),
    PowerShellModuleAnalysisCachePath: join(paths.cache, 'powershell-analysis') };
}
