import {it,expect} from 'vitest';
import {createRuntime} from '../../school-workspace/school05/server/provider.js';
import {sql} from './school05-native-pg.js';
const A='10000000-0000-0000-0000-000000000001',B=A.slice(0,-1)+'2';
it('WINDOWS LOCAL DB: separate Instructor RPCs preserve teacher-only writes and school scope',async()=>{
 let session:unknown=null;const runtime=await createRuntime({vault:{load:async()=>session as never,save:async s=>{session=s;},clear:async()=>{session=null;}}});
 try{await runtime.school('login',{});await runtime.school('select',{school:A});const read=await runtime.instructor!('read',{school:A,month:'2026-08'}) as {phase:string};expect(read.phase).toBe('ready');
 const pair=await sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('ws_v1_instructor_read','ws_v1_instructor_write')");expect(pair).toBe('2');
 expect(await sql("SELECT count(*) FROM workspace_private.s08_rpc_manifest WHERE public_signature LIKE '%instructor%'")).toBe('0');
 await runtime.switchAccount({account:4});await runtime.school('login',{});await runtime.school('select',{school:A});const assistant=await runtime.instructor!('read',{school:A,month:'2026-08'}) as {phase:string;board:{instructor:unknown;logs:unknown[]}};expect(assistant.phase).toBe('ready');expect(assistant.board.instructor).toBeNull();expect(assistant.board.logs).toEqual([]);
 const write=await runtime.instructor!('settings',{school:A,month:'2026-08',version:0,request_id:crypto.randomUUID(),payload:{}}) as {phase:string};expect(write.phase).toBe('locked');
 await expect(sql("SET ROLE authenticated;SELECT * FROM workspace.instructor_schedules")).rejects.toThrow();
 const claims=JSON.stringify({role:'authenticated',sub:'00000000-0000-0000-0000-000000000004',session_id:'30000000-0000-0000-0000-000000000004',exp:2000000000,is_anonymous:false});
 await expect(sql(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='${claims}';SELECT public.ws_v1_instructor_write('${A}','settings','{}'::jsonb,0,'${crypto.randomUUID()}');COMMIT;`,'school_client')).rejects.toThrow(/access_denied/);
 await runtime.switchAccount({account:6});await runtime.school('login',{});await runtime.school('select',{school:B});expect((await runtime.instructor!('read',{school:A,month:'2026-08'}) as {phase:string}).phase).not.toBe('ready');
 }finally{await runtime.dispose();}
});
