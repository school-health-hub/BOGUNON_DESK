import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateOutputRoot, finderHomeQaPaths, finderHomeQaEnvironment } from './finder-home-qa-paths.mjs';

test('no missing root, C: fallback, UNC, traversal, shared target or sibling QA output', () => {
  for (const value of [undefined, '', 'C:/target', '//server/share', 'E:relative',
    'E:/BOGUNON_DEV/qa-output/finder-home-qa-safe/../shared',
    'E:/BOGUNON_DEV/cargo-target/shared', 'E:/BOGUNON_DEV/qa-output/official-document-qa',
    'E:/BOGUNON_DEV/qa-output/finder-home-qa-safe/target']) {
    assert.throws(() => validateOutputRoot(value));
  }
});
test('all child output paths and process-only environment stay on dedicated E root', () => {
  const paths = finderHomeQaPaths('E:/BOGUNON_DEV/qa-output/finder-home-qa-path-test');
  const before = process.env.CARGO_TARGET_DIR;
  const env = finderHomeQaEnvironment(paths);
  for (const path of Object.values(paths)) assert.ok(path.replaceAll('\\', '/').startsWith(paths.root));
  for (const key of ['CARGO_TARGET_DIR', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CACHE_HOME', 'npm_config_cache']) {
    assert.ok(env[key].replaceAll('\\', '/').startsWith(paths.root));
  }
  assert.equal(process.env.CARGO_TARGET_DIR, before);
  assert.ok(paths.data.endsWith('kr.sungandi.schoolhealthdesk.finderhomeqa'));
});
