import type {Readable,Writable} from 'node:stream';
import {HostError,deadline} from './errors.js';
export const MAX_FRAME=512;
type Pending=Readonly<{resolve:(data:Buffer)=>void;reject:(error:HostError)=>void}>;
/** S-3 memory_channel.rs: nonzero bounded u32 little-endian length + payload. */
export class FrameChannel {
  #buffer=Buffer.alloc(0);
  readonly #queue:Buffer[]=[];
  #pending:Pending|null=null;
  #closed=false;
  #quiet=false;
  constructor(output:Readable,readonly input:Writable,readonly fault:(error:HostError)=>void){
    output.on('data',(chunk:unknown)=>{
      if(!Buffer.isBuffer(chunk)){this.#fail(new HostError('ProtocolRejected'));return;}
      if(this.#closed)return;
      if(chunk.length>3*(MAX_FRAME+4)){this.#fail(new HostError('ProtocolRejected'));return;}
      this.#buffer=Buffer.concat([this.#buffer,chunk]);
      while(this.#buffer.length>=4){
        const length=this.#buffer.readUInt32LE(0);
        if(length===0||length>MAX_FRAME){this.#fail(new HostError('ProtocolRejected'));return;}
        if(this.#buffer.length<length+4)break;
        const payload=Buffer.from(this.#buffer.subarray(4,4+length));
        this.#buffer=this.#buffer.subarray(4+length);
        if(this.#quiet){payload.fill(0);this.#fail(new HostError('ProtocolRejected'));return;}
        const pending=this.#pending;this.#pending=null;
        if(pending)pending.resolve(payload);else this.#queue.push(payload);
        if(this.#queue.length>2){this.#fail(new HostError('ProtocolRejected'));return;}
      }
      if(this.#buffer.length>MAX_FRAME+4)this.#fail(new HostError('ProtocolRejected'));
    });
    output.on('end',()=>this.#fail(new HostError('ChannelClosed')));
    output.on('error',()=>this.#fail(new HostError('ChannelClosed')));
    input.on('error',()=>this.#fail(new HostError('ChannelClosed')));
  }
  #fail(error:HostError):void {
    if(this.#closed)return;this.#closed=true;
    this.#buffer.fill(0);for(const payload of this.#queue)payload.fill(0);this.#queue.length=0;
    const pending=this.#pending;this.#pending=null;pending?.reject(error);this.fault(error);
  }
  async read(ms:number):Promise<Buffer>{
    if(this.#closed)throw new HostError('ChannelClosed');
    const queued=this.#queue.shift();if(queued)return queued;
    if(this.#pending)throw new HostError('ProtocolRejected');
    try{return await deadline(new Promise<Buffer>((resolve,reject)=>{this.#pending={resolve,reject};}),ms);}
    catch(error){this.close();throw error;}
  }
  async write(payload:Buffer,ms:number):Promise<void>{
    if(this.#closed||payload.length===0||payload.length>MAX_FRAME)throw new HostError('ProtocolRejected');
    const frame=Buffer.alloc(payload.length+4);frame.writeUInt32LE(payload.length);payload.copy(frame,4);
    try{await deadline(new Promise<void>((resolve,reject)=>this.input.write(frame,error=>{
      if(error)reject(new HostError('ChannelClosed'));else resolve();
    })),ms);}finally{frame.fill(0);}
  }
  expectSilence():void {
    if(this.#queue.length||this.#buffer.length){this.#fail(new HostError('ProtocolRejected'));throw new HostError('ProtocolRejected');}
    this.#quiet=true;
  }
  close():void {this.#fail(new HostError('ChannelClosed'));}
}
