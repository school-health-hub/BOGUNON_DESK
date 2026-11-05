import type{Action,SchoolBridge,SchoolState}from'../core/types.js';
/** Browser sees a random HttpOnly handle and in-memory CSRF proof, never Auth tokens. */
export function createLocalBffBridge(fixture:()=>number):SchoolBridge{
 let csrf='';
 return{async command(action:Action,input:Record<string,unknown>={}):Promise<SchoolState>{
  const response=await fetch('/api/school02',{method:'POST',headers:{'Content-Type':'application/json','X-WS-CSRF':csrf},credentials:'same-origin',body:JSON.stringify({action,input:action==='login'?{fixture:fixture()}:input}),cache:'no-store'});
  if(response.status===401){csrf='';return{workspace:{phase:'expired_session'},directory:[],self:{memberships:[],space_requests:[]},transfers:[]};}if(!response.ok)throw Error('unavailable');const data=await response.json();if(typeof data.csrf==='string')csrf=data.csrf;if(action==='logout')csrf='';return data.state;
 }};
}
