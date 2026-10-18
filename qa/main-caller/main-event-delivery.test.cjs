const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src-tauri/src/main_events_delivery.js', 'utf8');
const events = ['desktop:navigate', 'desktop:notice', 'desktop:file-drop',
  'purchase:analysis-start', 'purchase:analysis', 'purchase:analysis-error'];
function view(event, target = {kind:'Any'}, id=17) {
  const received=[];
  const handlers = Object.create(null);
  Object.defineProperty(handlers, id, {value: {target,handlerId:41}, configurable:true});
  const window = {
    __internal_unstable_listeners_object_id__: {[event]:handlers},
    __TAURI_INTERNALS__: {runCallback(handlerId, data) { received.push({handlerId,...data}); }}
  };
  // Exact locked Tauri initialization semantics: ids are non-enumerable properties.
  window.__internal_unstable_listeners_function_id__ = function(data, ids) {
    for(const id of ids) {
      const listener=window.__internal_unstable_listeners_object_id__[data.event][id];
      if(listener) window.__TAURI_INTERNALS__.runCallback(listener.handlerId,{...data,id});
    }
  };
  return {window,received};
}
for(const event of events) test(event+' remains in physical Main context', () => {
  const main=view(event), surface=view(event);
  const payload={raw:'quote"; globalThis.injected = true; //', rows:['synthetic']};
  vm.runInNewContext('('+source+')('+JSON.stringify({event,payload})+')', {window:main.window});
  assert.equal(main.received.length,1);
  assert.equal(main.received[0].id,17);
  assert.equal(JSON.stringify(main.received[0].payload),JSON.stringify(payload));
  assert.equal(surface.received.length,0);
});
test('non-main target listener excluded even in Main context', () => {
  const main=view(events[0],{kind:'WebviewWindow',label:'surface'});
  vm.runInNewContext('('+source+')('+JSON.stringify({event:events[0],payload:'synthetic'})+')',{window:main.window});
  assert.equal(main.received.length,0);
});
test('missing internals fail closed without fallback', () => {
  let effects=0;const window={emit(){effects++}};
  const result=vm.runInNewContext('('+source+')('+JSON.stringify({event:events[0],payload:'x'})+')',{window});
  assert.equal(result,false);assert.equal(effects,0);
});
test('unknown event rejected', () => {
  const main=view('unknown');
  assert.equal(vm.runInNewContext('('+source+')({event:"unknown",payload:0})',{window:main.window}),false);
  assert.equal(main.received.length,0);
});
test('locked dependency ABI is the audited version', () => {
  const lock=fs.readFileSync('src-tauri/Cargo.lock','utf8').split(String.fromCharCode(13)).join('');
  assert.ok(lock.includes('name = "tauri"\nversion = "2.11.5"'));
});
test('all six producers use shared physical destination without emitter fallback', () => {
  const lib=fs.readFileSync('src-tauri/src/lib.rs','utf8');
  const purchase=fs.readFileSync('src-tauri/src/purchase_helper.rs','utf8');
  const adapter=fs.readFileSync('src-tauri/src/main_events.rs','utf8');
  for(const source of [lib,purchase,adapter]) {
    assert.equal(source.includes('app.emit('),false);
    assert.equal(source.includes('window.emit('),false);
    assert.equal(source.includes('.emit_to('),false);
  }
  assert.ok(adapter.includes('main.eval(script)'));
  assert.ok(lib.indexOf('if !boundary.is_main_window(window)') < lib.indexOf('let state = window.state::<DesktopState>();',lib.indexOf('.on_window_event')));
});
