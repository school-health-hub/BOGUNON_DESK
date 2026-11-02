import {randomUUID} from 'node:crypto';
import {createElectronInventoryConnection} from './inventory-connection/electron.js';
import {InventoryError,type InventoryLocalConnection,type PreparedMutation,type RpcInputs,type RpcName} from './inventory-connection/contracts.js';
import {exact,record,uuid,validateRpc,validateNewItem} from './inventory-connection/validation.js';
import {inventoryRpcNames,type InventoryElectronHostCapability} from './inventory-connection/transport.js';
import {inventoryMainTransport} from './inventory-qa-transport.js';
import {inventoryQaAllowed} from './inventory-local-qa.js';
import {assertSender} from './policy.js';
import type {INVENTORY_QA_ACTIONS,InventoryQaResult} from '../inventory-qa-protocol.js';
type Action=typeof INVENTORY_QA_ACTIONS[number];
const messages:Partial<Record<InventoryError['code'],string>>={ENVIRONMENT_BLOCKED:'개발 전용 Local QA 설정을 확인해 주세요.',UNAUTHENTICATED:'인증이 만료되었거나 로그인하지 않았습니다.',PERMISSION_DENIED:'선택한 학교 또는 작업에 대한 권한이 없습니다.',CONFLICT:'서버 상태가 변경되었습니다. 다시 조회해 주세요.',IDEMPOTENCY_CONFLICT:'같은 요청의 내용이 변경되었습니다.',NETWORK_ERROR:'로컬 QA 연결을 확인해 주세요.',TRANSPORT_TIMEOUT:'로컬 QA 요청 시간이 초과되었습니다.',INVALID_INPUT:'입력 형식·UUID·수량을 확인해 주세요.',STALE_CONTEXT:'계정·학교 또는 화면 상태가 변경되었습니다. 다시 조회해 주세요.',REQUEST_IN_FLIGHT:'이미 처리 중인 요청입니다.',DISPOSED:'Local QA 세션이 종료되었습니다.'};
function canonical(value:unknown):string{return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
/** One instance per owner window. Auth secrets and prepared closures never cross IPC. */
export class InventoryQaService {
 private connection?:InventoryLocalConnection;
 private revision=0;private generation=0;private writeBusy=false;private registrationUnknown=false;
 private handles=new Map<string,{prepared:PreparedMutation<RpcName>;payload:string;unknown:boolean;pending:boolean}>();
 private uncertain=new Set<string>();
 constructor(private readonly host:InventoryElectronHostCapability,private readonly publicKey:()=>string,private readonly factory:(key:string)=>InventoryLocalConnection=key=>createElectronInventoryConnection({enabled:true,endpoint:'http://127.0.0.1:56321',publishableKey:key,host,transport:inventoryMainTransport})){}
 close(){const connection=this.connection;this.connection=undefined;this.generation++;this.revision++;this.handles.clear();this.uncertain.clear();this.registrationUnknown=false;this.writeBusy=false;connection?.dispose();}
 private allowed(){let allowed=false;try{allowed=process.env.NODE_ENV!=='production'&&inventoryQaAllowed(this.host.readExecutionState());}catch{/* Host failure closes the session. */}if(!allowed){this.close();throw new InventoryError('ENVIRONMENT_BLOCKED');}}
 private adapter(){this.allowed();if(!this.connection){const c=this.factory(this.publicKey());this.connection=c;c.onInvalidate(()=>{this.revision++;});c.subscribe(()=>{this.handles.clear();this.uncertain.clear();this.registrationUnknown=false;this.generation++;});}return this.connection;}
 async call(action:Action,args:unknown[]):Promise<InventoryQaResult<unknown>>{
  try{
   this.allowed();const noInput=['logout','authState','dispose'].includes(action);if(args.length!==(noInput?0:1))throw new InventoryError('INVALID_INPUT');
   let input:Record<string,unknown>={};if(!noInput){try{input=record(args[0]);}catch{throw new InventoryError('INVALID_INPUT');}}
   if(Buffer.byteLength(JSON.stringify(input))>64*1024)throw new InventoryError('PAYLOAD_TOO_LARGE');
   const fields:Record<Action,string[]>={login:['email','password'],logout:[],authState:[],dispose:[],selectSchool:['contextRevision','schoolId'],listItems:['contextRevision'],itemDetail:['contextRevision','itemId'],movements:['contextRevision',...('itemId' in input?['itemId']:[])],purchaseBatches:['contextRevision'],purchaseProgress:['contextRevision','batchId'],registerItem:['contextRevision','item'],prepare:['contextRevision','operation','input'],execute:['contextRevision','handleId'],discard:['contextRevision','handleId']};
   exact(input,fields[action]);
   if(!noInput&&action!=='login'&&(!Number.isSafeInteger(input.contextRevision)||Number(input.contextRevision)<0))throw new InventoryError('INVALID_INPUT');
   if(action==='dispose'){this.close();return {ok:true,data:{contextRevision:this.revision,value:null}};}
   const c=this.adapter();c.authState(); // Expiry invalidates context before checking the renderer revision.
   if(!noInput&&action!=='login'&&input.contextRevision!==this.revision)throw new InventoryError('STALE_CONTEXT');
   if(action==='login'&&(typeof input.email!=='string'||typeof input.password!=='string'||!/^[-a-z0-9._+]+@example\.invalid$/i.test(input.email)||!input.password||input.password.length>4096))throw new InventoryError('INVALID_INPUT');
   if(action==='selectSchool')uuid(input.schoolId);
   if(action==='itemDetail'||action==='movements'&&input.itemId!==undefined)uuid(input.itemId);
   if(action==='purchaseProgress')uuid(input.batchId);
   if(action==='execute'||action==='discard')uuid(input.handleId);
   if(action==='registerItem'){try{validateNewItem(input.item);}catch{throw new InventoryError('INVALID_INPUT');}}
   if(action==='prepare'){if(!inventoryRpcNames.includes(input.operation as RpcName))throw new InventoryError('INVALID_INPUT');validateRpc(input.operation as RpcName,input.input as RpcInputs[RpcName]);}
   const changes=['login','logout','selectSchool','registerItem','execute'].includes(action);
   if(changes&&this.writeBusy)throw new InventoryError('REQUEST_IN_FLIGHT');
   if(changes)this.writeBusy=true;
   const generation=this.generation,revision=this.revision;let value:unknown;
   try{
    switch(action){
     case 'login':await c.login(input.email as string,input.password as string);value=c.authState();break;
     case 'logout':await c.logout();value=c.authState();break;
     case 'authState':value=c.authState();break;
     case 'selectSchool':await c.selectSchool(input.schoolId as string);value=c.authState();break;
     case 'listItems':value=await c.listItems();break;
     case 'itemDetail':value=await c.itemDetail(input.itemId as string);break;
     case 'movements':value=await c.movements(input.itemId as string|undefined);break;
     case 'purchaseBatches':value=await c.purchaseBatches();break;
     case 'purchaseProgress':value=await c.purchaseProgress(input.batchId as string);break;
     case 'registerItem':
      if(this.registrationUnknown)throw new InventoryError('CONFLICT',undefined,true);
      try{value=await c.registerItem(input.item as Parameters<InventoryLocalConnection['registerItem']>[0]);}catch(e){if(e instanceof InventoryError&&e.outcomeUnknown)this.registrationUnknown=true;throw e;}break;
     case 'prepare':{
      const payload=canonical({operation:input.operation,input:input.input});
      const existing=[...this.handles].find(([,h])=>h.payload===payload);
      if(existing){value={handleId:existing[0],requestUuid:existing[1].prepared.requestUuid};break;}
      if(this.uncertain.size>0)throw new InventoryError('CONFLICT',undefined,true);
      if(this.handles.size>=64)throw new InventoryError('REQUEST_IN_FLIGHT');
      const handleId=randomUUID(),prepared=c.prepare(input.operation as RpcName,input.input as RpcInputs[RpcName],randomUUID());this.handles.set(handleId,{prepared,payload,pending:false,unknown:false});value={handleId,requestUuid:prepared.requestUuid};break;
     }
     case 'execute':{
      const h=this.handles.get(input.handleId as string);if(!h)throw new InventoryError('STALE_CONTEXT');if(h.pending)throw new InventoryError('REQUEST_IN_FLIGHT');h.pending=true;
      try{value=await h.prepared.execute();h.unknown=false;this.uncertain.delete(h.payload);}catch(e){if(e instanceof InventoryError&&e.outcomeUnknown){h.unknown=true;this.uncertain.add(h.payload);}throw e;}finally{h.pending=false;}break;
     }
     case 'discard':{const h=this.handles.get(input.handleId as string);if(!h)throw new InventoryError('STALE_CONTEXT');if(h.pending)throw new InventoryError('REQUEST_IN_FLIGHT');this.handles.delete(input.handleId as string);value=null;break;}
    }
    this.allowed();if(this.connection!==c)throw new InventoryError('STALE_CONTEXT',undefined,changes);
    if(!changes&&(this.generation!==generation||this.revision!==revision))throw new InventoryError('STALE_CONTEXT');
    if(Buffer.byteLength(JSON.stringify(value))>2*1024*1024)throw new InventoryError('RESPONSE_TOO_LARGE',undefined,changes);
    return {ok:true,data:{contextRevision:this.revision,value}};
   }finally{if(changes&&this.connection===c)this.writeBusy=false;}
  }catch(error){const e=error instanceof InventoryError?error:new InventoryError('INVALID_INPUT');return {ok:false,error:{contextRevision:this.revision,code:e.code,...(e.serverCode?{serverCode:e.serverCode}:{}),outcomeUnknown:e.outcomeUnknown,retryable:false,message:e.outcomeUnknown?'요청 결과가 불명확합니다. 새 요청을 자동 전송하지 마세요. 서버 재고를 다시 확인해 주세요.':messages[e.code]??'Local QA 요청을 완료하지 못했습니다.'}};}
 }
}
export function inventoryQaHandler(service:InventoryQaService,action:Action,contents:Parameters<typeof assertSender>[1],url:string){
 return async(event:Parameters<typeof assertSender>[0],...args:unknown[])=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{contextRevision:0,code:'ENVIRONMENT_BLOCKED',message:'허용되지 않은 호출입니다.',outcomeUnknown:false,retryable:false}};}
  const result=await service.call(action,args);
  try{assertSender(event,contents,url);}catch{service.close();return {ok:false,error:{contextRevision:0,code:'STALE_CONTEXT',message:'창 상태가 변경되었습니다.',outcomeUnknown:false,retryable:false}};}
  return result;
 };
}
