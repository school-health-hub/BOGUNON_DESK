import { describe, it, expect } from 'vitest';
import { discoverPage } from './my-finance-cdp-discovery.mjs';
function clock() { let time=0; return { now:()=>time, delay:async ms=>{time+=ms}, timeoutMs:1000, intervalMs:500 }; }
describe('installed WebView discovery diagnostics',()=>{
 it('distinguishes connection refusal from an empty target list',async()=>{
  const {page,evidence}=await discoverPage(9223,{...clock(),fetcher:async()=>{throw Object.assign(Error(),{cause:{code:'ECONNREFUSED'}})}});
  expect(page).toBeUndefined();expect(evidence).toMatchObject({lastError:'ECONNREFUSED',listStatus:null,attempts:2});
 });
 it('records an alive browser with no page without claiming success',async()=>{
  const result=await discoverPage(9223,{...clock(),fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/list')?[]:{webSocketDebuggerUrl:'ws://127.0.0.1:9223/browser'}})});
  expect(result.page).toBeUndefined();expect(result.evidence).toMatchObject({listStatus:200,browserEndpoint:true,lastError:null});
 });
 it('waits for the real page and excludes sensitive target metadata from evidence',async()=>{
  let attempts=0;
  const result=await discoverPage(9224,{...clock(),fetcher:async url=>({ok:true,status:200,json:async()=>url.endsWith('/list')?(++attempts===1?[]:[{type:'page',title:'PRIVATE TITLE',url:'PRIVATE URL',webSocketDebuggerUrl:'ws://127.0.0.1:9224/page'}]):{}})});
  expect(result.page.webSocketDebuggerUrl).toContain('/page');expect(result.evidence.attempts).toBe(2);expect(JSON.stringify(result.evidence)).not.toContain('PRIVATE');
 });
 it('distinguishes HTTP rejection and other target types',async()=>{
  const rejected=await discoverPage(9223,{...clock(),fetcher:async()=>({ok:false,status:403})});expect(rejected.evidence.listStatus).toBe(403);expect(rejected.page).toBeUndefined();
  const other=await discoverPage(9223,{...clock(),fetcher:async()=>({ok:true,status:200,json:async()=>[{type:'service_worker',webSocketDebuggerUrl:'ws://127.0.0.1:9223/worker'}]})});expect(other.evidence.targetTypes).toEqual(['service_worker']);expect(other.page).toBeUndefined();
 });
});
