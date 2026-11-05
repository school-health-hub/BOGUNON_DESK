/** Local synthetic adapter only. Production must supply the existing authenticated RPC transport. */
import {createActivitySession} from '../../school04/server/session.js';
import {literal} from '../../integration/server/local-db.js';
import {InstructorController} from '../core/controller.js';
import {uuid} from '../core/types.js';
export function createInstructorSession(...args:Parameters<typeof createActivitySession>){
 const base=createActivitySession(...args),execute=args[2]?.execute;
 if(!execute)throw Error('explicit_local_executor_required');
 const instructor=new InstructorController({school:()=>base.school.controller.command('refresh'),call:(name,input,signal)=>base.school.run(async token=>{
  if(!uuid(input.p_school_id)||!['ws_v1_instructor_read','ws_v1_instructor_write'].includes(name))throw Error('input');
  const claims=base.school.registry.resolve(token);
  const keys=name==='ws_v1_instructor_read'?['p_school_id','p_month']:['p_school_id','p_kind','p_payload','p_expected_version','p_request_id'];
  if(Object.keys(input).sort().join()!==keys.slice().sort().join())throw Error('input');
  const values=keys.map(k=>k==='p_payload'?literal(JSON.stringify(input[k]))+'::jsonb':literal(input[k]));
  const result=await execute(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(claims))};SELECT public.${name}(${values.join(',')});COMMIT;`,'school_client',signal);
  return JSON.parse(result);
 })});
 return {...base,instructor};
}
