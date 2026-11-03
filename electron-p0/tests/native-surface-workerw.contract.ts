import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HostOwnershipLedger} from '../main/desktop-surface/ownership.js';
import {resourceIdentity,runtimeIdentity} from '../main/desktop-surface/identity.js';
import {accepted,runtime} from './native-surface-fixtures.js';

test('WorkerW restoration and Host exit cannot certify a still-owned Surface window',()=>{
  const ledger=new HostOwnershipLedger();
  accepted(ledger.acquire('Window',resourceIdentity.parse(41n)));
  const lease=accepted(ledger.acquireRegistration(resourceIdentity.parse(42n)));
  accepted(ledger.releaseRegistration(lease,resourceIdentity.parse(42n)));ledger.closeAdmission();
  assert.deepEqual(ledger.evaluate(),{ok:false,error:'ResourceUnresolved'});
});
test('registration lease and full cleanup receipt remain ledger-bound and single-use',()=>{
  const ledger=new HostOwnershipLedger(),foreign=new HostOwnershipLedger();
  const env=resourceIdentity.parse(11n),window=resourceIdentity.parse(41n),registration=resourceIdentity.parse(42n);
  accepted(ledger.acquire('Window',window));accepted(ledger.acquire('Environment',env));
  accepted(ledger.bindRuntime(runtimeIdentity.parse(runtime)));
  const lease=accepted(ledger.acquireRegistration(registration));
  assert.deepEqual(foreign.releaseRegistration(lease,registration),{ok:false,error:'NotOwned'});
  accepted(ledger.releaseRegistration(lease,registration));accepted(ledger.release('Window',window));
  accepted(ledger.release('Environment',env));ledger.closeAdmission();
  assert.deepEqual(ledger.evaluate(),{ok:false,error:'BrowserExitMissing'});
  accepted(ledger.observeBrowserExit({environment:env,browser:runtime.browser,normalExit:true}));
  const receipt=accepted(ledger.evaluate());assert.equal(receipt.scope,'contract-only');
  assert.deepEqual(foreign.consumeReceipt(receipt),{ok:false,error:'ReceiptInvalid'});
  accepted(ledger.consumeReceipt(receipt));assert.deepEqual(ledger.consumeReceipt(receipt),{ok:false,error:'ReceiptInvalid'});
});
test('late cleanup uncertainty invalidates an earlier model receipt',()=>{
  const ledger=new HostOwnershipLedger(),env=resourceIdentity.parse(11n);
  accepted(ledger.acquire('Environment',env));accepted(ledger.bindRuntime(runtimeIdentity.parse(runtime)));
  accepted(ledger.release('Environment',env));ledger.closeAdmission();
  accepted(ledger.observeBrowserExit({environment:env,browser:runtime.browser,normalExit:true}));
  const receipt=accepted(ledger.evaluate());ledger.quarantine('Window');
  assert.deepEqual(ledger.consumeReceipt(receipt),{ok:false,error:'ReceiptInvalid'});
});
