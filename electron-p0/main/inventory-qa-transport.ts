import {request} from 'node:http';
import {InventoryError} from './inventory-connection/contracts.js';
import {validateInventoryTransportRequest,INVENTORY_TRANSPORT_LIMITS,type InventoryElectronTransport} from './inventory-connection/transport.js';
// Private Main transport. Never accepts a renderer URL or honors HTTP_PROXY.
// Literal IPv4 address avoids DNS/proxy routing; node:http does not follow 3xx.
export const inventoryMainTransport:InventoryElectronTransport={kind:'electron-local-qa',version:1,async send(input,signal){
 validateInventoryTransportRequest(input);
 const wire=structuredClone(input);validateInventoryTransportRequest(wire);
 if(signal.aborted)throw new InventoryError('STALE_CONTEXT');
 const maximum=wire.path.startsWith('/auth/')?INVENTORY_TRANSPORT_LIMITS.authResponseBytes:INVENTORY_TRANSPORT_LIMITS.responseBytes;
 const body=wire.body===null?undefined:JSON.stringify(wire.body);
 const headers:Record<string,string>={apikey:wire.credentials.publicKey,'Content-Type':'application/json'};
 if(wire.credentials.bearer)headers.Authorization=`Bearer ${wire.credentials.bearer}`;
 else if(wire.credentials.publicKey.split('.').length===3)headers.Authorization=`Bearer ${wire.credentials.publicKey}`;
 if(wire.path==='/rest/v1/inventory_items'&&wire.method==='POST')headers.Prefer='return=representation';
 return new Promise((resolve,reject)=>{
  let settled=false,total=0;const chunks:Buffer[]=[];
  const req=request({hostname:'127.0.0.1',port:56321,path:wire.path+(Object.keys(wire.query).length?'?'+new URLSearchParams(wire.query):''),method:wire.method,headers,agent:false},response=>{
   if(!response.statusCode||response.statusCode>=300&&response.statusCode<400){finish(new InventoryError('ENVIRONMENT_BLOCKED',undefined,wire.method==='POST'));return;}
   response.on('data',(chunk:Buffer)=>{if(settled)return;total+=chunk.length;if(total>maximum){finish(new InventoryError('RESPONSE_TOO_LARGE',undefined,wire.method==='POST'));return;}chunks.push(chunk);});
   response.on('error',()=>finish(new InventoryError('NETWORK_ERROR',undefined,wire.method==='POST')));
   response.on('aborted',()=>finish(new InventoryError('NETWORK_ERROR',undefined,wire.method==='POST')));
   response.on('end',()=>{if(settled)return;try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));settled=true;cleanup();resolve({version:1,id:wire.id,status:response.statusCode!,redirected:false,body:text});}catch{finish(new InventoryError('INVALID_RESPONSE',undefined,wire.method==='POST'));}});
  });
  const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);req.destroy();};
  const finish=(error:InventoryError)=>{if(settled)return;settled=true;cleanup();reject(error);};
  const abort=()=>finish(new InventoryError('STALE_CONTEXT',undefined,wire.method==='POST'));
  const timer=setTimeout(()=>finish(new InventoryError('TRANSPORT_TIMEOUT',undefined,wire.method==='POST')),INVENTORY_TRANSPORT_LIMITS.timeoutMs);
  signal.addEventListener('abort',abort,{once:true});req.on('error',()=>finish(new InventoryError('NETWORK_ERROR',undefined,wire.method==='POST')));
  if(signal.aborted){abort();return;}req.end(body);
 });
}};
