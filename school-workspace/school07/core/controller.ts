import type{Action,Bridge,State,Context,Item,Lot,Movement}from'./types.js';import type{SchoolState}from'../../school02/core/types.js';import{TaskFault}from'../../school03/core/types.js';import{WorkspaceAuthError}from'../../auth/common/types.js';
export const empty=():State=>({phase:'locked',items:[],locations:[],lots:[],movements:[]});
export interface Port{school(a:'select'|'refresh',i?:Record<string,unknown>):Promise<SchoolState>;call(name:string,args:Record<string,unknown>,signal:AbortSignal):Promise<unknown>}
const writes:Record<string,string>={create:'create_inventory_item',edit:'edit_inventory_item',location:'save_inventory_location',receive:'receive_inventory',use:'use_inventory',adjust:'adjust_inventory',dispose:'dispose_inventory',state:'set_inventory_lot_state'};
export class InventoryController implements Bridge{
 #state=empty();#gen=0;#abort=new AbortController();#writing=false;
 constructor(readonly port:Port){}snapshot(){return structuredClone(this.#state);}invalidate(){this.#gen++;this.#abort.abort();this.#abort=new AbortController();this.#state=empty();}
 async command(action:Action,input:Record<string,unknown>={}):Promise<State>{
 if(action==='select')this.invalidate();else if(input.school&&input.school!==this.#state.school_id)return empty();
 const write=!!writes[action];if(write&&this.#writing)return{...this.snapshot(),success:false};if(write)this.#writing=true;
 const g=this.#gen,signal=this.#abort.signal,check=()=>{if(g!==this.#gen)throw new TaskFault('STALE');};
 const call=async<T>(n:string,p:Record<string,unknown>={},extra:Record<string,unknown>={})=>{const v=await this.port.call('ws_v1_'+n,{p_school_id:this.#state.school_id,p_payload:p,...extra},signal);check();return v as T;};
 try{const school=await this.port.school(action==='select'?'select':'refresh',action==='select'?{school:input.school}:{});check();
 if(school.workspace.phase==='network_error')throw new TaskFault('NETWORK');if(school.workspace.phase!=='approved'||!school.selected)throw new TaskFault('DENIED');if(this.#state.school_id&&this.#state.school_id!==school.selected)throw new TaskFault('STALE');this.#state.school_id=school.selected;this.#state.school_name=school.self.memberships.find(m=>m.school_id===school.selected)?.school_name;
 this.#state.context=await call<Context>('get_inventory_context');let id=input.item_id?String(input.item_id):this.#state.item?.item_id;
 if(write){const payload=input.payload;if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new TaskFault('INPUT');const result=await call<{item_id?:string}>(writes[action]!,payload as Record<string,unknown>,{p_expected_version:input.version,p_request_id:input.request_id});id=result.item_id??id;}
 this.#state.items=await call<Item[]>('list_inventory_items');this.#state.locations=await call<State['locations']>('list_inventory_locations');
 if(id){this.#state.item=await call<Item>('get_inventory_item',{item_id:id});this.#state.lots=await call<Lot[]>('list_inventory_lots',{item_id:id});this.#state.movements=await call<Movement[]>('list_inventory_movements',{item_id:id});}check();this.#state.phase='ready';this.#state.success=write;this.#state.notice=write?'서버 저장 후 최신 재고를 확인했습니다.':undefined;
 }catch(e){if(g!==this.#gen)return this.snapshot();const kind=e instanceof TaskFault?e.kind:e instanceof WorkspaceAuthError?'EXPIRED':'NETWORK';if(kind==='STALE')return this.snapshot();if(['DENIED','EXPIRED'].includes(kind))this.#state={...empty(),phase:'denied',notice:'학교 승인·권한·로그인 상태를 확인해 주세요.'};else this.#state={...this.#state,phase:kind==='CONFLICT'?'conflict':kind==='INPUT'?'ready':'offline',success:false,notice:kind==='CONFLICT'?'다른 재고 변경이 있습니다. 새로고침 후 다시 입력해 주세요.':kind==='INPUT'?'수량·유효기간과 개인정보 없는 운영 내용을 확인해 주세요.':'온라인 연결이 필요합니다. 저장 성공을 확인하지 못했습니다.'};
 }finally{if(write)this.#writing=false;}return this.snapshot();}
}
