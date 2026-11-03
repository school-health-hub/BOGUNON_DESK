import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {PassThrough} from 'node:stream';
import {approveHost,HOST_FILE} from '../main/desktop-surface/native02/approved-host.js';
import {RestoreAdmission} from '../main/desktop-surface/native02/restore-admission.js';
import {FrameChannel} from '../main/desktop-surface/native02/framing.js';
import {HostError} from '../main/desktop-surface/native02/errors.js';
import {NativeHostLauncher} from '../main/desktop-surface/native02/launcher.js';
import type {ProcessPort,Exit} from '../main/desktop-surface/native02/process-port.js';
import type {Inspector,ObservedProcess} from '../main/desktop-surface/native02/windows-inspector.js';
import {explorerIdentity} from '../main/desktop-surface/identity.js';

const capability=Buffer.alloc(32,7);
const payload=(patch:Record<string,unknown>={}):Buffer=>Buffer.from(JSON.stringify({version:1,generation:1,attempt:2,
  sequence:1,command:'OpenMain',capability:capability.toString('hex'),...patch}));
test('S-3 restore admission accepts once; replay retires admission',()=>{
  const admission=new RestoreAdmission(1,2,3,capability);
  admission.admit(payload(),3,true);
  assert.throws(()=>admission.admit(payload(),3,true),{code:'ProtocolRejected'});
  assert.throws(()=>admission.admit(payload({sequence:2}),3,true),{code:'AuthenticationFailed'});
});
for(const [name,patch,pid,explorer] of [
  ['wrong capability',{capability:'00'.repeat(32)},3,true],['wrong session',{attempt:3},3,true],
  ['wrong owner',{},4,true],['wrong Explorer',{},3,false],['unknown fields',{extra:1},3,true],
  ['bad sequence',{sequence:0},3,true],['wrong command',{command:'Attach'},3,true],
] as const)test(`admission rejects ${name}`,()=>assert.throws(()=>new RestoreAdmission(1,2,3,capability)
  .admit(payload(patch),pid,explorer),HostError));

test('framing accepts fragments and rejects oversized/truncated input',async()=>{
  const output=new PassThrough(),input=new PassThrough();let faults=0;
  const channel=new FrameChannel(output,input,()=>faults++);
  const frame=Buffer.from([3,0,0,0,1,2,3]);
  output.write(frame.subarray(0,2));output.write(frame.subarray(2));
  assert.deepEqual(await channel.read(100),Buffer.from([1,2,3]));
  output.write(Buffer.from([0,4,0,0]));assert.equal(faults,1);
  await assert.rejects(channel.read(100),{code:'ChannelClosed'});
});
test('framing deadline retires channel',async()=>{
  const channel=new FrameChannel(new PassThrough(),new PassThrough(),()=>{});
  await assert.rejects(channel.read(5),{code:'Deadline'});
  await assert.rejects(channel.read(5),{code:'ChannelClosed'});
});

