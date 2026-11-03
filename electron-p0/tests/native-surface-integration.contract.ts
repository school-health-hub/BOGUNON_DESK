import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as integration from '../main/desktop-surface/native03/main-session.js';
import {installNativeQuitBoundary} from '../main/desktop-surface/native03/quit-boundary.js';
import {HostError} from '../main/desktop-surface/native02/errors.js';
import type {LauncherSnapshot} from '../main/desktop-surface/native02/launcher.js';
import type {HostPort} from '../main/desktop-surface/native03/main-session.js';

test('disabled Main integration never constructs or starts a Host',async()=>{
  let constructed=false;
  const session=integration.createMainHostSession({mode:'disabled',packaged:false},
    ()=>{constructed=true;throw new Error('must not construct');},()=>{});
  assert.equal(session.snapshot.mode,'disabled');
  await assert.rejects(session.start(),{code:'AuthenticationFailed'});
  await session.stop();assert.equal(constructed,false);
});
test('packaged QA activation fails closed before constructing a Host',()=>{
  assert.throws(()=>integration.createMainHostSession({mode:'isolated-qa',packaged:true},
    ()=>{throw new Error('must not construct');},()=>{}),{code:'AuthenticationFailed'});
});
function hostFixture(){
  let state:LauncherSnapshot={state:'Idle',error:null,processExitVerified:false,forcedTermination:false,
    nativeCleanup:'NotVerified',nativeAttachmentVerified:false,normalWindowRequested:false};
  let stopCalls=0;
  const host:HostPort={get snapshot(){return state;},
    start:async()=>{state={...state,state:'Authenticated',normalWindowRequested:true};return state;},
    checkHealth:async()=>state,
    stop:async()=>{stopCalls++;state={...state,state:'CleanupUnknown',processExitVerified:true};return state;}};
  return {host,get stopCalls(){return stopCalls;}};
}
test('Main uses existing launcher port, preserves normal-window requests and cannot restart after cleanup unknown',async()=>{
  const f=hostFixture();let returned=0;
  const session=integration.createMainHostSession({mode:'isolated-qa',packaged:false},()=>f.host,()=>returned++);
  assert.equal((await session.start()).state,'Authenticated');
  await assert.rejects(session.start(),{code:'AlreadyStarted'});
  await session.checkHealth();assert.equal(returned,2);
  assert.equal((await session.stop())?.nativeCleanup,'NotVerified');
  await assert.rejects(session.start(),{code:'CleanupUnknown'});
});
for(const code of ['SpawnFailed','AuthenticationFailed','ChannelClosed','PeerMismatch','ExplorerChanged'] as const)
  test(`Main ${code} failure requests ordinary-window fallback`,async()=>{
    const f=hostFixture();let returned=0;
    const host:HostPort={...f.host,start:async()=>{throw new HostError(code);}};
    const session=integration.createMainHostSession({mode:'isolated-qa',packaged:false},()=>host,()=>returned++);
    await assert.rejects(session.start(),{code});assert.equal(returned,1);await session.stop();
  });
test('before-quit holds Main window until delayed Host stop and diagnostic flush complete',async()=>{
  const f=hostFixture();let release:(()=>void)|undefined;
  const barrier=new Promise<void>(done=>{release=done;});
  const host:HostPort={...f.host,stop:async()=>{await barrier;return f.host.stop();}};
  const session=integration.createMainHostSession({mode:'isolated-qa',packaged:false},()=>host,()=>{});
  await session.start();let listener:((event:{preventDefault():void})=>void)|undefined;
  let quitCalls=0,prevented=0,flushed=false;
  const app={on:(_name:'before-quit',callback:NonNullable<typeof listener>)=>{listener=callback;},
    quit:()=>{quitCalls++;listener?.({preventDefault:()=>prevented++});}};
  installNativeQuitBoundary(app,session,async error=>{assert.equal(error,null);flushed=true;});
  app.quit();app.quit();assert.equal(prevented,2);assert.equal(flushed,false);assert.equal(f.stopCalls,0);
  release?.();await new Promise(done=>setImmediate(done));
  assert.equal(flushed,true);assert.equal(f.stopCalls,1);assert.equal(quitCalls,3);
});
test('quit stop failure is recorded without clearing cleanup uncertainty',async()=>{
  const f=hostFixture();const host:HostPort={...f.host,stop:async()=>{throw new HostError('Deadline');}};
  const session=integration.createMainHostSession({mode:'isolated-qa',packaged:false},()=>host,()=>{});
  await session.start();let listener:((event:{preventDefault():void})=>void)|undefined;let recorded:string|null=null;
  const app={on:(_name:'before-quit',callback:NonNullable<typeof listener>)=>{listener=callback;},
    quit:()=>{listener?.({preventDefault:()=>{}});}};
  installNativeQuitBoundary(app,session,async error=>{recorded=error;});app.quit();
  await new Promise(done=>setImmediate(done));assert.equal(recorded,'Deadline');
  await assert.rejects(session.start(),{code:'CleanupUnknown'});
});
test('diagnostic flush rejection does not issue a second completion quit',async()=>{
  const session=integration.createMainHostSession({mode:'disabled',packaged:false},()=>{throw new Error('unused');},()=>{});
  let listener:((event:{preventDefault():void})=>void)|undefined,quits=0;
  const app={on:(_name:'before-quit',callback:NonNullable<typeof listener>)=>{listener=callback;},
    quit:()=>{quits++;listener?.({preventDefault:()=>{}});}};
  installNativeQuitBoundary(app,session,async()=>{throw new HostError('SpawnFailed');});app.quit();
  await new Promise(done=>setImmediate(done));assert.equal(quits,2);
});
test('invalid activation and extra fields are rejected',()=>{
  const factory=():never=>{throw new Error('must not construct');};
  for(const input of [{mode:'enabled',packaged:false},{mode:'isolated-qa',packaged:'false'},
    {mode:'isolated-qa',packaged:false,path:'untrusted'}])
    assert.throws(()=>integration.createMainHostSession(input,factory,()=>{}),{code:'AuthenticationFailed'});
});
test('factory failure requests normal window; quit before start never constructs Host',async()=>{
  let returned=0,constructed=0;
  const factory=():never=>{constructed++;throw new HostError('MissingExecutable');};
  const failed=integration.createMainHostSession({mode:'isolated-qa',packaged:false},factory,()=>returned++);
  await assert.rejects(failed.start(),{code:'MissingExecutable'});assert.equal(returned,1);
  const idle=integration.createMainHostSession({mode:'isolated-qa',packaged:false},factory,()=>{});
  await idle.stop();await assert.rejects(idle.start(),{code:'CleanupUnknown'});assert.equal(constructed,1);
});
test('health rejection returns to ordinary window without restarting Host',async()=>{
  const f=hostFixture();let returned=0,constructed=0;
  const session=integration.createMainHostSession({mode:'isolated-qa',packaged:false},()=>{
    constructed++;return {...f.host,checkHealth:async()=>{throw new HostError('ExplorerChanged');}};
  },()=>returned++);
  await session.start();await assert.rejects(session.checkHealth(),{code:'ExplorerChanged'});
  assert.equal(returned,2);assert.equal(constructed,1);await session.stop();
});
