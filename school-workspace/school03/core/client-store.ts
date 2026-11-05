import{emptyTaskState}from'./controller.js';import{type TaskAction,type TaskBridge,type TaskState}from'./types.js';
export class TaskClientStore{
 #state:TaskState=emptyTaskState();#generation=0;#listeners=new Set<()=>void>();#pending?:{key:string;id:string};#busy=false;
 constructor(private readonly bridge:TaskBridge){}
 snapshot=()=>this.#state;subscribe=(fn:()=>void)=>{this.#listeners.add(fn);return()=>{this.#listeners.delete(fn);};};
 private emit(){for(const f of this.#listeners)f();}
 clear(){this.#generation++;this.#state=emptyTaskState();this.#pending=undefined;this.#busy=false;this.emit();}
 async command(action:TaskAction,input:Record<string,unknown>={}):Promise<boolean>{
  if(action==='select')this.clear();if(this.#busy)return false;const g=this.#generation;this.#busy=true;
  const write=['create','edit','assign','status','close'].includes(action);let args=action==='select'?{...input}:{...input,school:this.#state.school_id};
  if(write){if(this.#state.phase!=='ready'){this.#busy=false;return false;}const key=JSON.stringify([this.#state.school_id,action,input]);if(this.#pending?.key!==key)this.#pending={key,id:crypto.randomUUID()};args={...args,request_id:this.#pending.id};}
  try{const s=await this.bridge.command(action,args);if(g!==this.#generation)return false;if(action!=='select'&&this.#state.school_id&&s.school_id&&s.school_id!==this.#state.school_id){this.clear();return false;}this.#state=s;if(s.notice_kind==='success')this.#pending=undefined;this.emit();return s.notice_kind==='success';}
  catch{if(g===this.#generation){this.#state={...this.#state,phase:'offline',notice_kind:'error',notice:'저장 완료 여부를 확인하지 못했습니다. 연결 후 새로고침해 주세요.'};this.emit();}return false;}
  finally{if(g===this.#generation)this.#busy=false;}
 }
}
