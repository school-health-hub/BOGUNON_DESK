import {bindingSchema,explorerIdentity,hostObservation,mainRequest,resourceIdentity,sameExplorer,sameProcess} from './identity.js';
import type {Binding,HostObservation,MainRequest} from './identity.js';
import {HostOwnershipLedger} from './ownership.js';
import type {FailureCode,NativeSurfaceBoundary,Reason,Result,Snapshot} from './types.js';

/** Main-facing admission/state and a separate Host-facing observation port.
 * No process launcher, Electron IPC, HWND adapter or filesystem capability exists.
 */
class SurfaceContract {
  readonly #binding:Binding;
  readonly #ledger=new HostOwnershipLedger();
  #lastMain=0n;
  #lastHost=0n;
  #used=false;
  #retired=false;
  #registrationLease:object|null=null;
  #snapshot:Snapshot=Object.freeze({scope:'contract-only',state:'Detached',host:'Stopped',
    cleanup:'NotNeeded',reason:'None',admissionOpen:false,normalWindowRequested:false,nativeAttachmentVerified:false});

  constructor(binding:Binding){this.#binding=binding;}
  get snapshot():Snapshot {return this.#snapshot;}
  #update(patch:Partial<Snapshot>):Result<Snapshot> {
    this.#snapshot=Object.freeze({...this.#snapshot,...patch});
    return {ok:true,value:this.#snapshot};
  }
  #deny(error:FailureCode):Result<Snapshot> {return {ok:false,error};}
  #context(value:MainRequest|HostObservation,last:bigint):FailureCode|null {
    if(value.attempt.generation!==this.#binding.attempt.generation||value.attempt.nonce!==this.#binding.attempt.nonce)return 'WrongSession';
    if(!sameProcess(value.owner,this.#binding.owner))return 'WrongOwner';
    if(!sameExplorer(value.explorer,this.#binding.explorer))return 'WrongExplorer';
    if(value.sequence<=last)return 'StaleSequence';
    return null;
  }
  #recover(reason:Reason):Result<Snapshot> {
    this.#retired=true;
    return this.#update({state:'Recovering',host:'Stopping',cleanup:'Pending',reason,
      admissionOpen:false,normalWindowRequested:true});
  }
  #unknown():void {
    this.#retired=true;this.#ledger.closeAdmission();
    this.#update({state:'CleanupUnknown',cleanup:'Unknown',reason:'CleanupIncomplete',admissionOpen:false,normalWindowRequested:true});
  }
  #ledgerResult<T>(result:Result<T>):Result<Snapshot> {
    if(!result.ok){this.#unknown();return this.#deny(result.error);}
    return {ok:true,value:this.#snapshot};
  }
  main(input:unknown):Result<Snapshot> {
    const parsed=mainRequest.safeParse(input);
    if(!parsed.success)return this.#deny('InvalidSchema');
    const value=parsed.data,error=this.#context(value,this.#lastMain);
    if(error)return this.#deny(error);
    this.#lastMain=value.sequence;
    if(value.kind==='ReturnToNormal')return this.#snapshot.state==='Preparing'
      ?this.#recover('NormalWindowRequested'):this.#update({normalWindowRequested:true});
    if(this.#snapshot.state==='CleanupUnknown')return this.#deny('CleanupBlocked');
    switch(value.kind){
      case 'Attach':
        if(this.#snapshot.state!=='Detached')return this.#deny('InvalidTransition');
        if(this.#used||this.#retired)return this.#deny('Retired');
        this.#used=true;
        return this.#update({state:'Preparing',host:'Starting',cleanup:'Pending',admissionOpen:true});
      case 'Cancel':
        if(this.#snapshot.state!=='Preparing')return this.#deny('InvalidTransition');
        return this.#recover('Cancelled');
      default:return value satisfies never;
    }
  }
  explorerChanged(input:unknown):Result<Snapshot> {
    const parsed=explorerIdentity.safeParse(input);
    if(!parsed.success)return this.#deny('InvalidSchema');
    if(parsed.data.generation<this.#binding.explorer.generation)return this.#deny('WrongExplorer');
    if(sameExplorer(parsed.data,this.#binding.explorer))return {ok:true,value:this.#snapshot};
    if(this.#snapshot.state==='CleanupUnknown')return this.#deny('CleanupBlocked');
    if(!this.#used){
      this.#retired=true;
      return this.#update({state:'Failed',reason:'ExplorerChanged',normalWindowRequested:true});
    }
    if(this.#snapshot.cleanup==='Verified')return this.#update({normalWindowRequested:true});
    if(this.#snapshot.state==='Recovering'||this.#snapshot.state==='CleanupPending'){
      this.#retired=true;
      return this.#update({admissionOpen:false,normalWindowRequested:true});
    }
    return this.#recover('ExplorerChanged');
  }
  host(input:unknown):Result<Snapshot> {
    const parsed=hostObservation.safeParse(input);
    if(!parsed.success)return this.#deny('InvalidSchema');
    const value=parsed.data,error=this.#context(value,this.#lastHost);
    if(error)return this.#deny(error);
    this.#lastHost=value.sequence;
    if(this.#snapshot.state==='CleanupUnknown')return this.#deny('CleanupBlocked');
    if(!this.#used||this.#snapshot.cleanup==='Verified')return this.#deny('InvalidTransition');
    switch(value.kind){
      case 'HostStarted':{
        if(this.#snapshot.state!=='Preparing'||this.#snapshot.host!=='Starting'){
          this.#unknown();return this.#deny('InvalidTransition');
        }
        const result=this.#ledger.acquire('Host',resourceIdentity.parse(BigInt(this.#binding.owner.pid)));
        if(!result.ok)return this.#ledgerResult(result);
        return this.#update({host:'Running'});
      }
      case 'ResourceAcquired':
        if(this.#snapshot.state!=='Preparing'||this.#snapshot.host!=='Running')return this.#invalidHostTransition();
        if(value.resource==='BackendRegistration'){
          const lease=this.#ledger.acquireRegistration(value.identity);
          if(lease.ok)this.#registrationLease=lease.value;
          return this.#ledgerResult(lease);
        }
        return this.#ledgerResult(this.#ledger.acquire(value.resource,value.identity));
      case 'ResourceReleased':
        if(value.resource==='Host'||!this.#isRetiring())return this.#invalidHostTransition();
        if(value.resource==='BackendRegistration')return this.#ledgerResult(this.#ledger.releaseRegistration(this.#registrationLease,value.identity));
        return this.#ledgerResult(this.#ledger.release(value.resource,value.identity));
      case 'ResourceUnknown':
        this.#ledger.quarantine(value.resource);this.#unknown();return {ok:true,value:this.#snapshot};
      case 'RuntimeBound':
        if(this.#snapshot.state!=='Preparing'||this.#snapshot.host!=='Running')return this.#invalidHostTransition();
        if(value.runtime.browser.sessionId!==this.#binding.owner.sessionId){this.#unknown();return this.#deny('RuntimeMismatch');}
        return this.#ledgerResult(this.#ledger.bindRuntime(value.runtime));
      case 'BrowserExited':
        if(!this.#isRetiring())return this.#invalidHostTransition();
        return this.#ledgerResult(this.#ledger.observeBrowserExit(value.exit));
      case 'CleanupStarted':
        if(this.#snapshot.state!=='Recovering')return this.#invalidHostTransition();
        this.#ledger.closeAdmission();return this.#update({state:'CleanupPending'});
      case 'CleanupFinished':return this.#finishCleanup();
      case 'HostFailed':
        if(this.#snapshot.state!=='Preparing')return this.#invalidHostTransition();
        return this.#recover('HostFailure');
      case 'HostExited':{
        const expected=this.#snapshot.state==='CleanupPending';
        const released=this.#ledger.release('Host',resourceIdentity.parse(BigInt(this.#binding.owner.pid)));
        this.#update({host:'Exited'});
        if(!released.ok)return this.#ledgerResult(released);
        if(!expected){this.#unknown();this.#update({reason:'UnexpectedHostExit'});}
        return {ok:true,value:this.#snapshot};
      }
      default:return value satisfies never;
    }
  }
  #isRetiring():boolean {
    return (this.#snapshot.state==='Recovering'||this.#snapshot.state==='CleanupPending')&&this.#snapshot.host!=='Exited';
  }
  #invalidHostTransition():Result<Snapshot> {this.#unknown();return this.#deny('InvalidTransition');}
  #finishCleanup():Result<Snapshot> {
    if(this.#snapshot.state!=='CleanupPending'||this.#snapshot.host!=='Exited')return this.#invalidHostTransition();
    const receipt=this.#ledger.evaluate();
    if(!receipt.ok){this.#unknown();return this.#deny(receipt.error);}
    const consumed=this.#ledger.consumeReceipt(receipt.value);
    if(!consumed.ok)return this.#ledgerResult(consumed);
    return this.#update({state:this.#snapshot.reason==='HostFailure'?'Failed':'Detached',cleanup:'Verified',admissionOpen:false});
  }
}
export function createNativeSurfaceBoundary(input:unknown):Result<NativeSurfaceBoundary> {
  const parsed=bindingSchema.safeParse(input);
  if(!parsed.success)return {ok:false,error:'InvalidSchema'};
  const contract=new SurfaceContract(parsed.data);
  return {ok:true,value:Object.freeze({scope:'contract-only',
    main:Object.freeze({get snapshot(){return contract.snapshot;},
      request:(request:unknown)=>contract.main(request),
      explorerChanged:(observation:unknown)=>contract.explorerChanged(observation)}),
    host:Object.freeze({observe:(observation:unknown)=>contract.host(observation)}),
  })};
}
