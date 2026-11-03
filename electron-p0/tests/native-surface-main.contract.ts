import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createNativeSurfaceBoundary} from '../main/desktop-surface/boundary.js';
import {accepted,binding,fixture} from './native-surface-fixtures.js';

test('starts Detached without claiming Native attachment',()=>{
  const {boundary}=fixture();
  assert.deepEqual(boundary.snapshot,{scope:'contract-only',state:'Detached',host:'Stopped',
    cleanup:'NotNeeded',reason:'None',admissionOpen:false,normalWindowRequested:false,nativeAttachmentVerified:false});
});
test('preparing and Host startup never imply Attached',()=>{
  const f=fixture();
  accepted(f.main('Attach'));
  assert.equal(f.boundary.snapshot.host,'Starting');
  accepted(f.host('HostStarted'));
  assert.equal(f.boundary.snapshot.state,'Preparing');
  assert.equal(f.boundary.snapshot.host,'Running');
  assert.equal(f.boundary.snapshot.nativeAttachmentVerified,false);
});
test('rejects wrong session, owner creation identity and Explorer before starting',()=>{
  for(const fields of [
    {attempt:{generation:2n,nonce:2n}},
    {attempt:{generation:1n,nonce:3n}},
    {owner:{...binding.owner,creationTime:1001n}},
    {explorer:{...binding.explorer,generation:2n}},
  ]){
    const f=fixture();
    assert.equal(f.main('Attach',fields).ok,false);
    assert.equal(f.boundary.snapshot.state,'Detached');
  }
});
test('rejects duplicate sequence without applying a second operation',()=>{
  const f=fixture();
  accepted(f.main('Attach'));
  assert.deepEqual(f.boundary.main({...binding,sequence:1n,kind:'Cancel'}),{ok:false,error:'StaleSequence'});
  assert.equal(f.boundary.snapshot.state,'Preparing');
});
test('blocks new attach while cancelling',()=>{
  const f=fixture();f.start();
  accepted(f.main('Cancel'));
  assert.equal(f.boundary.snapshot.state,'Recovering');
  assert.equal(f.boundary.snapshot.admissionOpen,false);
  assert.equal(f.main('Attach').ok,false);
});
test('normal-window request also retires a pending attach',()=>{
  const f=fixture();f.start();
  accepted(f.main('ReturnToNormal'));
  assert.equal(f.boundary.snapshot.state,'Recovering');
  assert.equal(f.boundary.snapshot.admissionOpen,false);
  assert.equal(f.boundary.snapshot.normalWindowRequested,true);
});
test('invalidates admission when Explorer changes but accepts old-session cleanup',()=>{
  const f=fixture();f.start();
  accepted(f.boundary.explorerChanged({...binding.explorer,generation:2n}));
  assert.equal(f.boundary.snapshot.reason,'ExplorerChanged');
  assert.equal(f.boundary.snapshot.state,'Recovering');
  assert.equal(f.boundary.snapshot.normalWindowRequested,true);
  assert.equal(f.main('Attach').ok,false);
  accepted(f.host('CleanupStarted'));
  accepted(f.finish());
  assert.equal(f.boundary.snapshot.state,'Detached');
  assert.equal(f.main('Attach').ok,false);
});
test('same-generation Explorer PID reuse invalidates the session',()=>{
  const f=fixture();f.start();
  accepted(f.boundary.explorerChanged({...binding.explorer,process:{...binding.explorer.process,creationTime:2001n}}));
  assert.equal(f.boundary.snapshot.state,'Recovering');
});
test('stale Explorer observations cannot replace the current generation',()=>{
  const f=fixture();f.start();
  assert.equal(f.boundary.explorerChanged({...binding.explorer,generation:0n}).ok,false);
  assert.equal(f.boundary.snapshot.state,'Preparing');
});
test('unexpected Host exit remains CleanupUnknown even if no child was reported',()=>{
  const f=fixture();accepted(f.main('Attach'));accepted(f.host('HostStarted'));
  accepted(f.host('HostExited'));
  assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
  assert.equal(f.boundary.snapshot.cleanup,'Unknown');
  assert.equal(f.boundary.snapshot.normalWindowRequested,true);
});
test('normal-window request cannot clear CleanupUnknown',()=>{
  const f=fixture();f.start();accepted(f.host('HostExited'));
  accepted(f.main('ReturnToNormal'));
  assert.equal(f.boundary.snapshot.state,'CleanupUnknown');
  assert.deepEqual(f.main('Attach'),{ok:false,error:'CleanupBlocked'});
});
test('rejects forged Attached reports and renderer-style HWND inputs',()=>{
  const f=fixture();f.start();
  assert.equal(f.host('Attached',{verified:true}).ok,false);
  assert.equal(f.main('Attach',{hwnd:123}).ok,false);
  assert.equal(f.boundary.snapshot.state,'Preparing');
});
test('requires a valid same-session binding and returns only fixed error codes',()=>{
  for(const bad of [{...binding,extra:'private'}, {...binding,owner:{...binding.owner,sessionId:2n}},
    {...binding,attempt:{generation:0n,nonce:2n}}, {...binding,owner:{...binding.owner,pid:-1}}]){
    assert.deepEqual(createNativeSurfaceBoundary(bad),{ok:false,error:'InvalidSchema'});
  }
});
test('Main and Host assembly ports do not expose each others authority',()=>{
  const ports=accepted(createNativeSurfaceBoundary(binding));
  assert.equal(typeof ports.main,'object');
  assert.equal(typeof ports.host,'object');
  assert.equal('observe' in ports.main,false);
  assert.equal('request' in ports.host,false);
});
test('repeated Explorer notifications cannot rewind cleanup or erase Host failure',()=>{
  const f=fixture();f.start();accepted(f.host('HostFailed'));accepted(f.host('CleanupStarted'));
  accepted(f.boundary.explorerChanged({...binding.explorer,generation:2n}));
  accepted(f.boundary.explorerChanged({...binding.explorer,generation:2n}));
  assert.equal(f.boundary.snapshot.state,'CleanupPending');
  assert.equal(f.boundary.snapshot.reason,'HostFailure');
  accepted(f.finish());
  assert.equal(f.boundary.snapshot.state,'Failed');
});
