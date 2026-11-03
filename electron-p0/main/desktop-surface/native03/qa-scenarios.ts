import {randomBytes} from 'node:crypto';
import {HostError,deadline} from '../native02/errors.js';
import {FrameChannel} from '../native02/framing.js';
import {recheckHost} from '../native02/approved-host.js';
import type {ApprovedHost} from '../native02/approved-host.js';
import {spawnHost} from '../native02/process-port.js';
import type {ProcessPort,Spawner} from '../native02/process-port.js';
import type {Inspector} from '../native02/windows-inspector.js';
import type {MainHostSession} from './main-session.js';

/** QA-only fault controls: never exposed via Preload or product protocol. */
export class QaChildObservation {
  child:ProcessPort|null=null;
  readonly spawn:Spawner=async(image,ms)=>{
    const port=await spawnHost(image,ms);this.child=port;
    if(!this.delayExit)return port;
    return {...port,exited:port.exited.then(async exit=>{
      await new Promise<void>(done=>setTimeout(done,500));return exit;
    })};
  };
  constructor(readonly delayExit:boolean){}
  async unexpectedExit(session:MainHostSession):Promise<void>{
    const child=this.child;if(!child)throw new HostError('SpawnFailed');
    // Owned headless child handle only; no WebView, other process or process tree exists.
    if(!child.terminate())throw new HostError('SpawnFailed');
    await deadline(child.exited,5000);
    await new Promise<void>(done=>setImmediate(done));
    if(session.snapshot.host?.state!=='CleanupUnknown')throw new HostError('ProtocolRejected');
    try{await session.start();}catch(error){
      if(error instanceof HostError&&error.code==='AlreadyStarted')return;
      if(error instanceof HostError&&error.code==='CleanupUnknown')return;
      throw error;
    }
    throw new HostError('ProtocolRejected');
  }
}

export async function rejectForeignGrant(host:ApprovedHost,inspector:Inspector):Promise<boolean>{
  await recheckHost(host);
  const child=await spawnHost(host.imagePath);
  const channel=new FrameChannel(child.output,child.input,()=>{});
  const capability=randomBytes(32);
  let grant:Buffer|null=null;
  try{
    const peer=await inspector.process(child.pid);
    if(!peer||peer.parentPid!==process.pid||peer.identity.imageSha256!==host.sha256)throw new HostError('PeerMismatch');
    grant=Buffer.from(JSON.stringify({generation:1,attempt:2,expected_surface_pid:child.pid+1,capability:[...capability]}));
    await channel.write(grant,2000);child.input.end();
    const exit=await deadline(child.exited,5000);
    return exit.code===2&&await inspector.process(child.pid)===null;
  }finally{
    grant?.fill(0);capability.fill(0);child.input.end();channel.close();
    // Closing the inherited input is sufficient for this no-resource Host; its independent watchdog is retained.
    await deadline(child.exited,5000);
  }
}
