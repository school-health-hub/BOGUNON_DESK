import {test} from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
test('business delivery uses public guarded Channel without broadcast or private listener ABI',()=>{
 const adapter=read('src-tauri/src/main_events.rs');
 const commands=read('src-tauri/src/main_channel.rs');
 const lib=read('src-tauri/src/lib.rs');
 for(const source of [adapter,lib,read('src-tauri/src/purchase_helper.rs')]) {
  for(const forbidden of ['app.emit(', 'window.emit(', '.emit_to(', '__internal_unstable_listeners_', 'main.eval(script)']) assert.equal(source.includes(forbidden),false,forbidden);
 }
 assert.ok(commands.includes('register_main_channel'));
 assert.ok(commands.includes('unregister_main_channel'));
 assert.ok(lib.includes('boundary.invalidate_channel_for(webview)'));
 assert.ok(lib.indexOf('if !boundary.is_main_window(window)')<lib.indexOf('let state = window.state::<DesktopState>();',lib.indexOf('.on_window_event')));
 assert.equal(fs.existsSync('src-tauri/src/main_events_delivery.js'),false);
});
test('both receivers use the shared public subscription',()=>{
 for(const path of ['src/components/dashboard/DashboardCanvas.tsx','src/components/desktop/PurchaseHelperPanel.tsx']) assert.ok(read(path).includes('subscribeMainChannel'));
});
