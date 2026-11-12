import type {WebContents,IpcMainInvokeEvent} from 'electron';
import type {MonitorWrite} from '../monitor-protocol.js';
import type {MonitorProfiles} from './monitor-profiles.js';
import {assertSender} from './policy.js';
export function parseMonitorWrite(value:unknown):MonitorWrite{
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='layout,profileId,revision,visible'||!('revision'in value)||!Number.isSafeInteger(value.revision)||Number(value.revision)<0||!('profileId'in value)||typeof value.profileId!=='string'||value.profileId.length>80||!('visible'in value)||typeof value.visible!=='boolean'||!('layout'in value))throw new Error('Invalid monitor layout request');
 return{revision:Number(value.revision),profileId:value.profileId,visible:value.visible,layout:value.layout};
}
export function createMonitorHandlers(contents:WebContents,url:string,profiles:MonitorProfiles,closing:()=>boolean){
 return{
  read:async(event:IpcMainInvokeEvent,...args:unknown[])=>{assertSender(event,contents,url);if(args.length)throw new Error('Invalid monitor read');return profiles.read();},
  write:async(event:IpcMainInvokeEvent,...args:unknown[])=>{assertSender(event,contents,url);if(closing()||args.length!==1)throw new Error('모니터 구성을 확인하거나 설정을 저장하는 중입니다. 잠시 뒤 다시 적용해 주세요.');return profiles.write(parseMonitorWrite(args[0]));},
 };
}
