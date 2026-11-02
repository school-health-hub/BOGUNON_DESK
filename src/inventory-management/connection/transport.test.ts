import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElectronInventoryConnection, createInventoryConnection } from './index';
import { createLocalQaConnection } from './localQa';
import { createBrowserTransport, INVENTORY_LOCAL_ORIGIN, INVENTORY_TRANSPORT_LIMITS, sendInventoryRequest, validateInventoryTransportRequest } from './transport';
import type { InventoryElectronTransport, InventoryTransportRequest, InventoryTransportResponse, ElectronLocalQaOptions } from './transport';
import type { InventoryLocalConnection } from './contracts';
const school='10000000-0000-4000-8000-00000000000a', other='20000000-0000-4000-8000-00000000000b';
const user='a1000000-0000-4000-8000-000000000001', item='a2000000-0000-4000-8000-000000000001', requestId='a5000000-0000-4000-8000-000000000001';
const token=(role='authenticated')=>[btoa(JSON.stringify({alg:'HS256'})),btoa(JSON.stringify({role,sub:user})),crypto.randomUUID().replace(/-/g,'')].join('.');
const publicKey='sb_publishable_synthetic';
const itemRow={school_id:school,item_id:item,item_name:'Synthetic transport',category:null,specification:null,base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:1,recommended_stock:0,minimum_stock:0,is_active:true};
const reply=(r:InventoryTransportRequest,body:unknown,status=200):InventoryTransportResponse=>({version:1,id:r.id,status,redirected:false,body:status===204?'':JSON.stringify(body)});
const loginRequest=():InventoryTransportRequest=>({version:1,id:crypto.randomUUID(),method:'POST',path:'/auth/v1/token',query:{grant_type:'password'},body:{email:'teacher-a@example.invalid',password:crypto.randomUUID()},credentials:{publicKey,bearer:null}});
let calls:InventoryTransportRequest[],role:string,expiry:number;
let override:((r:InventoryTransportRequest,signal:AbortSignal)=>Promise<InventoryTransportResponse>|InventoryTransportResponse|undefined)|undefined;
let state:{packaged:boolean;devUrl:string|undefined;optIn:string|undefined};
let clients:InventoryLocalConnection[]=[];
let transport:InventoryElectronTransport;
beforeEach(()=>{
  calls=[];role='teacher_admin';expiry=3600;override=undefined;state={packaged:false,devUrl:'http://127.0.0.1:5174/',optIn:'1'};
  vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Injected transport must never use global fetch');}));
  transport={kind:'electron-local-qa',version:1,send:vi.fn(async(r,signal)=>{
    calls.push(r);const overridden=override?.(r,signal);if(overridden)return overridden;
    if(r.path==='/auth/v1/token')return reply(r,{access_token:token(),expires_in:expiry,user:{id:user,email:r.body!.email}});
    if(r.path==='/auth/v1/logout')return reply(r,null,204);
    if(r.path==='/rest/v1/inventory_members')return reply(r,[{school_id:r.query.school_id.slice(3),user_id:user,role,is_active:true}]);
    if(r.path==='/rest/v1/inventory_items')return reply(r,[itemRow]);
    if(r.path==='/rest/v1/rpc/inventory_use_stock')return reply(r,{school_id:school,item_id:item,request_uuid:r.body!.p_request_uuid,operation:'USE',quantity_delta:-1,item_total_quantity:4,item_available_quantity:4,movements:[],processed_at:new Date().toISOString(),replayed:false,status:'applied',reactivation_required:false});
    return reply(r,[]);
  })};
});
afterEach(()=>{for(const c of clients)c.dispose();clients=[];vi.unstubAllGlobals();vi.useRealTimers();});
const options=():ElectronLocalQaOptions=>({enabled:true,host:{readExecutionState:()=>({...state})},endpoint:INVENTORY_LOCAL_ORIGIN,publishableKey:publicKey,transport});
async function create(){const c=await createElectronInventoryConnection(options());clients.push(c);return c;}
async function logged(){const c=await create();await c.login('teacher-a@example.invalid',crypto.randomUUID());await c.selectSchool(school);return c;}
describe('explicit Main-owned factory policy',()=>{
  it('starts signed out with no requests until explicit login',async()=>{expect((await create()).authState().status).toBe('signed_out');expect(calls).toHaveLength(0);});
  it('requires host capability instead of renderer boolean alone',async()=>{await expect(createElectronInventoryConnection({...options(),host:undefined} as never)).rejects.toThrow('ENVIRONMENT_BLOCKED');});
  it.each([{packaged:true},{optIn:undefined},{optIn:'0'},{devUrl:'http://127.0.0.1:56300/'},{devUrl:'http://localhost:5174/'}])('rejects host execution state %o',async(patch)=>{Object.assign(state,patch);await expect(create()).rejects.toThrow('ENVIRONMENT_BLOCKED');expect(calls).toHaveLength(0);});
  it('rejects untrusted or wrong transport version',async()=>{await expect(createElectronInventoryConnection({...options(),transport:{...transport,version:2}} as never)).rejects.toThrow('ENVIRONMENT_BLOCKED');});
  it('rechecks live host state before each operation',async()=>{const c=await logged();const count=calls.length;state.optIn='0';await expect(c.listItems()).rejects.toThrow('ENVIRONMENT_BLOCKED');expect(c.authState().status).toBe('signed_out');expect(calls).toHaveLength(count);});
  it.each(['file:///synthetic/index.html','http://127.0.0.1:5174/','https://example.invalid'])('never creates Main service inside renderer location %s',async(url)=>{vi.stubGlobal('location',new URL(url));await expect(create()).rejects.toThrow('ENVIRONMENT_BLOCKED');});
  it('rejects renderer window globals even without location',async()=>{vi.stubGlobal('window',{});await expect(create()).rejects.toThrow('ENVIRONMENT_BLOCKED');});
  it('preserves Browser file and 5174 guard, rather than adding Electron origins',()=>{for(const u of ['file:///synthetic/index.html','http://127.0.0.1:5174/']){vi.stubGlobal('location',new URL(u));expect(()=>createLocalQaConnection({endpoint:INVENTORY_LOCAL_ORIGIN,publishableKey:publicKey})).toThrow('ENVIRONMENT_BLOCKED');}});
  it('rejects injected transport in Preview and Browser factory',async()=>{for(const mode of ['preview','local-qa'] as const)await expect(createInventoryConnection(mode,options() as never)).rejects.toThrow('ENVIRONMENT_BLOCKED');expect(calls).toHaveLength(0);});
  it.each(['https://example.invalid','http://127.0.0.1:54321','http://localhost:56321'])('requires the canonical Electron endpoint %s',async(endpoint)=>{await expect(createElectronInventoryConnection({...options(),endpoint} as never)).rejects.toThrow('ENVIRONMENT_BLOCKED');});
});
describe('shared Auth/membership/RPC lifecycle over injected transport',()=>{
  it('routes login, school membership, list, RPC, authoritative refetch and logout through Main transport',async()=>{
    const c=await logged();expect((await c.listItems())[0].item_id).toBe(item);
    const m=c.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'},requestId);
    expect(await m.execute()).toMatchObject({persisted:true,refreshRequired:true});await c.listItems();await c.logout();
    expect(c.authState().status).toBe('signed_out');expect(fetch).not.toHaveBeenCalled();
    const rpc=calls.find(r=>r.path.includes('/rpc/'))!;expect(rpc.body).toEqual({p_school_id:school,p_request_uuid:requestId,p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'});
    expect(rpc.credentials.bearer).not.toBeNull();expect(Object.isFrozen(rpc.body)).toBe(true);
    expect(calls[calls.length-1]).toMatchObject({path:'/auth/v1/logout',query:{scope:'local'}});
  });
  it('keeps UUID and frozen payload on uncertain transport failure and replay',async()=>{
    const c=await logged(),input={p_item_id:item,p_quantity:'1',p_reason:'Synthetic retry'};
    const m=c.prepare('inventory_use_stock',input,requestId);input.p_quantity='99';
    override=r=>r.path.includes('/rpc/')?Promise.reject(Error('unavailable')):undefined;
    await expect(m.execute()).rejects.toMatchObject({code:'NETWORK_ERROR',outcomeUnknown:true});
    override=r=>r.path.includes('/rpc/')?reply(r,{school_id:school,item_id:item,request_uuid:requestId,operation:'USE',quantity_delta:-1,item_total_quantity:4,item_available_quantity:4,movements:[],processed_at:new Date().toISOString(),replayed:true,status:'replayed',reactivation_required:false}):undefined;
    expect((await m.execute()).data.replayed).toBe(true);const sent=calls.filter(r=>r.path.includes('/rpc/'));expect(sent[0].body).toEqual(sent[1].body);
    expect(()=>c.prepare('inventory_use_stock',{...input,p_quantity:'2'},requestId)).toThrow('IDEMPOTENCY_CONFLICT');
  });
  it('rejects late reads and prepared requests after switching school',async()=>{
    const c=await logged(),m=c.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'});
    let complete!:(r:InventoryTransportResponse)=>void;let captured!:InventoryTransportRequest;
    override=r=>r.path==='/rest/v1/inventory_items'?new Promise(resolve=>{complete=resolve;captured=r;}):undefined;
    const pending=c.listItems();const rejected=expect(pending).rejects.toMatchObject({code:'STALE_CONTEXT'});
    await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));await c.selectSchool(other);await rejected;complete(reply(captured,[itemRow]));
    await expect(m.execute()).rejects.toThrow('STALE_CONTEXT');
  });
  it('clears account requests on relogin and blocks old mutation',async()=>{const c=await logged(),m=c.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'});await c.login('instructor-a@example.invalid',crypto.randomUUID());await c.selectSchool(school);await expect(m.execute()).rejects.toThrow('STALE_CONTEXT');});
  it('expires memory session without refresh or stored recovery',async()=>{vi.useFakeTimers();expiry=1;const c=await logged();await vi.advanceTimersByTimeAsync(1001);expect(c.authState().status).toBe('expired');await expect(c.listItems()).rejects.toThrow('UNAUTHENTICATED');expect(calls.every(r=>r.query.grant_type!=='refresh_token')).toBe(true);});
  it('preserves permission denial without false success',async()=>{const c=await logged();override=r=>r.path.includes('/rpc/')?reply(r,{code:'PT403',message:'PERMISSION_DENIED'},403):undefined;await expect(c.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'}).execute()).rejects.toMatchObject({code:'PERMISSION_DENIED'});});
  it('blocks instructor purchase before request',async()=>{const c=await logged();role='instructor';await expect(c.purchaseBatches()).rejects.toThrow('PERMISSION_DENIED');expect(calls.some(r=>r.path.includes('purchase'))).toBe(false);});
  it('blocks duplicate UUID execution while a write is pending',async()=>{const c=await logged();const m=c.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'});override=r=>r.path.includes('/rpc/')?new Promise(()=>{}):undefined;const pending=m.execute();const discarded=expect(pending).rejects.toThrow('STALE_CONTEXT');await vi.waitFor(()=>expect(calls.some(r=>r.path.includes('/rpc/'))).toBe(true));await expect(m.execute()).rejects.toThrow('REQUEST_IN_FLIGHT');c.dispose();await discarded;});
});
describe('bounded structured requests, no generic IPC/URL proxy',()=>{
  it.each([{path:'https://example.invalid'}, {path:'/auth/v1/health'}, {path:'/rest/v1/rpc/unknown'}, {method:'DELETE'}, {method:'PATCH'}, {url:'http://127.0.0.1:56321'}, {channel:'p2:inventory-local-qa:status'}])('rejects unapproved shape %o',patch=>expect(()=>validateInventoryTransportRequest({...loginRequest(),...patch})).toThrow());
  it('rejects service-role public key or bearer',()=>{
    const r=loginRequest();expect(()=>validateInventoryTransportRequest({...r,credentials:{publicKey:token('service_role'),bearer:null}})).toThrow();
    expect(()=>validateInventoryTransportRequest({...r,path:'/auth/v1/logout',query:{scope:'local'},body:null,credentials:{publicKey,bearer:token('service_role')}})).toThrow();
  });
  it('rejects extra RPC fields and unknown procedures',()=>{
    const r={...loginRequest(),path:'/rest/v1/rpc/inventory_use_stock',query:{},credentials:{publicKey,bearer:token()},body:{p_school_id:school,p_request_uuid:requestId,p_item_id:item,p_quantity:'1',p_reason:'Synthetic',extra:true}};
    expect(()=>validateInventoryTransportRequest(r)).toThrow();
  });
  it('rejects payload limit before send',async()=>{const r=loginRequest();const p=sendInventoryRequest(transport,{...r,body:{email:'teacher-a@example.invalid',password:'x'.repeat(INVENTORY_TRANSPORT_LIMITS.requestBytes)}},new AbortController().signal);await expect(p).rejects.toThrow('PAYLOAD_TOO_LARGE');expect(calls).toHaveLength(0);});
  it('rejects redirect and wrong response correlation',async()=>{for(const patch of [{status:302},{redirected:true},{id:crypto.randomUUID()}]){const r=loginRequest();override=()=>({...reply(r,{}),...patch}) as InventoryTransportResponse;await expect(sendInventoryRequest(transport,r,new AbortController().signal)).rejects.toThrow('INVALID_RESPONSE');}});
  it('rejects oversized UTF-8 Auth response',async()=>{const r=loginRequest();override=()=>reply(r,'한'.repeat(INVENTORY_TRANSPORT_LIMITS.authResponseBytes));await expect(sendInventoryRequest(transport,r,new AbortController().signal)).rejects.toThrow('RESPONSE_TOO_LARGE');});
  it('times out even if IPC ignores cancellation; no false login success',async()=>{vi.useFakeTimers();override=()=>new Promise(()=>{});const c=await create();const p=c.login('teacher-a@example.invalid',crypto.randomUUID());const checked=expect(p).rejects.toMatchObject({code:'TRANSPORT_TIMEOUT',outcomeUnknown:true});await vi.advanceTimersByTimeAsync(INVENTORY_TRANSPORT_LIMITS.timeoutMs+1);await checked;expect(c.authState().status).toBe('signed_out');});
  it('never exposes arbitrary origins even through direct Browser transport construction',()=>expect(()=>createBrowserTransport('https://example.invalid')).toThrow('ENVIRONMENT_BLOCKED'));
});

describe('additional fail-closed response and host lifecycle boundaries',()=>{
  it('rejects service-role Auth result before publishing authenticated state',async()=>{
    const c=await create();override=r=>r.path==='/auth/v1/token'?reply(r,{access_token:token('service_role'),expires_in:3600,user:{id:user,email:'teacher-a@example.invalid'}}):undefined;
    await expect(c.login('teacher-a@example.invalid',crypto.randomUUID())).rejects.toThrow('UNAUTHENTICATED');expect(c.authState().status).toBe('signed_out');
  });
  it('rechecks host capability after transport finishes',async()=>{
    const c=await logged();override=r=>r.path==='/rest/v1/inventory_items'?(state.optIn='0',reply(r,[itemRow])):undefined;
    await expect(c.listItems()).rejects.toThrow('ENVIRONMENT_BLOCKED');expect(c.authState().status).toBe('signed_out');
  });
  it('bounds REST response too, rather than only Auth responses',async()=>{
    const c=await logged();override=r=>r.path==='/rest/v1/inventory_items'?reply(r,'x'.repeat(INVENTORY_TRANSPORT_LIMITS.responseBytes)):undefined;
    await expect(c.listItems()).rejects.toThrow('RESPONSE_TOO_LARGE');
  });
  it('Browser transport stops streamed response and refuses redirect',async()=>{
    const r=loginRequest(),wire=createBrowserTransport(INVENTORY_LOCAL_ORIGIN);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('x'.repeat(INVENTORY_TRANSPORT_LIMITS.authResponseBytes+1)));
    await expect(sendInventoryRequest(wire,r,new AbortController().signal)).rejects.toThrow('RESPONSE_TOO_LARGE');
    const redirect=new Response('{}');Object.defineProperty(redirect,'redirected',{value:true});vi.mocked(fetch).mockResolvedValueOnce(redirect);
    await expect(sendInventoryRequest(wire,r,new AbortController().signal)).rejects.toThrow('ENVIRONMENT_BLOCKED');
  });
});

it('does not send or leave a rejected promise when already cancelled',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(sendInventoryRequest(transport,loginRequest(),controller.signal)).rejects.toThrow('STALE_CONTEXT');expect(calls).toHaveLength(0);
});

it('Electron QA remains disabled without explicit complete opt-in',async()=>{
  await expect(createElectronInventoryConnection(undefined as never)).rejects.toThrow('ENVIRONMENT_BLOCKED');
  await expect(createElectronInventoryConnection({...options(),enabled:false} as never)).rejects.toThrow('ENVIRONMENT_BLOCKED');expect(calls).toHaveLength(0);
});

it('keeps write outcome unknown if host capability is revoked after server response',async()=>{
  const c=await logged();override=r=>r.path.includes('/rpc/')?(state.optIn='0',reply(r,{})):undefined;
  await expect(c.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic uncertain'}).execute()).rejects.toMatchObject({code:'ENVIRONMENT_BLOCKED',outcomeUnknown:true});
  expect(c.authState().status).toBe('signed_out');
});
