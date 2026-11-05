import{empty}from'./controller.js';import type{Bridge,Action}from'./types.js';
export class InventoryStore{
 #state=empty();#gen=0;#busy=false;#listeners=new Set<()=>void>();#request?:{key:string;id:string};constructor(readonly bridge:Bridge){}snapshot=()=>this.#state;subscribe=(fn:()=>void)=>{this.#listeners.add(fn);return()=>{this.#listeners.delete(fn);};};private emit(){for(const f of this.#listeners)f();}clear(){this.#gen++;this.#state=empty();this.#busy=false;this.#request=undefined;this.emit();}
 async command(a:Action,i:Record<string,unknown>={}){if(a==='select')this.clear();if(this.#busy)return false;this.#busy=true;const g=this.#gen,write=!['select','refresh','detail'].includes(a);let args={...i,school:a==='select'?i.school:this.#state.school_id};
 if(write){if(this.#state.phase!=='ready'){this.#busy=false;return false;}const key=JSON.stringify([a,args]);if(this.#request?.key!==key)this.#request={key,id:crypto.randomUUID()};args={...args,request_id:this.#request.id}as typeof args;}
 try{const next=await this.bridge.command(a,args);if(g!==this.#gen)return false;if(next.school_id&&this.#state.school_id&&next.school_id!==this.#state.school_id){this.clear();return false;}this.#state=next;if(next.success)this.#request=undefined;this.emit();return !!next.success;}
 catch{if(g===this.#gen){this.#state={...this.#state,phase:'offline',success:false,notice:'온라인 연결이 필요합니다. 저장 성공을 확인하지 못했습니다.'};this.emit();}return false;}finally{if(g===this.#gen)this.#busy=false;}}
}
