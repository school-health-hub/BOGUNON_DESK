import { InventoryError } from './contracts.js';
import { exact, record, uuid, validateRpc, validateNewItem } from './validation.js';
import type { RpcName } from './contracts.js';

export const INVENTORY_TRANSPORT_VERSION = 1 as const;
export const INVENTORY_LOCAL_ORIGIN = 'http://127.0.0.1:56321';
export const INVENTORY_TRANSPORT_LIMITS = Object.freeze({ timeoutMs: 15000, requestBytes: 64 * 1024, responseBytes: 2 * 1024 * 1024, authResponseBytes: 32 * 1024 });
export const inventoryReadTables = ['inventory_members','inventory_items','inventory_stock_lots','inventory_stock_movements','inventory_purchase_batches','inventory_purchase_lines','inventory_purchase_receipts','inventory_purchase_receipt_lines'] as const;
export type InventoryReadTable = typeof inventoryReadTables[number];
export const inventoryRpcNames = ['inventory_use_stock','inventory_receive_stock','inventory_dispose_stock','inventory_adjust_stock','inventory_reverse_movement','inventory_create_purchase_batch','inventory_set_purchase_batch_status','inventory_confirm_receipt'] as const;
export type InventoryApiPath = '/auth/v1/token' | '/auth/v1/logout' | `/rest/v1/${InventoryReadTable}` | `/rest/v1/rpc/${RpcName}`;
/** No host, URL, arbitrary headers, method, filesystem path or IPC channel. */
export interface InventoryTransportRequest {
  readonly version: 1;
  readonly id: string;
  readonly method: 'GET' | 'POST';
  readonly path: InventoryApiPath;
  readonly query: Readonly<Record<string,string>>;
  readonly body: Readonly<Record<string,unknown>> | null;
  readonly credentials: { readonly publicKey: string; readonly bearer: string | null };
}
export interface InventoryTransportResponse {
  readonly version: 1;
  readonly id: string;
  readonly status: number;
  readonly redirected: false;
  readonly body: string;
}
/** Signal is local wrapper state; never structured-clone it into IPC. */
export interface InventoryTransport {
  readonly kind: 'browser-local-qa' | 'electron-local-qa';
  readonly version: 1;
  send(request: InventoryTransportRequest, signal: AbortSignal): Promise<InventoryTransportResponse>;
}
export interface InventoryElectronTransport extends InventoryTransport { readonly kind: 'electron-local-qa' }
/** Non-serializable capability owned by trusted Main code, never by renderer IPC. */
export interface InventoryElectronHostCapability {
  readExecutionState(): { packaged: boolean; devUrl: string | undefined; optIn: string | undefined };
}
export interface ElectronLocalQaOptions {
  readonly enabled: true;
  readonly host: InventoryElectronHostCapability;
  readonly endpoint: typeof INVENTORY_LOCAL_ORIGIN;
  readonly publishableKey: string;
  readonly transport: InventoryElectronTransport;
}
const bytes=(s:string)=>new TextEncoder().encode(s).byteLength;
export function validatePublicKey(value: unknown): void {
  if(typeof value!=='string' || value.length>8192)throw new InventoryError('ENVIRONMENT_BLOCKED');
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(value))return;
  try { if(record(JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))).role==='anon')return; } catch { /* Fixed errors only. */ }
  throw new InventoryError('ENVIRONMENT_BLOCKED');
}
export function validateUserBearer(value: unknown): void {
  if(typeof value!=='string' || value.length>16384)throw new InventoryError('UNAUTHENTICATED');
  try { if(record(JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))).role==='authenticated')return; } catch { /* Do not expose credentials. */ }
  throw new InventoryError('UNAUTHENTICATED');
}
/** Pure validation for BOTH the adapter and Cloud A's independently guarded IPC handler. */
export function validateInventoryTransportRequest(input: unknown): asserts input is InventoryTransportRequest {
  const r=record(input);exact(r,['version','id','method','path','query','body','credentials']);
  if(r.version!==1 || !['GET','POST'].includes(String(r.method)))throw new InventoryError('ENVIRONMENT_BLOCKED');
  uuid(r.id);const q=record(r.query),c=record(r.credentials);exact(c,['publicKey','bearer']);validatePublicKey(c.publicKey);
  if(bytes(JSON.stringify(r))>INVENTORY_TRANSPORT_LIMITS.requestBytes)throw new InventoryError('PAYLOAD_TOO_LARGE');
  if(r.path==='/auth/v1/token') {
    if(r.method!=='POST' || c.bearer!==null)throw new InventoryError('ENVIRONMENT_BLOCKED');
    exact(q,['grant_type']);if(q.grant_type!=='password')throw new InventoryError('ENVIRONMENT_BLOCKED');
    const b=record(r.body);exact(b,['email','password']);
    if(typeof b.email!=='string' || !/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(b.email) || typeof b.password!=='string' || !b.password || b.password.length>4096)throw new InventoryError('INVALID_INPUT');
    return;
  }
  validateUserBearer(c.bearer);
  if(r.path==='/auth/v1/logout') {
    exact(q,['scope']);if(q.scope!=='local' || r.method!=='POST' || r.body!==null)throw new InventoryError('ENVIRONMENT_BLOCKED');return;
  }
  if(typeof r.path!=='string')throw new InventoryError('ENVIRONMENT_BLOCKED');
  const table=r.path.slice('/rest/v1/'.length);
  if(r.method==='GET' && inventoryReadTables.includes(table as InventoryReadTable) && r.path===`/rest/v1/${table}`) {
    const order:Record<InventoryReadTable,string>={inventory_members:'user_id',inventory_items:'item_id',inventory_stock_lots:'lot_id',inventory_stock_movements:'movement_id',inventory_purchase_batches:'batch_id',inventory_purchase_lines:'line_id',inventory_purchase_receipts:'receipt_id',inventory_purchase_receipt_lines:'receipt_line_id'};
    if(r.body!==null || q.select!=='*' || q.order!==`${order[table as InventoryReadTable]}.asc` || q.limit!=='500' || typeof q.offset!=='string' || !/^\d+$/.test(q.offset) || Number(q.offset)>=100000 || Number(q.offset)%500!==0)throw new InventoryError('ENVIRONMENT_BLOCKED');
    const allowed=['select','order','limit','offset','school_id','item_id','batch_id','user_id','is_active'];
    if(Object.keys(q).some(k=>!allowed.includes(k)))throw new InventoryError('ENVIRONMENT_BLOCKED');
    if(typeof q.school_id!=='string' || !q.school_id.startsWith('eq.'))throw new InventoryError('ENVIRONMENT_BLOCKED');uuid(q.school_id.slice(3));
    for(const k of ['item_id','batch_id','user_id'])if(k in q){if(typeof q[k]!=='string' || !q[k].startsWith('eq.'))throw new InventoryError('ENVIRONMENT_BLOCKED');uuid(q[k].slice(3));}
    if('is_active' in q && q.is_active!=='eq.true')throw new InventoryError('ENVIRONMENT_BLOCKED');
    return;
  }
  if(r.method==='POST' && r.path.startsWith('/rest/v1/rpc/') && inventoryRpcNames.includes(r.path.slice('/rest/v1/rpc/'.length) as RpcName)) {
    exact(q,[]);const b=record(r.body);uuid(b.p_school_id);uuid(b.p_request_uuid);
    const {p_school_id:school,p_request_uuid:request,...args}=b;void school;void request;
    validateRpc(r.path.slice('/rest/v1/rpc/'.length) as RpcName,args as never);return;
  }
  if(r.method==='POST' && r.path==='/rest/v1/inventory_items') {
    exact(q,[]);const b=record(r.body);exact(b,['school_id','item_name','category','specification','base_unit','purchase_unit','base_units_per_purchase_unit','recommended_stock','minimum_stock','is_active']);uuid(b.school_id);const {school_id,...item}=b;void school_id;validateNewItem(item);return;
  }
  throw new InventoryError('ENVIRONMENT_BLOCKED');
}
function frozenClone<T>(value:T):T {
  const clone=JSON.parse(JSON.stringify(value)) as T;
  function freeze(v:unknown):void { if(v && typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);} }
  freeze(clone);return clone;
}
/** Enforce time/size/cancellation even when an injected bridge ignores AbortSignal. */
export async function sendInventoryRequest(transport: InventoryTransport, request: InventoryTransportRequest, signal: AbortSignal):Promise<InventoryTransportResponse> {
  if(transport.version!==1 || !['browser-local-qa','electron-local-qa'].includes(transport.kind) || typeof transport.send!=='function')throw new InventoryError('ENVIRONMENT_BLOCKED');
  validateInventoryTransportRequest(request);const captured=frozenClone(request);
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort=()=>{};
  try {
    if(signal.aborted)throw new InventoryError('STALE_CONTEXT',undefined,request.method==='POST');
    const stopped=new Promise<never>((_,reject)=>{
      onAbort=()=>{controller.abort();reject(new InventoryError('STALE_CONTEXT',undefined,request.method==='POST'));};
      signal.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>{controller.abort();reject(new InventoryError('TRANSPORT_TIMEOUT',undefined,request.method==='POST'));},INVENTORY_TRANSPORT_LIMITS.timeoutMs);
    });
    const result=await Promise.race([transport.send(captured,controller.signal),stopped]);
    const r=record(result);exact(r,['version','id','status','redirected','body']);
    if(r.version!==1 || r.id!==request.id || r.redirected!==false || typeof r.status!=='number' || !Number.isInteger(r.status) || r.status<200 || r.status>599 || (r.status>=300 && r.status<400) || typeof r.body!=='string')throw new InventoryError('INVALID_RESPONSE',undefined,request.method==='POST');
    const maximum=request.path.startsWith('/auth/')?INVENTORY_TRANSPORT_LIMITS.authResponseBytes:INVENTORY_TRANSPORT_LIMITS.responseBytes;
    if(bytes(r.body)>maximum)throw new InventoryError('RESPONSE_TOO_LARGE',undefined,request.method==='POST');
    return {...result};
  } catch(e) {
    if(e instanceof InventoryError)throw e;
    throw new InventoryError('NETWORK_ERROR',undefined,request.method==='POST');
  } finally {clearTimeout(timer);signal.removeEventListener('abort',onAbort);controller.abort();}
}
/** Internal Browser transport: same restricted DTO; fixed configured loopback origin. */
export function createBrowserTransport(origin:string):InventoryTransport {
  const url=new URL(origin);
  if(url.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.port!=='56321' || url.origin!==origin)throw new InventoryError('ENVIRONMENT_BLOCKED');
  return {kind:'browser-local-qa',version:1,async send(request,signal){
    validateInventoryTransportRequest(request);
    const url=new URL(request.path,origin);url.search=new URLSearchParams(request.query).toString();
    const headers:Record<string,string>={apikey:request.credentials.publicKey,'Content-Type':'application/json'};
    if(request.credentials.bearer)headers.Authorization=`Bearer ${request.credentials.bearer}`;
    else if(!request.credentials.publicKey.startsWith('sb_publishable_'))headers.Authorization=`Bearer ${request.credentials.publicKey}`;
    if(request.method==='POST' && request.path==='/rest/v1/inventory_items')headers.Prefer='return=representation';
    const response=await fetch(url.href,{method:request.method,body:request.body===null?undefined:JSON.stringify(request.body),headers,redirect:'error',credentials:'omit',cache:'no-store',signal});
    if(response.redirected || (response.url && new URL(response.url).origin!==origin))throw new InventoryError('ENVIRONMENT_BLOCKED');
    const maximum=request.path.startsWith('/auth/')?INVENTORY_TRANSPORT_LIMITS.authResponseBytes:INVENTORY_TRANSPORT_LIMITS.responseBytes;
    const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let total=0;
    try {if(reader){for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum)throw new InventoryError('RESPONSE_TOO_LARGE',undefined,request.method==='POST');chunks.push(value);}}}
    finally {if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}}
    const combined=new Uint8Array(total);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.length;}
    return {version:1,id:request.id,status:response.status,redirected:false,body:new TextDecoder().decode(combined)};
  }};
}
