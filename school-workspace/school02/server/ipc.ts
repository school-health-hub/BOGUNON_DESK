import{assertSender}from'../../../electron-p0/main/policy.js';import type{Action,SchoolBridge,SchoolState}from'../core/types.js';
export const CHANNEL='workspace:school02';
const actions=new Set<Action>(['state','login','logout','search','select','refresh','join','space','withdraw','decide','role','membership','expiry','leave','propose','accept','mfaVerify','mfaCancel']);
export interface IpcPort{handle(name:string,fn:(event:{sender:unknown;senderFrame:unknown},action:unknown,input:unknown)=>Promise<SchoolState>):void;removeHandler(name:string):void}
export function registerSchoolIpc(ipc:IpcPort,contents:{mainFrame:unknown;getURL():string},url:string,controller:SchoolBridge,localSynthetic:boolean){
 if(!localSynthetic)throw Error('local_synthetic_only');
 ipc.handle(CHANNEL,async(event,action,input)=>{assertSender(event,contents,url);if(!actions.has(action as Action)||!input||Array.isArray(input)||typeof input!=='object'||JSON.stringify(input).length>4096)throw Error('invalid');const result=await controller.command(action as Action,input as Record<string,unknown>);assertSender(event,contents,url);return result;});return()=>ipc.removeHandler(CHANNEL);
}
export function createSchoolPreload(invoke:(channel:string,action:Action,input:Record<string,unknown>)=>Promise<SchoolState>):Readonly<SchoolBridge>{return Object.freeze({command:(action:Action,input:Record<string,unknown>={})=>invoke(CHANNEL,action,input)});}
