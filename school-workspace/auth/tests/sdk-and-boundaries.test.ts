import { describe,it,expect,vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SupabaseIdentityProvider } from '../server/supabase-provider.js';
import { AUTH, APP, secret } from './fixtures.js';
describe('official supabase-js SDK wiring — REAL SDK, MOCK HTTP, NO operational network',()=>{
 it('generates official PKCE S256 challenge without a network request',async()=>{
  const transport=vi.fn<typeof fetch>(async()=>{throw Error('network must not run');});
  const p=new SupabaseIdentityProvider(AUTH,'sb_publishable_SYNTHETIC_ONLY',transport);
  const url=new URL(await p.start({flowId:'flow-sdk',redirectTo:APP+'/auth/callback?ws_flow=flow-sdk&ws_state=state'}));
  expect(url.origin).toBe(AUTH);expect(url.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');
  expect(url.searchParams.get('code_challenge')).toBeTruthy();expect(url.searchParams.get('code_verifier')).toBeNull();expect(transport).not.toHaveBeenCalled();p.forget('flow-sdk');
 });
 it('exchanges a code through official SDK with private verifier using mocked token endpoint',async()=>{
  const s=secret(),seen:{url:string;body:unknown}[]=[];
  const transport=vi.fn<typeof fetch>(async(input,init)=>{
    seen.push({url:String(input),body:init?.body});expect(init?.redirect).toBe('error');
    return new Response(JSON.stringify({access_token:s.accessToken,refresh_token:s.refreshToken,expires_in:3600,token_type:'bearer',user:{id:s.userId,aud:'authenticated',created_at:'2026-01-01T00:00:00Z'}}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  const p=new SupabaseIdentityProvider(AUTH,'sb_publishable_SYNTHETIC_ONLY',transport);
  await p.start({flowId:'flow-sdk',redirectTo:APP+'/auth/callback'});const result=await p.exchange('flow-sdk','MOCK_CODE');
  expect(result.userId).toBe(s.userId);expect(result.accessToken).toBe(s.accessToken);expect(seen).toHaveLength(1);
  expect(seen[0].url).toContain('/auth/v1/token?grant_type=pkce');const body=JSON.parse(String(seen[0].body));expect(body.auth_code).toBe('MOCK_CODE');expect(body.code_verifier).toBeTruthy();
  await expect(p.exchange('flow-sdk','MOCK_CODE')).rejects.toMatchObject({code:'FLOW_MISMATCH'});
 });
 it('offline default never falls back to global fetch on exchange',async()=>{
  const realFetch=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw Error('forbidden');});
  try {const p=new SupabaseIdentityProvider(AUTH,'sb_publishable_SYNTHETIC_ONLY');await p.start({flowId:'offline',redirectTo:APP+'/auth/callback'});
    await expect(p.exchange('offline','MOCK_CODE')).rejects.toMatchObject({code:'AUTH_SERVER_ERROR'});expect(realFetch).not.toHaveBeenCalled();
  }finally{realFetch.mockRestore();}
 });
 it('rejects private/legacy keys and malformed origin before SDK construction',()=>{
  expect(()=>new SupabaseIdentityProvider(AUTH,'sb_secret_NOT_ALLOWED')).toThrow('CONFIGURATION_ERROR');expect(()=>new SupabaseIdentityProvider('http://insecure.invalid','sb_publishable_SYNTHETIC')).toThrow('CONFIGURATION_ERROR');
 });
});
describe('static platform boundaries',()=>{
 it('common DTOs and sandbox Preload do not import server, Node crypto/fs, Tauri or token storage',async()=>{
  for(const dir of ['common','electron']) {
   const names=dir==='common'?await readdir('school-workspace/auth/common'):['preload.ts','ipc-contract.ts'];
   for(const name of names.filter(n=>n.endsWith('.ts'))) {const text=await readFile(join('school-workspace/auth',dir,name),'utf8');
    expect(text).not.toMatch(/from ['"].*(?:node:|server\/|vault|main-adapter|@tauri)/);}
  }
 });
});

describe('SCHOOL-01A seven RPCs — REAL SDK request encoding, MOCK HTTP only',()=>{
 it('uses user Authorization, publishable key, exact SQL parameter names and response DTO allowlists',async()=>{
  const {SupabaseUserRpcTransport,userScopedRpc}=await import('../server/rpc-adapter.js');
  type Contract=import('../common/rpc.js').WorkspaceRpcContracts;
  type Name=import('../common/rpc.js').WorkspaceRpcName;
  const s='10000000-0000-0000-0000-000000000001',m='20000000-0000-0000-0000-000000000001',r='30000000-0000-0000-0000-000000000001';
  const cases:{name:Name;args:Contract[Name]['args'];result:object}[]=[
   {name:'ws_v1_bootstrap',args:{},result:{actor_id:m}},
   {name:'ws_v1_get_context',args:{p_school_id:s},result:{school_id:s,role:'HEALTH_TEACHER',member_code:'M-MOCK',epoch:1,version:1,permissions:['task.read']}},
   {name:'ws_v1_request_join',args:{p_school_id:s,p_requested_role:'HEALTH_ASSISTANT',p_request_id:r},result:{join_request_id:r,membership_id:m,epoch:1}},
   {name:'ws_v1_decide_join',args:{p_school_id:s,p_join_request_id:r,p_decision:'approve',p_approved_role:'HEALTH_TEACHER',p_valid_until:null,p_expected_version:1,p_request_id:r},result:{approved:true}},
   {name:'ws_v1_set_member_role',args:{p_school_id:s,p_membership_id:m,p_new_role:'HEALTH_TEACHER',p_expected_version:1,p_request_id:r},result:{version:2}},
   {name:'ws_v1_set_membership_state',args:{p_school_id:s,p_membership_id:m,p_state:'revoked',p_expected_version:1,p_request_id:r},result:{version:2}},
   {name:'ws_v1_leave_school',args:{p_school_id:s,p_expected_version:1,p_request_id:r},result:{left:true}},
  ];
  let current=cases[0];
  const fetchMock=vi.fn<typeof fetch>(async(input,init)=>{
   expect(String(input)).toBe(AUTH+'/rest/v1/rpc/'+current.name);expect(init?.method).toBe('POST');expect(init?.redirect).toBe('error');
   expect(new Headers(init?.headers).get('authorization')).toBe('Bearer MOCK_USER_ACCESS');
   expect(new Headers(init?.headers).get('apikey')).toBe('sb_publishable_SYNTHETIC_ONLY');
   expect(JSON.parse(String(init?.body))).toEqual(current.args);
   return new Response(JSON.stringify({...current.result,refreshToken:'MUST_NOT_RETURN'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  const transport=new SupabaseUserRpcTransport(AUTH,'sb_publishable_SYNTHETIC_ONLY','MOCK',fetchMock),rpc=userScopedRpc('MOCK_USER_ACCESS',transport);
  expect(rpc.evidence).toBe('MOCK');
  for(const c of cases){current=c;const result=await rpc.call(c.name,c.args,new AbortController().signal);expect(result).toEqual(c.result);expect(JSON.stringify(result)).not.toContain('MUST_NOT_RETURN');}
  expect(fetchMock).toHaveBeenCalledTimes(7);
 });
 it('rejects secret keys, extra actor/role arguments, and already cancelled RPC requests',async()=>{
  const {SupabaseUserRpcTransport,userScopedRpc}=await import('../server/rpc-adapter.js');
  const f=vi.fn<typeof fetch>(async()=>new Response('{}'));
  const t=new SupabaseUserRpcTransport(AUTH,'sb_publishable_SYNTHETIC_ONLY','MOCK',f),rpc=userScopedRpc('MOCK_USER_ACCESS',t);
  expect(()=>userScopedRpc('sb_secret_UNACCEPTABLE',t)).toThrow('UNAUTHENTICATED');
  await expect(rpc.call('ws_v1_bootstrap',{actor_id:'forged'} as never,new AbortController().signal)).rejects.toMatchObject({code:'CONFIGURATION_ERROR'});
  const abort=new AbortController();abort.abort();await expect(rpc.call('ws_v1_bootstrap',{},abort.signal)).rejects.toMatchObject({code:'STALE_RESPONSE'});expect(f).not.toHaveBeenCalled();
 });
 it('maps server 403 to safe denial without returning SQL or token details',async()=>{
  const {SupabaseUserRpcTransport,userScopedRpc}=await import('../server/rpc-adapter.js');
  const f=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({message:'SQL context MOCK_REFRESH_PRIVATE',code:'42501'}),{status:403,headers:{'Content-Type':'application/json'}}));
  const rpc=userScopedRpc('MOCK_USER_ACCESS',new SupabaseUserRpcTransport(AUTH,'sb_publishable_SYNTHETIC_ONLY','MOCK',f));
  await expect(rpc.call('ws_v1_bootstrap',{},new AbortController().signal)).rejects.toMatchObject({message:'ACCESS_DENIED'});
 });
 it('rejects legacy service_role JWTs and synthetic markers in SERVER mode before HTTP',async()=>{
  const {SupabaseUserRpcTransport,userScopedRpc}=await import('../server/rpc-adapter.js');
  const f=vi.fn<typeof fetch>(async()=>new Response('{}'));
  const mock=new SupabaseUserRpcTransport(AUTH,'sb_publishable_SYNTHETIC_ONLY','MOCK',f);
  const legacy=['header',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'signature'].join('.');
  expect(()=>userScopedRpc(legacy,mock)).toThrow('UNAUTHENTICATED');
  const server=new SupabaseUserRpcTransport(AUTH,'sb_publishable_SYNTHETIC_ONLY','SERVER',f);
  expect(()=>userScopedRpc('MOCK_USER_ACCESS',server)).toThrow('UNAUTHENTICATED');expect(f).not.toHaveBeenCalled();
 });

});
