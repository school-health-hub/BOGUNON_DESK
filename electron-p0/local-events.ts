import {validTaskDate} from './local-tasks.js';
import type {IpcResult} from './protocol.js';
export const EVENT_ZONE='Asia/Seoul' as const;
export const EVENT_CATEGORIES=['교육','검진','행사','보고'] as const;
export type LocalEventDraft=Readonly<{id:string;title:string;startDate:string;endDate:string;startTime:string|null;endTime:string|null;allDay:boolean;description:string;location:string;category:typeof EVENT_CATEGORIES[number]}>;
export type LocalEvent=LocalEventDraft&Readonly<{createdAt:string;updatedAt:string}>;
export type EventDocument=Readonly<{version:1;revision:number;timeZone:typeof EVENT_ZONE;events:readonly LocalEvent[]}>;
export type EventLoad=Readonly<{document:EventDocument;recovered:boolean}>;
export type EventSave=Readonly<{event:LocalEventDraft;expectedRevision:number;expectedUpdatedAt:string|null}>;
export type EventRemove=Readonly<{id:string;expectedRevision:number;expectedUpdatedAt:string;confirmed:true}>;
export type LocalEventsBridge=Readonly<{load():Promise<IpcResult<EventLoad>>;save(input:EventSave):Promise<IpcResult<EventLoad>>;remove(input:EventRemove):Promise<IpcResult<EventLoad>>}>;
export const emptyEvents=():EventDocument=>({version:1,revision:0,timeZone:EVENT_ZONE,events:[]});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const eventId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export const eventTimestamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const time=(v:unknown):v is string=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const fields=['id','title','startDate','endDate','startTime','endTime','allDay','description','location','category'];
export const eventKeys=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const text=(v:unknown,max:number,multiline=false):v is string=>typeof v==='string'&&v.length<=max&&!(multiline?/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(v);
/** Dates/times are KST wall values; UTC is used only for audit timestamps/interval math. */
export function eventInterval(event:Pick<LocalEventDraft,'startDate'|'endDate'|'startTime'|'endTime'|'allDay'>):readonly[number,number]{
 return [Date.parse(`${event.startDate}T${event.allDay?'00:00':event.startTime}:00+09:00`),Date.parse(`${event.endDate}T${event.allDay?'00:00':event.endTime}:00+09:00`)+(event.allDay?86400000:0)];
}
export function validateEventDraft(value:unknown):LocalEventDraft{
 if(!eventKeys(value,fields)||!eventId(value.id)||!text(value.title,120)||!value.title.trim()||value.title!==value.title.trim()||!validTaskDate(value.startDate)||!validTaskDate(value.endDate)||typeof value.allDay!=='boolean'||!text(value.description,4000,true)||!text(value.location,200)||!EVENT_CATEGORIES.includes(value.category as typeof EVENT_CATEGORIES[number]))throw Error('일정 제목·날짜·메모·분류를 확인해 주세요.');
 if(value.allDay?value.startTime!==null||value.endTime!==null:!time(value.startTime)||!time(value.endTime))throw Error('종일 일정은 시간을 비워 두고 시간 일정은 시작·종료 시각을 입력해 주세요.');
 const event=value as LocalEventDraft,[start,end]=eventInterval(event);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>366*86400000)throw Error('종료는 시작 이후여야 하며 기간은 최대 366일입니다.');
 return {...event};
}
export function validateEvents(value:unknown):EventDocument{
 if(!eventKeys(value,['version','revision','timeZone','events'])||value.version!==1||value.timeZone!==EVENT_ZONE||!Number.isSafeInteger(value.revision)||Number(value.revision)<0||!Array.isArray(value.events)||value.events.length>2000)throw Error('일정 파일 버전·시간대·revision을 확인해 주세요.');
 const seen=new Set<string>();const events=value.events.map((row:unknown):LocalEvent=>{
  if(!eventKeys(row,[...fields,'createdAt','updatedAt'])||!eventTimestamp(row.createdAt)||!eventTimestamp(row.updatedAt)||row.updatedAt<row.createdAt)throw Error('일정 기록 시각을 확인해 주세요.');
  const {createdAt,updatedAt,...draft}=row,event=validateEventDraft(draft);if(seen.has(event.id))throw Error('중복 일정 ID입니다.');seen.add(event.id);return {...event,createdAt,updatedAt};
 });
 const result={version:1 as const,revision:Number(value.revision),timeZone:EVENT_ZONE,events};if(new TextEncoder().encode(JSON.stringify(result)).length>2*1024*1024)throw Error('일정 저장 한도를 초과했습니다.');return result;
}
export const kstDate=(instant:Date)=>new Date(instant.getTime()+9*3600000).toISOString().slice(0,10);
export const eventTimeLabel=(event:LocalEventDraft)=>event.allDay?'종일':`${event.startTime}–${event.endTime} KST`;
export function eventsForDate(events:readonly LocalEvent[],date:string):LocalEvent[]{
 if(!validTaskDate(date))return [];const start=Date.parse(`${date}T00:00:00+09:00`),end=start+86400000;
 return events.filter(event=>{const [a,b]=eventInterval(event);return a<end&&b>start;}).sort((a,b)=>eventInterval(a)[0]-eventInterval(b)[0]||a.title.localeCompare(b.title));
}
export const conflictingEvents=(candidate:LocalEventDraft,events:readonly LocalEvent[])=>{const [a,b]=eventInterval(candidate);return events.filter(event=>{const [c,d]=eventInterval(event);return event.id!==candidate.id&&a<d&&c<b;});};
