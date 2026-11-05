import{createTaskSession}from'../../school03/server/session.js';import{ActivityDatabase,sql,signature}from'./database.js';import{ActivityController}from'../core/controller.js';import type{Board}from'../../school03/core/types.js';
export const ORIGIN='https://127.0.0.1:5194';
export function createActivitySession(kind:'electron'|'web',index=3){let database!:ActivityDatabase;const base=createTaskSession(kind,index,{origin:ORIGIN,execute:sql,databaseFactory:r=>(database=new ActivityDatabase(r))});
 const activity=new ActivityController({school:(a,i)=>base.school.controller.command(a,i),call:(n,a,s)=>base.school.run(t=>database.activity(t,n as keyof typeof signature,a,s)),tasks:(school,s)=>base.school.run(t=>database.task(t,'ws_v1_list_tasks',{p_school_id:school,p_status:null,p_sort:'DUE',p_scope:'MINE',p_include_archived:false},s))as Promise<Board>});return{...base,activity,database};
}
