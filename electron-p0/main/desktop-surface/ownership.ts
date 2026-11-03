import {sameProcess} from './identity.js';
import type {BrowserExit,Resource,ResourceIdentity,RuntimeIdentity} from './identity.js';
import type {Result} from './types.js';

type Slot=Readonly<{kind:'Owned'|'Released';identity:ResourceIdentity}>|Readonly<{kind:'Unresolved'}>;
export type ContractCleanupReceipt=Readonly<{scope:'contract-only'}>;

/** Host-side model only: no OS ownership is inferred from these observations.
 * Mutable slots/receipt authority intentionally belong to this single ledger.
 * Like S-3, a substitute resolved ledger cannot issue this ledger's receipt.
 */
export class HostOwnershipLedger {
  readonly #slots=new Map<Resource,Slot>();
  readonly #receipts=new WeakMap<object,bigint>();
  #revision=0n;
  #runtime:RuntimeIdentity|null=null;
  #exit:BrowserExit|null=null;
  #admissionOpen=true;
  #issued=false;
  readonly #registrationLeases=new WeakMap<object,ResourceIdentity>();
  acquireRegistration(identity:ResourceIdentity):Result<object> {
    const acquired=this.#acquire('BackendRegistration',identity);
    if(!acquired.ok)return acquired;
    const lease=Object.freeze({});this.#registrationLeases.set(lease,identity);
    return {ok:true,value:lease};
  }
  releaseRegistration(lease:unknown,identity:ResourceIdentity):Result<null> {
    if(typeof lease!=='object'||lease===null)return {ok:false,error:'NotOwned'};
    const expected=this.#registrationLeases.get(lease);
    if(expected===undefined)return {ok:false,error:'NotOwned'};
    if(expected!==identity)return {ok:false,error:'WrongIdentity'};
    const released=this.#release('BackendRegistration',identity);
    if(released.ok)this.#registrationLeases.delete(lease);
    return released;
  }

  acquire(resource:Resource,identity:ResourceIdentity):Result<null> {
    if(resource==='BackendRegistration')return {ok:false,error:'LeaseRequired'};
    return this.#acquire(resource,identity);
  }
  #acquire(resource:Resource,identity:ResourceIdentity):Result<null> {
    if(!this.#admissionOpen||this.#issued)return {ok:false,error:'AdmissionClosed'};
    if(this.#slots.has(resource))return {ok:false,error:'AlreadyRecorded'};
    this.#slots.set(resource,{kind:'Owned',identity});this.#revision++;
    return {ok:true,value:null};
  }
  release(resource:Resource,identity:ResourceIdentity):Result<null> {
    if(resource==='BackendRegistration')return {ok:false,error:'LeaseRequired'};
    return this.#release(resource,identity);
  }
  #release(resource:Resource,identity:ResourceIdentity):Result<null> {
    const slot=this.#slots.get(resource);
    if(!slot)return {ok:false,error:'NotOwned'};
    switch(slot.kind){
      case 'Owned':
        if(slot.identity!==identity)return {ok:false,error:'WrongIdentity'};
        this.#slots.set(resource,{kind:'Released',identity});this.#revision++;return {ok:true,value:null};
      case 'Released':return {ok:false,error:'AlreadyRecorded'};
      case 'Unresolved':return {ok:false,error:'ResourceUnresolved'};
      default:return slot satisfies never;
    }
  }
  quarantine(resource:Resource):void {this.#slots.set(resource,{kind:'Unresolved'});this.#revision++;}
  bindRuntime(runtime:RuntimeIdentity):Result<null> {
    if(this.#runtime)return {ok:false,error:'AlreadyRecorded'};
    const environment=this.#slots.get('Environment');
    if(!environment||environment.kind!=='Owned'||environment.identity!==runtime.environment)
      return {ok:false,error:'RuntimeMismatch'};
    this.#runtime=runtime;return {ok:true,value:null};
  }
  observeBrowserExit(exit:BrowserExit):Result<null> {
    if(this.#exit)return {ok:false,error:'AlreadyRecorded'};
    this.#exit=exit;return {ok:true,value:null};
  }
  closeAdmission():void {this.#admissionOpen=false;}
  evaluate():Result<ContractCleanupReceipt> {
    if(this.#admissionOpen)return {ok:false,error:'AdmissionOpen'};
    if([...this.#slots.values()].some(slot=>slot.kind!=='Released'))return {ok:false,error:'ResourceUnresolved'};
    if(!this.#runtime)return {ok:false,error:'RuntimeMissing'};
    if(!this.#exit)return {ok:false,error:'BrowserExitMissing'};
    if(this.#exit.environment!==this.#runtime.environment||!sameProcess(this.#exit.browser,this.#runtime.browser))
      return {ok:false,error:'RuntimeMismatch'};
    if(!this.#exit.normalExit)return {ok:false,error:'AbnormalBrowserExit'};
    if(this.#issued)return {ok:false,error:'AlreadyRecorded'};
    this.#issued=true;
    const receipt:ContractCleanupReceipt=Object.freeze({scope:'contract-only'});
    this.#receipts.set(receipt,this.#revision);
    return {ok:true,value:receipt};
  }
  consumeReceipt(receipt:unknown):Result<null> {
    if(typeof receipt!=='object'||receipt===null)return {ok:false,error:'ReceiptInvalid'};
    const revision=this.#receipts.get(receipt);
    this.#receipts.delete(receipt);
    if(revision===undefined||revision!==this.#revision)
      return {ok:false,error:'ReceiptInvalid'};
    return {ok:true,value:null};
  }
}
