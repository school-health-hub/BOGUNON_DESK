import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HostOwnershipLedger} from '../main/desktop-surface/ownership.js';
import {resourceIdentity,runtimeIdentity,browserExit} from '../main/desktop-surface/identity.js';
import {accepted,fixture,runtime} from './native-surface-fixtures.js';

function resolvedLedger(){
  const ledger=new HostOwnershipLedger(),identity=resourceIdentity.parse(11n);
  accepted(ledger.acquire('Environment',identity));
  accepted(ledger.bindRuntime(runtimeIdentity.parse(runtime)));
  accepted(ledger.release('Environment',identity));
  accepted(ledger.observeBrowserExit(browserExit.parse({environment:11n,browser:runtime.browser,normalExit:true})));
  ledger.closeAdmission();return ledger;
}
test('a foreign ledger receipt cannot substitute for actual ownership',()=>{
  const first=resolvedLedger(),other=resolvedLedger();
  const receipt=accepted(first.evaluate());
  assert.deepEqual(other.consumeReceipt(receipt),{ok:false,error:'ReceiptInvalid'});
  accepted(first.consumeReceipt(receipt));
  assert.deepEqual(first.consumeReceipt(receipt),{ok:false,error:'ReceiptInvalid'});
});
test('plain and cloned receipt objects have no issuance authority',()=>{
  const ledger=resolvedLedger(),receipt=accepted(ledger.evaluate());
  for(const forged of [{scope:'contract-only'},structuredClone(receipt),null]){
    assert.deepEqual(ledger.consumeReceipt(forged),{ok:false,error:'ReceiptInvalid'});
  }
});
test('resolved resources and normal browser exit cannot bypass open admission',()=>{
  const ledger=new HostOwnershipLedger(),identity=resourceIdentity.parse(11n);
  accepted(ledger.acquire('Environment',identity));accepted(ledger.bindRuntime(runtimeIdentity.parse(runtime)));
  accepted(ledger.release('Environment',identity));
  accepted(ledger.observeBrowserExit(browserExit.parse({environment:11n,browser:runtime.browser,normalExit:true})));
  assert.deepEqual(ledger.evaluate(),{ok:false,error:'AdmissionOpen'});
});
test('backend registration ownership cannot be released with just an integer identity',()=>{
  const ledger=new HostOwnershipLedger(),id=resourceIdentity.parse(44n);
  assert.deepEqual(ledger.acquire('BackendRegistration',id),{ok:false,error:'LeaseRequired'});
  assert.deepEqual(ledger.release('BackendRegistration',id),{ok:false,error:'LeaseRequired'});
});
test('backend registration lease cannot be forged or transferred to another ledger',()=>{
  const ledger=new HostOwnershipLedger(),other=new HostOwnershipLedger(),id=resourceIdentity.parse(44n);
  const lease=accepted(ledger.acquireRegistration(id));
  assert.deepEqual(other.releaseRegistration(lease,id),{ok:false,error:'NotOwned'});
  assert.deepEqual(ledger.releaseRegistration({},id),{ok:false,error:'NotOwned'});
  assert.deepEqual(ledger.releaseRegistration(lease,resourceIdentity.parse(45n)),{ok:false,error:'WrongIdentity'});
  accepted(ledger.releaseRegistration(lease,id));
  assert.equal(ledger.releaseRegistration(lease,id).ok,false);
});
test('Host-side registration lease releases correctly before cleanup',()=>{
  const f=fixture();f.start();
  accepted(f.host('ResourceAcquired',{resource:'BackendRegistration',identity:44n}));
  accepted(f.main('Cancel'));accepted(f.host('CleanupStarted'));
  accepted(f.host('ResourceReleased',{resource:'BackendRegistration',identity:44n}));
  accepted(f.finish());assert.equal(f.boundary.snapshot.cleanup,'Verified');
});
test('closed admission rejects new resource acquisition before receipt issuance',()=>{
  const ledger=new HostOwnershipLedger();ledger.closeAdmission();
  assert.deepEqual(ledger.acquire('Window',resourceIdentity.parse(77n)),{ok:false,error:'AdmissionClosed'});
  assert.deepEqual(ledger.acquireRegistration(resourceIdentity.parse(88n)),{ok:false,error:'AdmissionClosed'});
});
test('issuing a receipt cannot be followed by new ownership',()=>{
  const ledger=resolvedLedger(),receipt=accepted(ledger.evaluate());
  assert.deepEqual(ledger.acquire('Window',resourceIdentity.parse(77n)),{ok:false,error:'AdmissionClosed'});
  accepted(ledger.consumeReceipt(receipt));
});
test('late unresolved ownership invalidates an already issued receipt',()=>{
  const ledger=resolvedLedger(),receipt=accepted(ledger.evaluate());
  ledger.quarantine('Controller');
  assert.deepEqual(ledger.consumeReceipt(receipt),{ok:false,error:'ReceiptInvalid'});
});
