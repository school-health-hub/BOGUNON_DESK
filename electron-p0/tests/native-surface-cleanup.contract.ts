import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accepted,binding,fixture,runtime} from './native-surface-fixtures.js';

test('completes model cleanup only after correlated exit and all resources are released',()=>{
  const f=fixture();f.retiring();
  accepted(f.finish());
  assert.equal(f.boundary.snapshot.state,'Detached');
  assert.equal(f.boundary.snapshot.host,'Exited');
  assert.equal(f.boundary.snapshot.cleanup,'Verified');
  assert.equal(f.boundary.snapshot.scope,'contract-only');
  assert.equal(f.main('Attach').ok,false);
});
test('records Host failure separately from successful cleanup',()=>{
  const f=fixture();f.start();accepted(f.host('HostFailed'));
  accepted(f.host('CleanupStarted'));accepted(f.finish());
  assert.equal(f.boundary.snapshot.state,'Failed');
  assert.equal(f.boundary.snapshot.cleanup,'Verified');
  assert.equal(f.boundary.snapshot.reason,'HostFailure');
});
test('never turns a missing browser exit into cleanup success',()=>{
  const f=fixture();f.retiring();
  accepted(f.host('ResourceReleased',{resource:'Environment',identity:11n}));
  accepted(f.host('HostExited'));
  assert.equal(f.host('CleanupFinished').ok,false);
  assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
});
test('does not accept a substitute environment or browser identity',()=>{
  for(const exit of [
    {environment:12n,browser:runtime.browser,normalExit:true},
    {environment:11n,browser:{...runtime.browser,creationTime:3001n},normalExit:true},
    {environment:11n,browser:runtime.browser,normalExit:false},
  ]){
    const f=fixture();f.retiring();
    accepted(f.host('BrowserExited',{exit}));
    accepted(f.host('ResourceReleased',{resource:'Environment',identity:11n}));
    accepted(f.host('HostExited'));
    assert.equal(f.host('CleanupFinished').ok,false);
    assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
  }
});
test('blocks all new attachment after an unresolved partial creation',()=>{
  const f=fixture();f.start();
  accepted(f.host('ResourceUnknown',{resource:'Controller'}));
  assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
  assert.deepEqual(f.main('Attach'),{ok:false,error:'CleanupBlocked'});
  assert.equal(f.host('CleanupFinished').ok,false);
});
test('retained COM or event ownership prevents a receipt',()=>{
  for(const resource of ['ComReference','EventToken','BackendRegistration']){
    const f=fixture();f.start();
    accepted(f.host('ResourceAcquired',{resource,identity:44n}));
    accepted(f.main('Cancel'));accepted(f.host('CleanupStarted'));
    assert.equal(f.finish().ok,false);
    assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
  }
});
test('a wrong release identity cannot hide ownership',()=>{
  const f=fixture();f.retiring();
  assert.equal(f.host('ResourceReleased',{resource:'Environment',identity:12n}).ok,false);
  assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
});
test('Host exit alone cannot release other owned resources',()=>{
  const f=fixture();f.retiring();
  accepted(f.host('BrowserExited',{exit:{environment:11n,browser:runtime.browser,normalExit:true}}));
  accepted(f.host('HostExited'));
  assert.equal(f.host('CleanupFinished').ok,false);
  assert.equal(f.boundary.snapshot.cleanup,'Unknown');
});
test('rejects forged Host owner and duplicate Host sequence without changing ownership',()=>{
  const f=fixture();f.start();
  assert.equal(f.host('ResourceReleased',{owner:{...binding.owner,pid:101},resource:'Environment',identity:11n}).ok,false);
  assert.equal(f.boundary.snapshot.state,'Preparing');
  assert.deepEqual(f.boundary.host({...binding,kind:'HostFailed',sequence:1n}),{ok:false,error:'StaleSequence'});
  assert.equal(f.boundary.snapshot.state,'Preparing');
});
