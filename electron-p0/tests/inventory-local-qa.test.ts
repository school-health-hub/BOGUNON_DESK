import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
const transport=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('node:http',()=>({request:transport.request}));
import {createInventoryQaStatusHandler,inventoryQaAllowed,probeInventoryQa,INVENTORY_QA_HEALTH} from '../main/inventory-local-qa';
const frame={},wc={mainFrame:frame,getURL:()=> 'http://127.0.0.1:5174/'},event={sender:wc,senderFrame:frame};
const config={packaged:false,devUrl:wc.getURL(),optIn:'1'};
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
it.each([{...config,packaged:true},{...config,optIn:undefined},{...config,devUrl:'file:///app'},{...config,devUrl:'http://localhost:5174/'},{...config,devUrl:'http://127.0.0.1:56300/'}])('fails closed outside the opted-in Electron development context %#',async blocked=>{
 expect(inventoryQaAllowed(blocked)).toBe(false);const probe=vi.fn();const h=createInventoryQaStatusHandler(wc,wc.getURL(),blocked,probe);expect(await h(event)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(probe).not.toHaveBeenCalled();
});
it('rejects forged callers and every endpoint/payload argument without a request',async()=>{
 const probe=vi.fn(),h=createInventoryQaStatusHandler(wc,wc.getURL(),config,probe);
 expect(await h({sender:{},senderFrame:frame})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(await h({sender:wc,senderFrame:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 for(const value of ['https://example.invalid',INVENTORY_QA_HEALTH,{endpoint:INVENTORY_QA_HEALTH},null])expect(await h(event,value)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(probe).not.toHaveBeenCalled();
});
it('does not report DB/authentication/RPC success from a reachable gateway',async()=>{
 const h=createInventoryQaStatusHandler(wc,wc.getURL(),config,async()=>true);expect(await h(event)).toEqual({ok:true,data:{mode:'local-qa',authGateway:'reachable',inventoryConnection:'blocked',persisted:false}});
});
it('rejects overlapping probes and rechecks sender after await',async()=>{
 let finish!:(v:boolean)=>void;const probe=vi.fn(()=>new Promise<boolean>(r=>{finish=r;}));const h=createInventoryQaStatusHandler(wc,wc.getURL(),config,probe);const first=h(event);expect(await h(event)).toMatchObject({ok:false,error:{code:'CONFLICT'}});const spy=vi.spyOn(wc,'getURL').mockReturnValue('https://example.invalid');finish(true);expect(await first).toMatchObject({ok:false});spy.mockRestore();expect(probe).toHaveBeenCalledTimes(1);
});
function mockRequest(){const response=new EventEmitter() as EventEmitter&{statusCode:number};response.statusCode=200;const req=Object.assign(new EventEmitter(),{end:vi.fn(()=>queueMicrotask(()=>callback(response))),destroy:vi.fn()});let callback!:(r:typeof response)=>void;transport.request.mockImplementation((_url,_options,cb)=>{callback=cb;return req;});return {response,req};}
it('sends only a fixed GET, caps response size and never returns contents',async()=>{
 const {response,req}=mockRequest();const pending=probeInventoryQa();await Promise.resolve();response.emit('data',Buffer.alloc(16*1024+1));expect(await pending).toBe(false);expect(req.destroy).toHaveBeenCalled();expect(transport.request.mock.calls[0].slice(0,2)).toEqual([INVENTORY_QA_HEALTH,{method:'GET',agent:false}]);
});
it('enforces a total timeout and destroys the request',async()=>{
 vi.useFakeTimers();const {req}=mockRequest();const pending=probeInventoryQa();await vi.advanceTimersByTimeAsync(3000);expect(await pending).toBe(false);expect(req.destroy).toHaveBeenCalled();
});
it.each([200,302,401,500])('does not follow redirects or accept non-200 health responses (%s)',async code=>{
 const {response}=mockRequest();response.statusCode=code;const pending=probeInventoryQa();await Promise.resolve();response.emit('end');expect(await pending).toBe(code===200);expect(transport.request).toHaveBeenCalledTimes(1);
});
