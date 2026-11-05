import type{Action,SchoolBridge,SchoolState}from'./types.js';
const initial=():SchoolState=>({workspace:{phase:'signed_out'},directory:[],self:{memberships:[],space_requests:[]},transfers:[]});
/** Safe Renderer/browser state. No credentials, local storage or platform callback code. */
export class SchoolClientStore{
 #state=initial();#generation=0;#listeners=new Set<()=>void>();
 constructor(private readonly bridge:SchoolBridge){}
 snapshot=()=>this.#state;subscribe=(fn:()=>void)=>{this.#listeners.add(fn);return()=>{this.#listeners.delete(fn);};};
 private emit(){for(const f of this.#listeners)f();}
 async command(action:Action,input:Record<string,unknown>={}){
  if(['select','login','logout'].includes(action)){this.#generation++;const directory=action==='select'?this.#state.directory:[];this.#state={...initial(),directory};this.emit();}
  const g=this.#generation;
  try{const next=await this.bridge.command(action,input);if(g===this.#generation){this.#state=next;this.emit();}}
  catch{if(g===this.#generation){this.#state={...initial(),notice:'공동 공간에 연결하지 못했습니다. 개인 업무는 계속 이용할 수 있습니다.'};this.emit();}}
 }
}
