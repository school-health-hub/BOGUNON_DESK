import type{SchoolBridge,SchoolState}from'../../school02/core/types.js';import type{TaskBridge}from'../core/types.js';
export function localBridges(fixture:()=>number){let csrf='';
 const request=async(path:string,action:string,input:Record<string,unknown>)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-WS-CSRF':csrf},credentials:'same-origin',cache:'no-store',body:JSON.stringify({action,input})});if(r.status===401){csrf='';return path.endsWith('/tasks')?{phase:'denied',status:'',sort:'DUE',scope:'ALL',archives:false,notice:'로그인 시간이 만료되었습니다.',notice_kind:'error'}:{workspace:{phase:'expired_session'},directory:[],self:{memberships:[],space_requests:[]},transfers:[]};}if(!r.ok)throw Error('unavailable');const v=await r.json();if(typeof v.csrf==='string')csrf=v.csrf;return v.state;};
 const school:SchoolBridge={async command(a,i={}){const s=await request('/api/school03/school',a,a==='login'?{fixture:fixture()}:i)as SchoolState;if(a==='logout')csrf='';return s;}};
 const tasks:TaskBridge={command:(a,i={})=>request('/api/school03/tasks',a,i)};return{school,tasks};
}
