import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const handlers = (text) => text.match(/generate_handler!\[([\s\S]*?)\]/)[1]
  .split(',').map((entry) => entry.trim()).filter(Boolean);

test('all production and QA commands enter guarded IPC adapters', () => {
  const production = handlers(read('src-tauri/src/lib.rs'));
  const qa = handlers(read('src-tauri/src/my_finance_qa.rs'));
  assert.equal(production.length, 61);
  assert.equal(qa.length, 12);
  for (const entry of [...production, ...qa]) {
    assert.match(entry, /main_commands::|main_channel::/);
  }
});

test('custom command ACL is explicit and limited to the Main webview', () => {
  const manifest = read('src-tauri/main_command_manifest.rs');
  const production = handlers(read('src-tauri/src/lib.rs')).map((entry) => entry.split('::').at(-1));
  for (const name of production) assert.ok(manifest.includes(`"${name}"`), name);
  const capability = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.deepEqual(capability.webviews, ['main']);
  assert.equal(capability.windows, undefined);
  assert.ok(capability.permissions.includes('main-commands'));
  assert.ok(!capability.permissions.some((permission) => permission.includes('*')));
  assert.match(read('src-tauri/build.rs'), /AppManifest::new\(\)\.commands/);
});

test('six sensitive business events have no event broadcast fallback', () => {
  for (const path of ['lib.rs', 'purchase_helper.rs']) {
    const source = read(`src-tauri/src/${path}`);
    assert.doesNotMatch(source, /(?:app|window)\.emit\(/);
  }
  const channel = read('src-tauri/src/main_channel.rs');
  assert.equal((channel.match(/main_caller::run\(&caller/g) ?? []).length, 2);
  assert.ok(existsSync(new URL('../src-tauri/src/main_lifetime_state.rs', import.meta.url)));
});

test('trusted backend functions do not export duplicate IPC macros', () => {
  const production = handlers(read('src-tauri/src/lib.rs'));
  const seen = new Set();
  for (const entry of production) {
    const name = entry.split('::').at(-1);
    assert.ok(!seen.has(name), name);
    seen.add(name);
    if (!entry.includes('main_commands::')) continue;
    const parts = entry.split('::');
    parts.splice(-2, 1);
    parts.pop();
    const stem = parts.length ? parts.join('/') : 'lib';
    const base = 'src-tauri/src/' + stem;
    const file = existsSync(new URL('../' + base + '.rs', import.meta.url)) ? base + '.rs' : base + '/mod.rs';
    assert.ok(!read(file).includes('#[tauri::command]'), file);
  }
});

test('QA capability exposes only its isolated Main finance entry', () => {
  const qa = JSON.parse(read('src-tauri/tauri.my-finance-qa.conf.json'));
  const cap = qa.app.security.capabilities[0];
  assert.deepEqual(cap.webviews, ['main']);
  assert.equal(cap.windows, undefined);
  assert.ok(cap.permissions.includes('finance-qa-commands'));
  assert.ok(!cap.permissions.includes('main-commands'));
  assert.equal(qa.identifier, 'kr.sungandi.schoolhealthdesk.myfinanceqa');
});