const explorer=explorerIdentity.parse({generation:1n,process:{pid:9,creationTime:2n,sessionId:1n,imageSha256:'a'.repeat(64)}});
async function fixture(mode:'normal'|'bad-auth'|'no-exit'='normal'){
  const parent=resolve('artifacts/native-02/fixtures');await mkdir(parent,{recursive:true});
  const root=await mkdtemp(join(parent,'case-'));await mkdir(join(root,'native-surface'));
  const bytes=Buffer.from('test-only-not-an-executable');const sha256=createHash('sha256').update(bytes).digest('hex');
  const imagePath=join(root,'native-surface',HOST_FILE);await writeFile(imagePath,bytes);
  const approved=await approveHost({mode:'packaged',root,sha256,sourceSha:'c'.repeat(40)});
  const input=new PassThrough(),output=new PassThrough();let alive=true,finish:((exit:Exit)=>void)|undefined;
  const exited=new Promise<Exit>(done=>{finish=done;});
  const exit=():void=>{if(!alive)return;alive=false;output.end();finish?.({code:0,signal:null});};
  const port:ProcessPort={pid:333,input,output,exited,terminate:()=>{exit();return true;}};
  const peer:ObservedProcess={identity:{pid:333,creationTime:5n,imageSha256:sha256,sessionId:1n},parentPid:process.pid,imagePath};
  let currentExplorer=explorer;
  const inspector:Inspector={process:async()=>alive?peer:null,explorer:async()=>currentExplorer};
  const host=new FrameChannel(input,output,()=>{});
  const run=async():Promise<void>=>{
    const grant:unknown=JSON.parse((await host.read(2000)).toString('utf8'));
    assert.ok(typeof grant==='object'&&grant!==null&&'generation' in grant&&'attempt' in grant&&'capability' in grant);
    const data=grant as {generation:number;attempt:number;capability:number[]};
    await host.write(payload({generation:data.generation,attempt:data.attempt,
      capability:mode==='bad-auth'?'00'.repeat(32):Buffer.from(data.capability).toString('hex')}),2000);
    if(mode==='bad-auth')return;
    await host.write(await host.read(2000),2000);
  };
  input.on('end',()=>{if(mode!=='no-exit')exit();});
  return {approved,inspector,exit,changeExplorer:()=>{currentExplorer=explorerIdentity.parse({...explorer,generation:2n});},
    spawner:async()=>{void run().catch(()=>exit());return port;}};
}
test('lifecycle authenticates, rejects duplicate, EOF exits; no fabricated native cleanup',async()=>{
  const f=await fixture(),launcher=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  assert.equal((await launcher.start()).state,'Authenticated');
  await assert.rejects(launcher.start(),{code:'AlreadyStarted'});
  const stopped=await launcher.stop();assert.equal(stopped.processExitVerified,true);
  assert.equal(stopped.nativeCleanup,'NotVerified');assert.equal(stopped.state,'CleanupUnknown');
  await assert.rejects(launcher.start(),{code:'CleanupUnknown'});
});
test('authentication failure closes child and never admits Native commands',async()=>{
  const f=await fixture('bad-auth'),launcher=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  await assert.rejects(launcher.start(),{code:'AuthenticationFailed'});
  assert.equal(launcher.snapshot.state,'CleanupUnknown');assert.equal(launcher.snapshot.processExitVerified,true);
});
test('Explorer generation change retires session',async()=>{
  const f=await fixture(),launcher=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  await launcher.start();f.changeExplorer();
  await assert.rejects(launcher.checkHealth(),{code:'ExplorerChanged'});await launcher.stop();
  assert.equal(launcher.snapshot.state,'CleanupUnknown');
});
test('unexpected child exit retires session',async()=>{
  const f=await fixture(),launcher=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  await launcher.start();f.exit();await new Promise(done=>setImmediate(done));
  assert.equal(launcher.snapshot.state,'CleanupUnknown');await launcher.stop();
});
test('missing shutdown response uses bounded owned-process termination',async()=>{
  const f=await fixture('no-exit'),launcher=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  await launcher.start();const result=await launcher.stop();
  assert.equal(result.forcedTermination,true);assert.equal(result.processExitVerified,true);
  assert.equal(result.state,'CleanupUnknown');
});
for(const code of ['SpawnDenied','SpawnFailed'] as const)test(`launcher ${code} preserves normal window`,async()=>{
  const f=await fixture(),launcher=new NativeHostLauncher(f.approved,f.inspector,async()=>{throw new HostError(code);});
  await assert.rejects(launcher.start(),{code});assert.equal(launcher.snapshot.state,'Failed');
  assert.equal(launcher.snapshot.normalWindowRequested,true);
});
test('missing executable and hash mismatch are rejected before spawn',async()=>{
  const f=await fixture();await assert.rejects(approveHost({mode:'packaged',root:resolve('artifacts/native-02/missing'),
    sha256:'0'.repeat(64),sourceSha:'c'.repeat(40)}),{code:'MissingExecutable'});
  await assert.rejects(approveHost({mode:'packaged',root:resolve(f.approved.imagePath,'../..'),sha256:'0'.repeat(64),
    sourceSha:'c'.repeat(40)}),{code:'DigestMismatch'});
});
test('stop before start permanently closes launcher admission',async()=>{
  const f=await fixture(),launcher=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  await launcher.stop();await assert.rejects(launcher.start(),{code:'AlreadyStarted'});
});
test('stop during preflight prevents a later child spawn',async()=>{
  const f=await fixture();let release:(()=>void)|undefined;let entered:(()=>void)|undefined;let spawned=false;
  const inspecting=new Promise<void>(done=>{entered=done;});
  const barrier=new Promise<void>(done=>{release=done;});
  const inspector:Inspector={...f.inspector,explorer:async()=>{entered?.();await barrier;return explorer;}};
  const launcher=new NativeHostLauncher(f.approved,inspector,async()=>{spawned=true;return f.spawner();});
  const starting=launcher.start();const rejected=assert.rejects(starting,HostError);
  await inspecting;const stopping=launcher.stop();release?.();await stopping;await rejected;assert.equal(spawned,false);
});
test('stop during pending spawn captures late child and closes it',async()=>{
  const f=await fixture();let release:(()=>void)|undefined;let entered:(()=>void)|undefined;
  const spawning=new Promise<void>(done=>{entered=done;});
  const barrier=new Promise<void>(done=>{release=done;});
  const launcher=new NativeHostLauncher(f.approved,f.inspector,async()=>{entered?.();await barrier;return f.spawner();});
  const rejected=assert.rejects(launcher.start(),HostError);
  await spawning;const stopping=launcher.stop();release?.();await stopping;await rejected;
  assert.equal(launcher.snapshot.processExitVerified,true);
  assert.equal(launcher.snapshot.state,'CleanupUnknown');
});
test('independent launcher cannot bypass Main process one-shot lease',async()=>{
  const f=await fixture(),first=new NativeHostLauncher(f.approved,f.inspector,f.spawner);
  await first.start();
  await assert.rejects(new NativeHostLauncher(f.approved,f.inspector,f.spawner).start(),{code:'AlreadyStarted'});
  await first.stop();
});
test('incomplete frame EOF rejects pending read; no truncated payload accepted',async()=>{
  const output=new PassThrough(),channel=new FrameChannel(output,new PassThrough(),()=>{});
  const rejected=assert.rejects(channel.read(100),{code:'ChannelClosed'});
  output.end(Buffer.from([3,0,0,0,1]));await rejected;
});
test('stalled shutdown identity inspection is bounded and cannot authorize termination',
  {timeout:15000},async()=>{
    const f=await fixture('no-exit');let stalled=false;
    const inspector:Inspector={...f.inspector,process:async pid=>stalled?new Promise(()=>{}):f.inspector.process(pid)};
    const launcher=new NativeHostLauncher(f.approved,inspector,f.spawner);await launcher.start();stalled=true;
    try{
      const result=await launcher.stop();assert.equal(result.state,'CleanupUnknown');
      assert.equal(result.forcedTermination,false);assert.equal(result.processExitVerified,false);
    }finally{f.exit();}
  });
test('cancelled late spawn does not start an abandoned rejecting inspection',async()=>{
  const f=await fixture();let release:(()=>void)|undefined;let entered:(()=>void)|undefined;let inspections=0;
  const spawning=new Promise<void>(done=>{entered=done;});
  const barrier=new Promise<void>(done=>{release=done;});
  const inspector:Inspector={...f.inspector,process:async()=>{inspections++;throw new HostError('InspectionFailed');}};
  const launcher=new NativeHostLauncher(f.approved,inspector,async()=>{entered?.();await barrier;return f.spawner();});
  const rejected=assert.rejects(launcher.start(),{code:'ChannelClosed'});
  await spawning;const stopping=launcher.stop();release?.();await stopping;await rejected;
  // Only bounded residual inspection runs. Cancelled startup must not create an orphan promise.
  assert.equal(inspections,1);assert.equal(launcher.snapshot.processExitVerified,false);
});
