import{execFile}from'node:child_process';import{promisify}from'node:util';import{literal,SyntheticTokenRegistry,localDockerArgs}from'../../integration/server/local-db.js';
import{LocalSchoolDatabase}from'../../school02/server/database.js';import{TaskFault,type Contracts}from'../core/types.js';
const exec=promisify(execFile),env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'].includes(k)));
export async function sql(q:string,user='postgres',signal?:AbortSignal){const{stdout}=await exec('docker',[...localDockerArgs(),'exec','bogunon-school03-pg','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','school01a','-c',q],{env,signal,timeout:15000,maxBuffer:1048576});return stdout.trim();}
const order:Record<keyof Contracts,string[]>={ws_v1_list_tasks:['p_school_id','p_status','p_sort','p_scope','p_include_archived'],ws_v1_get_task:['p_school_id','p_task_id'],ws_v1_create_task:['p_school_id','p_title','p_description','p_priority','p_due_date','p_assignees','p_request_id'],ws_v1_edit_task:['p_school_id','p_task_id','p_title','p_description','p_priority','p_due_date','p_expected_version','p_request_id'],ws_v1_assign_task:['p_school_id','p_task_id','p_assignees','p_expected_version','p_request_id'],ws_v1_change_assigned_task_status:['p_school_id','p_task_id','p_status','p_expected_version','p_request_id'],ws_v1_close_task:['p_school_id','p_task_id','p_mode','p_expected_version','p_request_id'],ws_v1_list_task_history:['p_school_id','p_task_id']};
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const value=(v:unknown)=>typeof v==='boolean'?(v?'true':'false'):Array.isArray(v)?'ARRAY['+v.map(literal).join(',')+']::uuid[]':literal(v);
export class TaskDatabase extends LocalSchoolDatabase{
 constructor(registry:SyntheticTokenRegistry,private readonly taskExecute:typeof sql=sql){super(registry,taskExecute);}
 async task<N extends keyof Contracts>(token:string,name:N,args:Contracts[N],signal:AbortSignal):Promise<unknown>{
  if(this.offline)throw new TaskFault('NETWORK');const keys=order[name];if(!Array.isArray(keys)||keys.slice().sort().join()!==Object.keys(args).sort().join())throw new TaskFault('INPUT');
  for(const[k,v]of Object.entries(args)){
   if(k.endsWith('_id')&&!uuid(v))throw new TaskFault('INPUT');
   if(k==='p_assignees'&&(!Array.isArray(v)||v.length>10||v.some(x=>!uuid(x))))throw new TaskFault('INPUT');
   if(k==='p_expected_version'&&(!Number.isSafeInteger(v)||Number(v)<1))throw new TaskFault('INPUT');
   if(k==='p_due_date'&&v!==null&&(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)))throw new TaskFault('INPUT');
  }
  const c=this.registry.resolve(token);this.calls++;
  try{const result=JSON.parse(await this.taskExecute(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(c))};SELECT public.${name}(${keys.map(k=>value((args as unknown as Record<string,unknown>)[k])).join(',')});COMMIT;`,'school_client',signal));if(result?.error==='INPUT_REJECTED')throw new TaskFault('INPUT');return result;}
  catch(e){if(e instanceof TaskFault)throw e;if(signal.aborted)throw new TaskFault('STALE');const t=String((e as{stderr?:string}).stderr??'');if(t.includes('unauthenticated_or_revoked'))throw new TaskFault('EXPIRED');if(/conflict|idempotency_mismatch/.test(t))throw new TaskFault('CONFLICT');if(/access_denied|admin_required/.test(t))throw new TaskFault('DENIED');if(/input_rejected|invalid input/.test(t))throw new TaskFault('INPUT');throw new TaskFault('NETWORK');}
 }
}
