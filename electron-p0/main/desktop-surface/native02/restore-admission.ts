import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {HostError} from './errors.js';
import {MAX_FRAME} from './framing.js';
const integer=z.number().int().positive().max(Number.MAX_SAFE_INTEGER-1);
const request=z.strictObject({version:z.literal(1),generation:integer,attempt:integer,sequence:integer,
  command:z.literal('OpenMain'),capability:z.string().regex(/^[a-f0-9]{64}$/)});
/** Exact S-3 main_restore.rs wire fields/semantics; narrower safe JSON integer range. */
export class RestoreAdmission {
  #last=0;
  #retired=false;
  readonly #capability:Buffer;
  constructor(readonly generation:number,readonly attempt:number,readonly expectedPid:number,capability:Buffer){
    if(!integer.safeParse(generation).success||!integer.safeParse(attempt).success||capability.length!==32)
      throw new HostError('AuthenticationFailed');
    this.#capability=Buffer.from(capability);
  }
  admit(payload:Buffer,osPid:number,explorerMatches:boolean):void {
    if(this.#retired)throw new HostError('AuthenticationFailed');
    try{
      if(payload.length>MAX_FRAME||osPid!==this.expectedPid||!explorerMatches)throw new HostError('AuthenticationFailed');
      let raw:unknown;try{raw=JSON.parse(payload.toString('utf8'));}catch{throw new HostError('ProtocolRejected');}
      const parsed=request.safeParse(raw);if(!parsed.success)throw new HostError('ProtocolRejected');
      const value=parsed.data;
      const candidate=Buffer.from(value.capability,'hex');
      const matches=timingSafeEqual(candidate,this.#capability);candidate.fill(0);
      if(!matches||value.generation!==this.generation||value.attempt!==this.attempt)throw new HostError('AuthenticationFailed');
      if(value.sequence<=this.#last)throw new HostError('ProtocolRejected');
      this.#last=value.sequence;
    }catch(error){this.retire();throw error;}
  }
  retire():void {this.#retired=true;this.#capability.fill(0);}
}
