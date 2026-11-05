import{empty}from'./controller.js';import type{Action,Bridge}from'./types.js';
export class ActivityStore{
 #state=empty();#gen=0;#busy=false;#listeners=new Set<()=>void>();#pending?:{key:string;id:string};
 constructor(private readonly bridge:Bridge){}
 snapshot=()=>this.#state;subscribe=(f:()=>void)=>{this.#listeners.add(f);return()=>{this.#listeners.delete(f);};};private emit(){for(const f of this.#listeners)f();}
 clear(){this.#gen++;this.#state=empty();this.#pending=undefined;this.#busy=false;this.emit();}
 async command(a:Action,input:Record<string,unknown>={}):Promise<boolean>{if(a==='select')this.clear();if(this.#busy)return false;const g=this.#gen;this.#busy=true;const write=['event_save','event_cancel','note_create','note_edit','note_ack','note_complete'].includes(a);let args:Record<string,unknown>={...input,school:a==='select'?input.school:this.#state.school_id};
  if(write){if(this.#state.phase!=='ready'){this.#busy=false;return false;}const key=JSON.stringify([this.#state.school_id,a,input]);if(this.#pending?.key!==key)this.#pending={key,id:crypto.randomUUID()};args={...args,request_id:this.#pending.id};}
  try{const s=await this.bridge.command(a,args);if(g!==this.#gen)return false;if(a!=='select'&&s.school_id&&this.#state.school_id&&s.school_id!==this.#state.school_id){this.clear();return false;}this.#state=s;if(s.notice_kind==='success')this.#pending=undefined;this.emit();return s.notice_kind==='success';}
  catch{if(g===this.#gen){this.#state={...this.#state,phase:'offline',notice_kind:'error',notice:'온라인 연결이 필요합니다. 저장·확인 완료 여부를 확인하지 못했습니다.'};this.emit();}return false;}finally{if(g===this.#gen)this.#busy=false;}
 }
}
