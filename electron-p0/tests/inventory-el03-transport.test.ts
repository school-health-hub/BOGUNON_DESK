import {EventEmitter} from 'node:events';
import {afterEach,expect,it,vi} from 'vitest';
const wire=vi.hoisted(()=>({request:vi.fn()}));vi.mock('node:http',()=>({request:wire.request}));
import {inventoryMainTransport} from '../main/inventory-qa-transport';
import type {InventoryTransportRequest} from '../main/inventory-connection/transport';
const login=():InventoryTransportRequest=>({version:1,id:crypto.randomUUID(),method:'POST',path:'/auth/v1/token',query:{grant_type:'password'},body:{email:'synthetic@example.invalid',password:crypto.randomUUID()},credentials:{publicKey:'sb_publishable_synthetic',bearer:null}});
function setup(code=200){let callback!:(r:any)=>void;const res=Object.assign(new EventEmitter(),{statusCode:code});const req=Object.assign(new EventEmitter(),{destroy:vi.fn(),end:vi.fn(()=>queueMicrotask(()=>callback(res)))});wire.request.mockImplementation((_options,cb)=>{callback=cb;return req});return {req,res};}
afterEach(()=>{vi.clearAllMocks();vi.useRealTimers();});
it('uses a literal loopback GET/POST destination and sanitized fixed headers without a proxy or renderer URL',async()=>{
 const {req,res}=setup();const input=login();const pending=inventoryMainTransport.send(input,new AbortController().signal);await Promise.resolve();res.emit('data',Buffer.from('{}'));res.emit('end');expect(await pending).toEqual({version:1,id:input.id,status:200,redirected:false,body:'{}'});expect(wire.request.mock.calls[0][0]).toMatchObject({hostname:'127.0.0.1',port:56321,agent:false,path:'/auth/v1/token?grant_type=password',method:'POST'});expect(wire.request.mock.calls[0][0].headers.Authorization).toBeUndefined();expect(req.end).toHaveBeenCalledWith(JSON.stringify(input.body));expect(req.destroy).toHaveBeenCalled();
});
it.each([{url:'https://example.invalid'},{path:'https://example.invalid'},{path:'/auth/v1/signup'},{method:'DELETE'},{query:{grant_type:'password',url:'https://example.invalid'}},{credentials:{publicKey:'sb_secret_synthetic',bearer:null}}])('blocks invalid endpoint, path, method, keys and extra fields %#',async patch=>{
 await expect(inventoryMainTransport.send({...login(),...patch} as InventoryTransportRequest,new AbortController().signal)).rejects.toBeDefined();expect(wire.request).not.toHaveBeenCalled();
});
it('rejects a serialized request above 64KiB before opening a socket',async()=>{
 const input={...login(),body:{email:'a'.repeat(65536)+'@example.invalid',password:'synthetic'}};await expect(inventoryMainTransport.send(input,new AbortController().signal)).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});expect(wire.request).not.toHaveBeenCalled();
});
it('caps Auth at 32KiB, destroys its socket and never returns a partial body',async()=>{
 const {req,res}=setup();const pending=inventoryMainTransport.send(login(),new AbortController().signal);const assertion=expect(pending).rejects.toMatchObject({code:'RESPONSE_TOO_LARGE',outcomeUnknown:true});await Promise.resolve();res.emit('data',Buffer.alloc(32769));await assertion;expect(req.destroy).toHaveBeenCalled();
});
it('caps REST at 2MiB using streamed bytes rather than Content-Length',async()=>{
 const input:InventoryTransportRequest={...login(),method:'GET',path:'/rest/v1/inventory_items',body:null,query:{select:'*',school_id:'eq.10000000-0000-4000-8000-000000000001',order:'item_id.asc',limit:'500',offset:'0'},credentials:{publicKey:'sb_publishable_synthetic',bearer:`e30.${Buffer.from('{"role":"authenticated"}').toString('base64url')}.synthetic`}};
 const {res,req}=setup();const pending=inventoryMainTransport.send(input,new AbortController().signal);const assertion=expect(pending).rejects.toMatchObject({code:'RESPONSE_TOO_LARGE',outcomeUnknown:false});await Promise.resolve();res.emit('data',Buffer.alloc(2*1024*1024));res.emit('data',Buffer.alloc(1));await assertion;expect(req.destroy).toHaveBeenCalled();
});
it('enforces a 15s total timeout during a partial response and cleans up',async()=>{
 vi.useFakeTimers();const {req,res}=setup();const pending=inventoryMainTransport.send(login(),new AbortController().signal);const assertion=expect(pending).rejects.toMatchObject({code:'TRANSPORT_TIMEOUT',outcomeUnknown:true});await vi.advanceTimersByTimeAsync(1);res.emit('data',Buffer.from('{'));await vi.advanceTimersByTimeAsync(14999);await assertion;expect(req.destroy).toHaveBeenCalled();res.emit('end');
});
it.each([301,302,307,308])('refuses redirect %s without a second request',async code=>{
 const {req}=setup(code);await expect(inventoryMainTransport.send(login(),new AbortController().signal)).rejects.toMatchObject({code:'ENVIRONMENT_BLOCKED'});expect(wire.request).toHaveBeenCalledTimes(1);expect(req.destroy).toHaveBeenCalled();
});
it('destroys a request on Abort and ignores late response bytes',async()=>{
 const {req,res}=setup();const controller=new AbortController(),pending=inventoryMainTransport.send(login(),controller.signal);const assertion=expect(pending).rejects.toMatchObject({code:'STALE_CONTEXT',outcomeUnknown:true});await Promise.resolve();controller.abort();await assertion;res.emit('data',Buffer.from('late'));res.emit('end');expect(req.destroy).toHaveBeenCalled();
});
it('rejects already aborted requests and invalid UTF-8 without leaking body data',async()=>{
 const controller=new AbortController();controller.abort();await expect(inventoryMainTransport.send(login(),controller.signal)).rejects.toMatchObject({code:'STALE_CONTEXT'});expect(wire.request).not.toHaveBeenCalled();const {res}=setup();const pending=inventoryMainTransport.send(login(),new AbortController().signal);const assertion=expect(pending).rejects.toMatchObject({code:'INVALID_RESPONSE'});await Promise.resolve();res.emit('data',Buffer.from([255]));res.emit('end');await assertion;
});
