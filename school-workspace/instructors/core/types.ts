import type {HealthSupportInstructor,HealthSupportWorkLog} from './validation.js';
export type Action='read'|'settings'|'save'|'delete'|'import';
export interface ViewerLog {id:string;date:string;startTime:string;endTime:string;hours:number}
export interface Board {school:string;role:'SCHOOL_ADMIN'|'HEALTH_TEACHER'|'HEALTH_ASSISTANT';version:number;instructor:HealthSupportInstructor|null;logs:HealthSupportWorkLog[];schedule:ViewerLog[];name:string;month:string}
export interface State {phase:'locked'|'ready'|'error';board?:Board;message?:string}
export interface Bridge {command(action:Action,input:Record<string,unknown>):Promise<State>}
export const teacher=(role:string)=>role==='SCHOOL_ADMIN'||role==='HEALTH_TEACHER';
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function monthValue(value:unknown){if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||Number(value.slice(0,4))<100)throw Error('input');return value;}
