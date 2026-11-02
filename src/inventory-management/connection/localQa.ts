import {
  InventoryError, type AuthState, type InventoryLocalConnection, type Item, type ItemDetail, type Lot, type Movement,
  type NewItem, type PreparedMutation, type PurchaseBatch, type PurchaseProgress, type Role, type RpcInputs, type RpcName,
} from './contracts.js';
import { createBrowserTransport, sendInventoryRequest, validatePublicKey, validateUserBearer, INVENTORY_LOCAL_ORIGIN } from './transport.js';
import type { InventoryTransport, InventoryTransportRequest, InventoryApiPath, ElectronLocalQaOptions } from './transport.js';
import { decodeRpc } from './responses.js';
import { date, decimal, exact, integer, normalizeNumbers, record, text, timestamp, uuid, validateRpc, validateNewItem } from './validation.js';

export interface LocalQaConfig { endpoint: string; publishableKey: string }
export function validateLocalEndpoint(endpoint: string): string {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new InventoryError('ENVIRONMENT_BLOCKED'); }
  if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.port !== '56321'
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new InventoryError('ENVIRONMENT_BLOCKED');
  return url.origin;
}
function environment(): void {
  if (!import.meta.env.DEV || import.meta.env.PROD) throw new InventoryError('ENVIRONMENT_BLOCKED');
  // Browser Local QA is served only on the committed Inventory QA UI origin.
  if (typeof location !== 'undefined' && (location.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(location.hostname) || location.port !== '56300')) throw new InventoryError('ENVIRONMENT_BLOCKED');
}
const safeServerCode = (value: unknown): string | undefined => typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value) ? value : undefined;
const orders: Record<string,string> = {
  inventory_members:'user_id', inventory_items:'item_id', inventory_stock_lots:'lot_id', inventory_stock_movements:'movement_id',
  inventory_purchase_batches:'batch_id', inventory_purchase_lines:'line_id', inventory_purchase_receipts:'receipt_id', inventory_purchase_receipt_lines:'receipt_line_id',
};
const batchStatuses = ['DRAFT','APPROVED','ORDERED','AWAITING_RECEIPT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'];
function validRows(table: string, rows: unknown[], school: string): Record<string,unknown>[] {
  try { return rows.map(value=>{
    const r=record(normalizeNumbers(value));
    if(r.school_id !== school) throw new InventoryError('INVALID_RESPONSE');
    uuid(r[orders[table]]);
    if(table==='inventory_members') {
      if(!['teacher_admin','instructor'].includes(String(r.role)) || typeof r.is_active !== 'boolean') throw new InventoryError('INVALID_RESPONSE');
    } else {
      for(const k of ['item_id','batch_id','lot_id','receipt_id','line_id','actor_user_id']) if(k in r) uuid(r[k]);
      for(const [k,v] of Object.entries(r)) {
        if(/quantity|stock/.test(k) && !/purchase_quantity/.test(k)) {
          if(k==='quantity_delta' && typeof v==='string' && /^-?[0-9]+$/.test(v)) continue;
          integer(v);
        }
      }
      if(table==='inventory_items') { integer(r.recommended_stock); integer(r.minimum_stock); if(r.category!==null && typeof r.category!=='string')throw new InventoryError('INVALID_RESPONSE'); if(r.specification!==null && typeof r.specification!=='string')throw new InventoryError('INVALID_RESPONSE'); text(r.item_name); text(r.base_unit); text(r.purchase_unit); decimal(r.base_units_per_purchase_unit,true); if(typeof r.is_active!=='boolean') throw new InventoryError('INVALID_RESPONSE'); }
      if(table==='inventory_stock_movements') { text(r.reason); timestamp(r.created_at); integer(r.quantity_before); integer(r.quantity_after); if(!['INITIAL_BALANCE','RECEIVE','USE','DISPOSE','ADJUST','REVERSAL'].includes(String(r.movement_type))) throw new InventoryError('INVALID_RESPONSE'); }
      if(table==='inventory_stock_lots') { timestamp(r.received_at); integer(r.remaining_quantity); integer(r.initial_quantity); date(r.expires_on,true); if(!['available','quarantined','unavailable','depleted'].includes(String(r.status))) throw new InventoryError('INVALID_RESPONSE'); }
      if(table==='inventory_purchase_batches' && (!batchStatuses.includes(String(r.status)) || (r.note!==null && typeof r.note!=='string'))) throw new InventoryError('INVALID_RESPONSE');
      if(table==='inventory_purchase_lines') {
        for(const k of ['line_id','batch_id','item_id']) uuid(r[k]);
        text(r.candidate_id,false,100); text(r.base_unit); text(r.purchase_unit);
        decimal(r.requested_purchase_quantity,true); decimal(r.base_units_per_purchase_unit,true);
        integer(r.requested_base_quantity,true); integer(r.received_base_quantity);
        if(BigInt(String(r.received_base_quantity))>BigInt(String(r.requested_base_quantity)))throw new InventoryError('INVALID_RESPONSE');
        if(r.expected_unit_price!==null)decimal(r.expected_unit_price,false,2);
        if(r.currency!==null && (typeof r.currency!=='string' || !/^[A-Z]{3}$/.test(r.currency)))throw new InventoryError('INVALID_RESPONSE');
      }
      if(table==='inventory_purchase_receipts') { uuid(r.batch_id);timestamp(r.received_at);text(r.reason); }
      if(table==='inventory_purchase_receipt_lines') { for(const k of ['batch_id','receipt_id','line_id'])uuid(r[k]);integer(r.received_base_quantity,true);decimal(r.received_purchase_quantity,true); }
    }
    return r;
  }); } catch { throw new InventoryError('INVALID_RESPONSE'); }
}
function seoulDate(): string {
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}-${p.find(x=>x.type==='day')!.value}`;
}

/** Dedicated memory-only Auth + PostgREST client. No operational singleton or storage. */
class LocalConnection implements InventoryLocalConnection {
  readonly mode = 'local-qa' as const;
  #state: AuthState = { status:'signed_out' };
  #token: string | null = null;
  #expiry = 0;
  #epoch = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #controllers = new Set<AbortController>();
  #listeners = new Set<(s:AuthState)=>void>();
  #invalidators = new Set<()=>void>();
  #requests = new Map<string,{payload:string; pending:boolean}>();
  #registering = false;
  #endpoint: string;
  #key: string;
  #transport: InventoryTransport;
  #checkEnvironment:()=>void;
  constructor(config: LocalQaConfig, electron?:ElectronLocalQaOptions) {
    this.#checkEnvironment=electron?()=>electronEnvironment(electron):environment;
    this.#checkEnvironment();
    if(!electron)exact(record(config),['endpoint','publishableKey']);
    this.#endpoint=validateLocalEndpoint(config.endpoint);validatePublicKey(config.publishableKey);this.#key=config.publishableKey;
    this.#transport=electron?.transport ?? createBrowserTransport(this.#endpoint);
  }
  authState(): AuthState { this.#checkExpiry(); return {...this.#state}; }
  subscribe(fn:(s:AuthState)=>void):()=>void { this.#listeners.add(fn); return ()=>{this.#listeners.delete(fn);}; }
  onInvalidate(fn:()=>void):()=>void { this.#invalidators.add(fn); return ()=>{this.#invalidators.delete(fn);}; }
  #invalidate():void { for(const fn of this.#invalidators) { try { fn(); } catch { /* Listener cannot alter connection integrity. */ } } }
  #transition(state:AuthState, clearToken = false):void {
    this.#epoch++; for(const c of this.#controllers) c.abort(); this.#controllers.clear(); this.#requests.clear(); this.#registering=false;
    if(clearToken) { this.#token=null; this.#expiry=0; clearTimeout(this.#timer); }
    this.#state=state; this.#invalidate();
    for(const fn of this.#listeners) { try { fn({...state}); } catch { /* No auth data in diagnostics. */ } }
  }
  #checkExpiry():void { if(this.#token && Date.now()>=this.#expiry) this.#transition({status:'expired'},true); }
  #alive():void {
    try {this.#checkEnvironment();validateLocalEndpoint(this.#endpoint);}catch(error){
      if(this.#state.status!=='signed_out' && this.#state.status!=='disposed')this.#transition({status:'signed_out'},true);
      throw error;
    } if(this.#state.status==='disposed') throw new InventoryError('DISPOSED'); this.#checkExpiry(); }
  #context():{epoch:number; userId:string; schoolId:string} {
    this.#alive(); const s=this.#state;
    if(s.status!=='authenticated' || !this.#token) throw new InventoryError('UNAUTHENTICATED');
    if(!s.schoolId) throw new InventoryError('PERMISSION_DENIED');
    return {epoch:this.#epoch,userId:s.userId,schoolId:s.schoolId};
  }
  async #http(path:string, init:RequestInit={}, authenticated=true):Promise<unknown> {
    this.#alive();
    if(authenticated && !this.#token) throw new InventoryError('UNAUTHENTICATED');
    const epoch=this.#epoch; const controller=new AbortController(); this.#controllers.add(controller);
    const url=new URL(path,this.#endpoint);
    if(url.origin!==this.#endpoint || !/^\/(auth\/v1\/(token|logout)|rest\/v1\/inventory_|rest\/v1\/rpc\/inventory_)/.test(url.pathname)) throw new InventoryError('ENVIRONMENT_BLOCKED');
    let delivered=false;
    try {
      const bearer=authenticated?this.#token:(init.headers as Record<string,string>|undefined)?.Authorization?.replace(/^Bearer /,'') ?? null;
      const request:InventoryTransportRequest={version:1,id:crypto.randomUUID(),method:(init.method??'GET') as 'GET'|'POST',path:url.pathname as InventoryApiPath,
        query:Object.fromEntries(url.searchParams),body:init.body?JSON.parse(String(init.body)):null,credentials:{publicKey:this.#key,bearer}};
      const response=await sendInventoryRequest(this.#transport,request,controller.signal);
      delivered=true;this.#alive();if(epoch!==this.#epoch)throw new InventoryError('STALE_CONTEXT',undefined,init.method==='POST');
      let body:unknown;
      try {body=response.status===204?null:JSON.parse(response.body);}catch{throw new InventoryError('INVALID_RESPONSE',undefined,init.method==='POST');}
      if(epoch!==this.#epoch)throw new InventoryError('STALE_CONTEXT',undefined,init.method==='POST');
      if(response.status<200 || response.status>=300) {
        const e=body && typeof body==='object' ? body as Record<string,unknown> : {};
        const sql=typeof e.code==='string' ? e.code : '';
        const code=safeServerCode(e.message) ?? safeServerCode(e.code);
        if(response.status===401 || sql==='PT401' || sql==='PGRST301' || sql==='PGRST303') {
          this.#transition({status:'expired'},true); throw new InventoryError('UNAUTHENTICATED',code);
        }
        if(response.status===403 || sql==='42501' || sql==='PT403') throw new InventoryError('PERMISSION_DENIED',code);
        if(response.status===404 || sql==='PT404') throw new InventoryError('NOT_FOUND',code);
        if(response.status===409 || sql==='PT409') throw new InventoryError(code==='IDEMPOTENCY_CONFLICT'?'IDEMPOTENCY_CONFLICT':'CONFLICT',code);
        throw new InventoryError('SERVER_REJECTED',code);
      }
      return body;
    } catch(e) {
      if(e instanceof InventoryError) {
        if(delivered && init.method==='POST' && e.code==='ENVIRONMENT_BLOCKED')throw new InventoryError(e.code,e.serverCode,true);
        throw e;
      }
      if(epoch!==this.#epoch) throw new InventoryError('STALE_CONTEXT',undefined,init.method==='POST');
      throw new InventoryError('NETWORK_ERROR',undefined,init.method==='POST');
    } finally { this.#controllers.delete(controller); }
  }
  async login(email:string,password:string):Promise<void> {
    this.#alive();
    if(this.#state.status==='signing_in') throw new InventoryError('REQUEST_IN_FLIGHT');
    // Only reserved fixture identities. No signup, OAuth, magic links or production accounts.
    if(!/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(email) || !password || password.length>4096) throw new InventoryError('INVALID_INPUT');
    // Invalidate old principal and all pending views before the first network request.
    this.#transition({status:'signing_in'},true); const epoch=this.#epoch;
    try {
      const r=record(await this.#http('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})},false));
      const user=record(r.user); uuid(user.id);
      if(typeof user.email!=='string' || user.email.toLowerCase()!==email.toLowerCase() || typeof r.access_token!=='string' || typeof r.expires_in!=='number' || r.expires_in<=0 || !Number.isFinite(r.expires_in)) throw new InventoryError('INVALID_RESPONSE');
      validateUserBearer(r.access_token);
      this.#token=r.access_token; this.#expiry=Date.now()+Math.min(r.expires_in,86400)*1000;
      this.#transition({status:'authenticated',userId:user.id,schoolId:null});
      this.#timer=setTimeout(()=>this.#checkExpiry(),Math.min(r.expires_in,86400)*1000);
    } catch(e) { if(this.#epoch===epoch) this.#transition({status:'signed_out'},true); throw e; }
  }
  async logout():Promise<void> {
    this.#alive(); const token=this.#token;
    // Revoke only this local session; clear memory even when the gateway is unavailable.
    this.#transition({status:'signed_out'},true);
    if(token) await this.#http('/auth/v1/logout?scope=local',{method:'POST',headers:{Authorization:`Bearer ${token}`}},false);
  }
  async selectSchool(schoolId:string):Promise<void> {
    uuid(schoolId); this.#alive(); const s=this.#state;
    if(s.status!=='authenticated') throw new InventoryError('UNAUTHENTICATED');
    this.#transition({status:'authenticated',userId:s.userId,schoolId:null});
    const epoch=this.#epoch;
    await this.#membership(schoolId,s.userId);
    if(epoch!==this.#epoch) throw new InventoryError('STALE_CONTEXT');
    this.#transition({status:'authenticated',userId:s.userId,schoolId});
  }
  #assert(epoch:number, mutation=false):void { this.#checkExpiry(); if(epoch!==this.#epoch) throw new InventoryError('STALE_CONTEXT',undefined,mutation); }
  async #rows(table:string,school:string,filters:Record<string,string>={}):Promise<Record<string,unknown>[]> {
    const epoch=this.#epoch;
    const rows:Record<string,unknown>[]=[];
    // Explicit pages avoid the gateway's 1000-row cap silently corrupting totals.
    for(let offset=0;offset<100000;offset+=500) {
      const q=new URLSearchParams({select:'*',school_id:`eq.${school}`,order:`${orders[table]}.asc`,limit:'500',offset:String(offset),...filters});
      const page=await this.#http(`/rest/v1/${table}?${q}`);
      if(!Array.isArray(page)) throw new InventoryError('INVALID_RESPONSE');
      this.#assert(epoch);
      rows.push(...validRows(table,page,school));
      if(page.length<500) return rows;
    }
    throw new InventoryError('INVALID_RESPONSE');
  }
  async #membership(school:string,user:string):Promise<Role> {
    const rows=await this.#rows('inventory_members',school,{user_id:`eq.${user}`,is_active:'eq.true'});
    if(rows.length!==1 || rows[0].user_id!==user || rows[0].is_active!==true) throw new InventoryError('PERMISSION_DENIED');
    return rows[0].role as Role;
  }
  async #authorized(admin=false):Promise<{epoch:number; userId:string; schoolId:string}> {
    const c=this.#context(); const role=await this.#membership(c.schoolId,c.userId);
    if(c.epoch!==this.#epoch) throw new InventoryError('STALE_CONTEXT');
    if(admin && role!=='teacher_admin') throw new InventoryError('PERMISSION_DENIED');
    return c;
  }
  async listItems():Promise<Item[]> {
    const c=await this.#authorized(); this.#assert(c.epoch);
    const rows=await this.#rows('inventory_items',c.schoolId); this.#assert(c.epoch); return rows as unknown as Item[];
  }
  async itemDetail(itemId:string):Promise<ItemDetail> {
    uuid(itemId); const c=await this.#authorized(); this.#assert(c.epoch);
    const items=await this.#rows('inventory_items',c.schoolId,{item_id:`eq.${itemId}`});
    this.#assert(c.epoch);
    if(items.length!==1) throw new InventoryError('NOT_FOUND');
    const lots=await this.#rows('inventory_stock_lots',c.schoolId,{item_id:`eq.${itemId}`}) as unknown as Lot[];
    this.#assert(c.epoch);
    const today=seoulDate(); let total=0n, available=0n;
    for(const lot of lots) { const n=BigInt(lot.remaining_quantity); total+=n; if(lot.status==='available' && (!lot.expires_on || lot.expires_on>=today)) available+=n; }
    return {item:items[0] as unknown as Item,lots,totals:{totalQuantity:String(total),availableQuantity:String(available),referenceDate:today,source:'rls-visible-lots'}};
  }
  async movements(itemId?:string):Promise<Movement[]> {
    if(itemId!==undefined) uuid(itemId); const c=await this.#authorized(); this.#assert(c.epoch);
    const rows=await this.#rows('inventory_stock_movements',c.schoolId,itemId?{item_id:`eq.${itemId}`}:{ }); this.#assert(c.epoch); return rows as unknown as Movement[];
  }
  async purchaseBatches():Promise<PurchaseBatch[]> {
    const c=await this.#authorized(true); this.#assert(c.epoch); const rows=await this.#rows('inventory_purchase_batches',c.schoolId); this.#assert(c.epoch); return rows as unknown as PurchaseBatch[];
  }
  async purchaseProgress(batchId:string):Promise<PurchaseProgress> {
    uuid(batchId); const c=await this.#authorized(true); this.#assert(c.epoch); const f={batch_id:`eq.${batchId}`};
    const [b,lines,receipts,receiptLines]=await Promise.all(['inventory_purchase_batches','inventory_purchase_lines','inventory_purchase_receipts','inventory_purchase_receipt_lines'].map(t=>this.#rows(t,c.schoolId,f)));
    this.#assert(c.epoch);
    if(b.length!==1) throw new InventoryError('NOT_FOUND');
    return {batch:b[0],lines,receipts,receiptLines} as unknown as PurchaseProgress;
  }
  prepare<N extends RpcName>(name:N,input:RpcInputs[N],requestUuid=crypto.randomUUID()):PreparedMutation<N> {
    const c=this.#context(); uuid(requestUuid); validateRpc(name,input);
    const payload=JSON.stringify({p_school_id:c.schoolId,p_request_uuid:requestUuid,...input});
    const key=`${name}:${requestUuid}`;
    const existing=this.#requests.get(key);
    if(existing && existing.payload!==payload) throw new InventoryError('IDEMPOTENCY_CONFLICT');
    if(!existing) this.#requests.set(key,{payload,pending:false});
    return Object.freeze({requestUuid,execute:async()=>{
      this.#assert(c.epoch);
      if(c.epoch!==this.#context().epoch) throw new InventoryError('STALE_CONTEXT');
      const entry=this.#requests.get(key)!;
      if(entry.pending) throw new InventoryError('REQUEST_IN_FLIGHT');
      entry.pending=true;
      try {
        await this.#authorized(name!=='inventory_use_stock'); this.#assert(c.epoch);
        const raw=decodeRpc(name,await this.#http(`/rest/v1/rpc/${name}`,{method:'POST',body:payload}),c.schoolId,requestUuid,JSON.parse(payload));
        this.#assert(c.epoch,true); this.#invalidate(); this.#assert(c.epoch,true);
        return {persisted:true as const,data:raw,refreshRequired:true as const};
      } finally { entry.pending=false; }
    }});
  }
  async registerItem(input:NewItem):Promise<{persisted:true;item:Item;refreshRequired:true}> {
    validateNewItem(input);
    const c=this.#context(); if(this.#registering) throw new InventoryError('REQUEST_IN_FLIGHT'); this.#registering=true;
    const payload=JSON.stringify({...input,school_id:c.schoolId});
    try {
      await this.#authorized(true); this.#assert(c.epoch);
      const raw=await this.#http('/rest/v1/inventory_items',{method:'POST',body:payload,headers:{Prefer:'return=representation'}});
      if(!Array.isArray(raw) || raw.length!==1) throw new InventoryError('INVALID_RESPONSE',undefined,true);
      const item=validRows('inventory_items',raw,c.schoolId)[0] as unknown as Item;
      this.#assert(c.epoch,true); this.#invalidate(); this.#assert(c.epoch,true); return {persisted:true,item,refreshRequired:true};
    } catch(error) {
      if(error instanceof InventoryError && error.code==='INVALID_RESPONSE')throw new InventoryError('INVALID_RESPONSE',undefined,true);
      throw error;
    } finally { if(c.epoch===this.#epoch) this.#registering=false; }
  }
  dispose():void { this.#transition({status:'disposed'},true); this.#listeners.clear(); this.#invalidators.clear(); this.#key=''; }
}
export const createLocalQaConnection = (config:LocalQaConfig):InventoryLocalConnection => new LocalConnection(config);

function electronEnvironment(options:ElectronLocalQaOptions):void {
  if(!options || typeof options!=='object')throw new InventoryError('ENVIRONMENT_BLOCKED');
  const nodeEnvironment=(globalThis as {process?:{env?:{NODE_ENV?:string}}}).process?.env?.NODE_ENV;
  if(import.meta.env?.PROD || nodeEnvironment==='production' || 'window' in globalThis || 'document' in globalThis || 'location' in globalThis
    || options.enabled!==true || options.endpoint!==INVENTORY_LOCAL_ORIGIN
    || typeof options.host?.readExecutionState!=='function'
    || options.transport?.kind!=='electron-local-qa' || options.transport.version!==1 || typeof options.transport.send!=='function')throw new InventoryError('ENVIRONMENT_BLOCKED');
  // Main supplies a closure over real app/config state. No renderer-supplied boolean authority.
  let state;
  try {state=options.host.readExecutionState();}catch{throw new InventoryError('ENVIRONMENT_BLOCKED');}
  if(!state || typeof state!=='object' || state.packaged!==false || state.devUrl!=='http://127.0.0.1:5174/' || state.optIn!=='1')throw new InventoryError('ENVIRONMENT_BLOCKED');
}
export function createElectronLocalQaConnection(options:ElectronLocalQaOptions):InventoryLocalConnection {
  electronEnvironment(options);exact(record(options),['enabled','host','endpoint','publishableKey','transport']);
  return new LocalConnection({endpoint:options.endpoint,publishableKey:options.publishableKey},options);
}
