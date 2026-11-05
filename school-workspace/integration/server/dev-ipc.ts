import {assertSender} from '../../../electron-p0/main/policy.js';
import type {WorkspaceCoordinator,WorkspaceViewState} from '../core/workspace.js';
export type DevCommand='state'|'login'|'logout'|'selectSchool';
export type DevReply={ok:true;state:Readonly<WorkspaceViewState>}|{ok:false;message:string};
export const DEV_CHANNEL='workspace:school01c-dev';
export interface DevIpc {handle(channel:string,fn:(event:{sender:unknown;senderFrame:unknown},command:unknown,...args:unknown[])=>Promise<DevReply>):void;removeHandler(channel:string):void}
/** Registration is opt-in and test/dev only. Production Main does not import this module. */
export function registerDevWorkspaceIpc(ipc:DevIpc,contents:{mainFrame:unknown;getURL():string},expectedUrl:string,controller:WorkspaceCoordinator,isolatedDevelopment:boolean):()=>void{
 if(!isolatedDevelopment)throw new Error('isolated_development_required');
 ipc.handle(DEV_CHANNEL,async(event,command,...args)=>{
  try{
   assertSender(event,contents,expectedUrl);
   if(!['state','login','logout','selectSchool'].includes(String(command)))throw Error();
   if(command==='selectSchool'){
    if(args.length!==1||typeof args[0]!=='string'||!/^[0-9a-f-]{36}$/i.test(args[0]))throw Error();
    await controller.selectSchool(args[0]);
   }else{if(args.length)throw Error();if(command==='login')await controller.login();if(command==='logout')await controller.logout();}
   assertSender(event,contents,expectedUrl);
   return{ok:true,state:structuredClone(controller.snapshot())};
  }catch{return{ok:false,message:'공동 공간 요청을 처리하지 못했습니다.'};}
 });
 return()=>ipc.removeHandler(DEV_CHANNEL);
}
export function createDevPreloadBridge(invoke:(channel:string,command:DevCommand,...args:string[])=>Promise<DevReply>){
 return Object.freeze({state:()=>invoke(DEV_CHANNEL,'state'),login:()=>invoke(DEV_CHANNEL,'login'),logout:()=>invoke(DEV_CHANNEL,'logout'),selectSchool:(school:string)=>invoke(DEV_CHANNEL,'selectSchool',school)});
}
