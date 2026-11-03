import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {createNativeSurfaceBoundary} from '../boundary.js';
import {bindingSchema,sameExplorer,sameProcess} from '../identity.js';
import type {Binding,ExplorerIdentity} from '../identity.js';
import type {NativeSurfaceBoundary} from '../types.js';
import {approvedPathMatches,recheckHost} from './approved-host.js';
import type {ApprovedHost} from './approved-host.js';
import {HostError,deadline,fixedError} from './errors.js';
import {FrameChannel} from './framing.js';
import {spawnHost} from './process-port.js';
import type {ProcessPort,Spawner} from './process-port.js';
import {RestoreAdmission} from './restore-admission.js';
import type {Inspector,ObservedProcess} from './windows-inspector.js';

const ack=z.strictObject({accepted:z.literal(true),code:z.literal('OPENED')});
// Main-process lifetime lease: an unverified Native cleanup must not enable a second launcher.
const launchLeases=new Set<string>();
export type LauncherState='Idle'|'Starting'|'Authenticated'|'Stopping'|'Failed'|'CleanupUnknown';
export type LauncherSnapshot=Readonly<{state:LauncherState;error:string|null;processExitVerified:boolean;
  forcedTermination:boolean;nativeCleanup:'NotVerified';nativeAttachmentVerified:false;normalWindowRequested:boolean}>;
