import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function merge(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete target[key];
    else if (typeof value === 'object' && !Array.isArray(value)) {
      target[key] = merge(target[key] ?? {}, value);
    } else target[key] = value;
  }
  return target;
}
test('merged QA config excludes production endpoints, plugins and default capabilities', () => {
  const config = merge(JSON.parse(read('src-tauri/tauri.conf.json')),
    JSON.parse(read('src-tauri/tauri.finder-home-qa.conf.json')));
  assert.equal(config.identifier, 'kr.sungandi.schoolhealthdesk.finderhomeqa');
  assert.equal(config.mainBinaryName, 'bogunon-desk-finder-home-qa');
  assert.deepEqual(config.app.windows, []);
  assert.deepEqual(config.plugins, {});
  assert.deepEqual(config.app.security.capabilities, [{ identifier: 'finder-home-qa-local-only', windows: ['finder-home-qa'], permissions: [] }]);
  assert.equal(config.build.devUrl, undefined);
  assert.equal(config.build.beforeBuildCommand, undefined);
  assert.equal(config.build.beforeDevCommand, undefined);
  assert.equal(config.bundle.active, false);
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  for (const csp of [config.app.security.csp, config.app.security.devCsp]) {
    assert.equal(csp['connect-src'], 'ipc: http://ipc.localhost');
    assert.equal(csp['default-src'], "'none'");
    assert.equal(csp['frame-src'], "'none'");
    assert.equal(csp['form-action'], "'none'");
  }
  assert.doesNotMatch(JSON.stringify(config), /supabase\.co|chatgpt\.com|api\.openai\.com|school-health-desk:\/\//);
});
test('native QA registers only local library and metadata, with no production bootstrap', () => {
  const source = read('src-tauri/src/finder_home_qa.rs');
  const handler = source.match(/generate_handler!\[([\s\S]*?)\]/)?.[1];
  assert.ok(handler);
  const commands = handler.split(',').map(command => command.trim()).filter(Boolean);
  assert.equal(commands.length, 8);
  assert.ok(commands.every(command => /^(finder_home_qa_metadata|library::finder_home_qa_library_(load|save|import|export|recover|metadata_delete|metadata_refresh))$/.test(command)));
  assert.doesNotMatch(source, /\.plugin\(|AppData|app_local_data_dir|open_url|authService|reqwest/);
  assert.match(source, /\.data_directory\(paths\.directory\("webview"\)\)/);
  assert.match(source, /on_navigation\(local_navigation\)/);
  assert.match(source, /NewWindowResponse::Deny/);
});
test('Finder real dispatch stays disabled and source feature isolates production bootstrap', () => {
  assert.match(read('src-tauri/src/education_video/request_core.rs'), /REAL_DISPATCH_ENABLED:\s*bool\s*=\s*false/);
  assert.match(read('src-tauri/src/lib.rs'), /feature = "finder-home-qa"/);
  assert.match(read('src-tauri/build.rs'), /finder_home_qa_build::validate/);
  assert.match(read('src-tauri/finder_home_qa_build.rs'), /CARGO_TARGET_DIR/);
});

test('QA Rust symbols have unique macro names while all seven public IPC strings stay unchanged', () => {
  const qa = read('src-tauri/src/finder_home_qa_library.rs');
  const production = read('src-tauri/src/education_video/commands.rs');
  const handler = read('src-tauri/src/finder_home_qa.rs');
  const ipc = read('src/finder-home-qa/qaIpc.ts');
  const suffixes = ['load', 'save', 'import', 'export', 'recover', 'metadata_delete', 'metadata_refresh'];
  for (const suffix of suffixes) {
    const external = `education_video_library_${suffix}`;
    const internal = `finder_home_qa_library_${suffix}`;
    assert.match(qa, new RegExp(`#\\[tauri::command\\(rename = "${external}"\\)\\]\\s+pub fn ${internal}\\(`));
    assert.match(handler, new RegExp(`library::${internal}\\b`));
    assert.ok(ipc.includes(`'${external}'`));
    assert.match(production, new RegExp(`#\\[tauri::command\\]\\s+pub fn ${external}\\(`));
  }
  const names = source => [...source.matchAll(/pub (?:async )?fn (\w+)\(/g)].map(match => match[1]);
  assert.deepEqual(names(qa).filter(name => names(production).includes(name)), []);
  assert.doesNotMatch(qa, /#\[cfg|macro_export|app_local_data_dir/);
  assert.match(qa, /paths\.verify\(\)/);
  assert.match(qa, /operation\(&paths\.library\(\)\)/);
});
