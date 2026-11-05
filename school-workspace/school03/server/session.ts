import{createSchoolSession}from'../../school02/server/session.js';import{TaskDatabase,sql}from'./database.js';import type{SyntheticTokenRegistry}from'../../integration/server/local-db.js';import{TaskController}from'../core/controller.js';
export const ORIGIN='https://127.0.0.1:5193';
export function createTaskSession(kind:'electron'|'web',index=3,options:{execute?:typeof sql;databaseFactory?:(registry:SyntheticTokenRegistry)=>TaskDatabase;origin?:string}={}){let database!:TaskDatabase;
 const school=createSchoolSession(kind,index,{origin:options.origin??ORIGIN,execute:options.execute??sql,databaseFactory:registry=>(database=options.databaseFactory?.(registry)??new TaskDatabase(registry))});
 const tasks=new TaskController({school:(a,i)=>school.controller.command(a,i),call:(name,args,signal)=>school.run(t=>database.task(t,name,args,signal))});
 return{school,tasks,database};
}