/** Trusted Electron Main service only. No renderer/preload IPC or Shell operation is registered here. */
export class NativeHostLauncher {
  #state:LauncherState='Idle';#error:string|null=null;#exitVerified=false;#forced=false;#normal=false;
  #process:ProcessPort|null=null;#peer:ObservedProcess|null=null;#explorer:ExplorerIdentity|null=null;
  #channel:FrameChannel|null=null;#admission:RestoreAdmission|null=null;
  #boundary:NativeSurfaceBoundary|null=null;#binding:Binding|null=null;#mainSequence=0n;#hostSequence=0n;
  #exited=false;#observedExit=false;#stopPromise:Promise<LauncherSnapshot>|null=null;
  #startupFinished:Promise<void>|null=null;#finishStartup:(()=>void)|null=null;
  constructor(readonly approved:ApprovedHost,readonly inspector:Inspector,readonly spawner:Spawner=spawnHost){}
  get snapshot():LauncherSnapshot{return Object.freeze({state:this.#state,error:this.#error,
    processExitVerified:this.#exitVerified,forcedTermination:this.#forced,nativeCleanup:'NotVerified',
    nativeAttachmentVerified:false,normalWindowRequested:this.#normal});}
  #main(kind:'Attach'|'ReturnToNormal'):void {
    if(!this.#binding||!this.#boundary)throw new HostError('ProtocolRejected');
    const result=this.#boundary.main.request({...this.#binding,sequence:++this.#mainSequence,kind});
    if(!result.ok)throw new HostError('ProtocolRejected');
  }
  #host(kind:'HostStarted'|'CleanupStarted'|'HostExited'|'CleanupFinished'):void {
    if(!this.#binding||!this.#boundary)return;
    const result=this.#boundary.host.observe({...this.#binding,sequence:++this.#hostSequence,kind});
    // Headless Host has no browser/UDF evidence: never manufacture a cleanup receipt.
    if(!result.ok&&kind!=='CleanupFinished')this.#error='CleanupUnknown';
  }
  #retire(error:HostError):void {
    this.#error=error.code;this.#admission?.retire();this.#normal=true;
    if(this.#state==='Starting'||this.#state==='Authenticated'){
      this.#state='CleanupUnknown';this.#process?.input.end();
    }
  }
  async #verifyPeer():Promise<void>{
    const child=this.#process,peer=this.#peer,explorer=this.#explorer;
    if(!child||!peer||!explorer||this.#exited)throw new HostError('PeerMismatch');
    const current=await this.inspector.process(child.pid);
    if(!current||!sameProcess(peer.identity,current.identity)||current.parentPid!==process.pid
      ||!approvedPathMatches(current.imagePath,this.approved))throw new HostError('PeerMismatch');
    const latest=await this.inspector.explorer();
    if(!sameExplorer(explorer,latest)){
      this.#boundary?.main.explorerChanged(latest);throw new HostError('ExplorerChanged');
    }
  }
  async start():Promise<LauncherSnapshot>{
    if(this.#state==='CleanupUnknown')throw new HostError('CleanupUnknown');
    if(this.#state!=='Idle')throw new HostError('AlreadyStarted');
    if(!approvedPathMatches(this.approved.imagePath,this.approved))throw new HostError('PathRejected');
    const lease=process.platform==='win32'?this.approved.imagePath.toLowerCase():this.approved.imagePath;
    if(launchLeases.has(lease))throw new HostError('AlreadyStarted');
    launchLeases.add(lease);
    this.#startupFinished=new Promise(done=>{this.#finishStartup=done;});
    this.#state='Starting';const end=Date.now()+24000;
    const remaining=():number=>{
      if(this.#state!=='Starting')throw new HostError('ChannelClosed');
      const ms=end-Date.now();if(ms<=0)throw new HostError('Deadline');return ms;
    };
    const bounded=<T>(operation:()=>Promise<T>):Promise<T>=>{
      const ms=remaining();return deadline(operation(),ms);
    };
    const capability=randomBytes(32);
    try{
      await bounded(()=>recheckHost(this.approved));
      this.#explorer=await bounded(()=>this.inspector.explorer());
      // Spawner owns its bounded start failure/late-spawn cleanup; do not abandon a spawn promise.
      this.#process=await this.spawner(this.approved.imagePath,remaining());
      const child=this.#process;
      void child.exited.then(()=>{
        this.#exited=true;
        if(this.#state!=='Stopping')this.#retire(new HostError('ChannelClosed'));
      });
      this.#channel=new FrameChannel(child.output,child.input,error=>{
        if(this.#state!=='Stopping')this.#retire(error);
      });
      this.#peer=await bounded(()=>this.inspector.process(child.pid));
      if(!this.#peer||this.#peer.parentPid!==process.pid||this.#peer.identity.imageSha256!==this.approved.sha256
        ||!approvedPathMatches(this.#peer.imagePath,this.approved))throw new HostError('PeerMismatch');
      const attempt=randomBytes(6).readUIntBE(0,6)+1;
      const generation=randomBytes(6).readUIntBE(0,6)+1;
      this.#binding=bindingSchema.parse({attempt:{generation:BigInt(generation),nonce:BigInt(attempt)},
        owner:this.#peer.identity,explorer:this.#explorer});
      const created=createNativeSurfaceBoundary(this.#binding);
      if(!created.ok)throw new HostError('PeerMismatch');
      this.#boundary=created.value;this.#main('Attach');
      await bounded(()=>recheckHost(this.approved));
      await bounded(()=>this.#verifyPeer());
      this.#admission=new RestoreAdmission(generation,attempt,child.pid,capability);
      const grant=Buffer.from(JSON.stringify({generation,attempt,expected_surface_pid:child.pid,capability:[...capability]}));
      try{await this.#channel.write(grant,remaining());}finally{grant.fill(0);}
      const request=await this.#channel.read(remaining());
      try{
        await bounded(()=>this.#verifyPeer());
        this.#admission.admit(request,child.pid,true);
      }finally{request.fill(0);}
      // Existing OpenMain semantics: request recorded, no UI focus operation in this isolated service.
      this.#normal=true;
      await this.#channel.write(Buffer.from(JSON.stringify({accepted:true,code:'OPENED'})),remaining());
      const response=await this.#channel.read(remaining());
      try{ack.parse(JSON.parse(response.toString('utf8')));}finally{response.fill(0);}
      if(this.#state!=='Starting'||this.#exited)throw new HostError('ChannelClosed');
      this.#channel.expectSilence();this.#host('HostStarted');this.#state='Authenticated';
      return this.snapshot;
    }catch(error){
      this.#retire(fixedError(error));
      if(this.#process)await this.stop();else this.#state='Failed';
      throw fixedError(error);
    }finally{capability.fill(0);this.#finishStartup?.();}
  }
  async checkHealth():Promise<LauncherSnapshot>{
    if(this.#state!=='Authenticated')throw new HostError('AuthenticationFailed');
    try{await deadline(this.#verifyPeer(),12000);}catch(error){this.#retire(fixedError(error));throw fixedError(error);}
    return this.snapshot;
  }
  stop():Promise<LauncherSnapshot>{
    if(!this.#process){
      this.#normal=true;this.#state='Failed';this.#admission?.retire();
      return this.#startupFinished?this.#startupFinished.then(()=>this.snapshot):Promise.resolve(this.snapshot);
    }
    this.#stopPromise??=this.#stop();return this.#stopPromise;
  }
  async #stop():Promise<LauncherSnapshot>{
    const child=this.#process;if(!child)return this.snapshot;
    this.#state='Stopping';this.#admission?.retire();this.#normal=true;
    if(this.#boundary){this.#main('ReturnToNormal');this.#host('CleanupStarted');}
    child.input.end();
    try{
      const exit=await deadline(child.exited,3000);
      if(exit.code!==0||exit.signal!==null)this.#error='ChannelClosed';
    }catch{
      this.#error='Deadline';
      // Only the exact child handle plus independently matching creation identity can be terminated.
      const current=await deadline(this.inspector.process(child.pid),5500).catch(()=>null);
      if(current&&this.#peer&&sameProcess(current.identity,this.#peer.identity)){
        this.#forced=child.terminate();
        try{await deadline(child.exited,3000);}catch{this.#error='Deadline';}
      }
    }
    if(this.#exited){
      try{
        const residual=await deadline(this.inspector.process(child.pid),5500);
        this.#exitVerified=!residual||(this.#peer!==null&&!sameProcess(residual.identity,this.#peer.identity));
      }catch{this.#exitVerified=false;}
      if(!this.#observedExit){this.#host('HostExited');this.#observedExit=true;}
    }
      this.#host('CleanupFinished');this.#channel?.close();
    this.#state='CleanupUnknown';return this.snapshot;
  }
}
