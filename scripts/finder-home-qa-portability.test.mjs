import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateOutputRoot } from './finder-home-qa-paths.mjs';
import { prepareRuntime } from './prepare-finder-home-qa-runtime.mjs';
import { mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
const sha = 'a'.repeat(40);
const prefix = `${process.env.GITHUB_ACTIONS === 'true' ? 'D' : 'E'}:/BOGUNON_DEV/qa-output/finder-home-qa-hf5b-${process.pid}-${Date.now()}`;

test('Given a hosted runner, When an owned build root is below RUNNER_TEMP, Then the build path is portable', () => {
  const env = { GITHUB_ACTIONS: 'true', CI: 'true', RUNNER_TEMP: 'D:/a/_temp' };
  assert.equal(validateOutputRoot('D:/a/_temp/finder-home-qa-ci-1', env), 'D:/a/_temp/finder-home-qa-ci-1');
  assert.throws(() => validateOutputRoot('D:/a/_temp/other', env));
  assert.throws(() => validateOutputRoot('D:/a/_temp/finder-home-qa-x/../finder-home-qa-y', env));
});

test('Given portable source ownership, When preparing twice on the home PC, Then data survives and mismatched source or owner is refused', () => {
  const root = `${prefix}-owner`;
  const first = prepareRuntime(root, sha);
  const note = `${root}/synthetic-note.txt`;
  writeFileSync(note, 'synthetic QA only', { flag: 'wx' });
  assert.equal(prepareRuntime(root, sha).root, first.root);
  assert.equal(readFileSync(note, 'utf8'), 'synthetic QA only');
  assert.throws(() => prepareRuntime(root, 'b'.repeat(40)), /mismatch/);
  const owner = JSON.parse(readFileSync(first.marker, 'utf8'));
  writeFileSync(first.marker, JSON.stringify({ ...owner, identifier: 'wrong-qa-owner' }));
  assert.throws(() => prepareRuntime(root, sha), /mismatch/);
});

test('Given unowned existing data, When preparing runtime, Then neither adoption nor overwrite is allowed', () => {
  const root = `${prefix}-unowned`;
  mkdirSync(root, { recursive: true });
  writeFileSync(`${root}/existing.txt`, 'synthetic preserved');
  assert.throws(() => prepareRuntime(root, sha), /nonempty/);
  assert.equal(readFileSync(`${root}/existing.txt`, 'utf8'), 'synthetic preserved');
});

test('Given a junction, When preparing a QA root or WebView directory, Then redirected storage is rejected', () => {
  const target = `${prefix}-target`;
  mkdirSync(target, { recursive: true });
  const linked = `${prefix}-junction`;
  symlinkSync(target, linked, 'junction');
  assert.throws(() => prepareRuntime(linked, sha), /links|redirect/);
  const root = `${prefix}-webview`;
  prepareRuntime(root, sha);
  symlinkSync(target, `${root}/webview`, 'junction');
  assert.throws(() => prepareRuntime(root, sha), /links|redirect/);
});

test('Given a home PC, When an explicit QA root is selected, Then D and E work without AppData fallback', () => {
  assert.equal(validateOutputRoot('D:/BOGUNON_DEV/qa-output/finder-home-qa-portable', {}), 'D:/BOGUNON_DEV/qa-output/finder-home-qa-portable');
  assert.equal(validateOutputRoot('D:/BOGUNON_DEV/qa-output/FINDER-HOME-QA-portable', {}), 'D:/BOGUNON_DEV/qa-output/FINDER-HOME-QA-portable');
  for (const path of ['C:/Users/user/AppData/Local/finder-home-qa-x', 'E:/BOGUNON_DEV/qa-output/finder-home-qa-x.', 'E:/BOGUNON_DEV/qa-output/finder-home-qa-CON', 'E:/BOGUNON_DEV/qa-output/finder-home-qa-x:stream']) {
    assert.throws(() => validateOutputRoot(path, {}));
  }
});
