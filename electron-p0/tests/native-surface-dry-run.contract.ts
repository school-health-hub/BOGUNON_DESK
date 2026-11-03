import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DryRunExtension} from '../main/desktop-surface/native04b/dry-run.js';
import {bindingSchema} from '../main/desktop-surface/identity.js';
const binding=bindingSchema.parse({attempt:{generation:1n,nonce:2n},owner:{pid:3,creationTime:4n,
  imageSha256:'a'.repeat(64),sessionId:1n},explorer:{generation:5n,process:{pid:6,creationTime:7n,
    imageSha256:'b'.repeat(64),sessionId:1n}}});
test('DryRun prepare binds actual inspected identities and synthetic window; no live permission',()=>{
  const extension=new DryRunExtension('c'.repeat(40),'normal');
  assert.deepEqual(extension.prepare(binding),{sourceSha:'c'.repeat(40),mode:'DryRun',modelWindow:901,
    hostCreated:'4',explorerPid:6,explorerCreated:'7'});
  assert.throws(()=>extension.prepare(binding),{code:'AlreadyStarted'});
});
test('DryRun cannot run before authentication binding',async()=>{
  await assert.rejects(new DryRunExtension('c'.repeat(40),'normal').run(async()=>{throw Error('must not call');}),
    {code:'AuthenticationFailed'});
});
test('closed plan checks sequence, provenance and rejects live attachment claims',async()=>{
  for(const patch of [{sequence:99},{scope:'Live'},{actualAttachmentVerified:true},{extra:'untrusted'}]){
    const extension=new DryRunExtension('c'.repeat(40),'normal');extension.prepare(binding);
    await assert.rejects(extension.run(async body=>{
      assert.equal(body['mode'],'DryRun');assert.equal('capability' in body,false);
      return Buffer.from(JSON.stringify({scope:'DryRun',sequence:1,accepted:true,state:'ModelAttached',
        cleanup:'NotVerified',error:null,actualAttachmentVerified:false,...patch}));
    }));
  }
});

test('malformed response is wiped and parse failure prevents replay',async()=>{
  const e=new DryRunExtension('c'.repeat(40),'normal');e.prepare(binding);const bytes=Buffer.from('not JSON');
  await assert.rejects(e.run(async()=>bytes));assert.ok(bytes.every(value=>value===0));
  await assert.rejects(e.run(async()=>{throw Error('must not retry');}),{code:'AuthenticationFailed'});
});
test('constructor rejects invalid provenance',()=>{
  assert.throws(()=>new DryRunExtension('invalid','normal'),{code:'ProtocolRejected'});
});
