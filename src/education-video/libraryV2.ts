import {parseAiMetadata} from './aiLibraryMetadata';
import type {AiVideoCandidate} from './aiVideo';
import {FinderInputError,type Education,type Library,type LibraryItem,type Video,safeVideoUrl} from './model';
import {parseLibrary} from './legacyLibrary';
import {canonicalTimestamp} from './searchService';
import {verifiedChannelEvidence} from './officialChannels';
export const METADATA_TTL_MS=30*86400000;
export type TeacherData=Education&{readonly message:string;readonly notes:string};
export type ProviderData={readonly title:string;readonly channelId:string;readonly channelTitle:string;readonly durationSeconds:number|null;readonly url:string;readonly source:'live'|'synthetic-mock';readonly official:boolean;readonly officialEvidence:string|null;readonly synthetic:boolean;readonly fetchedAt:string;readonly expiresAt:string};
export type LibraryEntry={readonly videoId:string;readonly teacher:TeacherData;readonly provider:ProviderData|null;readonly ai?:AiVideoCandidate};
export type LibraryV2={readonly version:2;readonly entries:readonly LibraryEntry[]};
const teacherFields=['educationTitle','target','schedule','instructions','message','notes'] as const;
const providerFields=['title','channelId','channelTitle','durationSeconds','url','source','official','officialEvidence','synthetic','fetchedAt','expiresAt'] as const;
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const fail=():never=>{throw new FinderInputError('지원하지 않거나 손상된 라이브러리 형식입니다. 기존 데이터는 유지됩니다.');};
const only=(value:Record<string,unknown>,fields:readonly string[]):boolean=>Object.keys(value).every(key=>fields.includes(key));
const text=(value:unknown,max=20000):string=>typeof value==='string'&&value.length<=max&&!value.includes('\0')?value:fail();
const teacher=(value:unknown):TeacherData=>{
 if(!object(value)||!only(value,teacherFields))return fail();
 return {educationTitle:text(value.educationTitle),target:text(value.target),schedule:text(value.schedule),instructions:text(value.instructions),message:text(value.message),notes:text(value.notes)};
};
const provider=(value:unknown,videoId:string,now:number):ProviderData|null=>{
 if(value===null)return null;
 if(!object(value)||!only(value,providerFields)||!canonicalTimestamp(value.fetchedAt)||!canonicalTimestamp(value.expiresAt)||Date.parse(value.fetchedAt)>now+300000||Date.parse(value.expiresAt)>now+METADATA_TTL_MS+300000||Date.parse(value.expiresAt)<=Date.parse(value.fetchedAt)||Date.parse(value.expiresAt)-Date.parse(value.fetchedAt)>METADATA_TTL_MS||(value.source!=='live'&&value.source!=='synthetic-mock')||typeof value.synthetic!=='boolean'||value.synthetic!==(value.source==='synthetic-mock')||typeof value.official!=='boolean'||(value.officialEvidence!==null&&typeof value.officialEvidence!=='string')||(value.durationSeconds!==null&&(typeof value.durationSeconds!=='number'||!Number.isInteger(value.durationSeconds)||value.durationSeconds<1||value.durationSeconds>86400)))return fail();
 if(value.officialEvidence!==null)text(value.officialEvidence);
 const url=text(value.url,200);if(safeVideoUrl(url)!==url||new URL(url).searchParams.get('v')!==videoId)return fail();
 const channelId=text(value.channelId,200);const evidence=value.synthetic?null:verifiedChannelEvidence(channelId);
 return {title:text(value.title,500),channelId,channelTitle:text(value.channelTitle,500),durationSeconds:value.durationSeconds,url,source:value.source,official:evidence!==null,officialEvidence:evidence,synthetic:value.synthetic,fetchedAt:value.fetchedAt,expiresAt:value.expiresAt};
};
export const expireMetadata=(library:LibraryV2,now=Date.now()):LibraryV2=>({version:2,entries:library.entries.map(entry=>{const {ai,...rest}=entry;const provider=entry.provider&&Date.parse(entry.provider.expiresAt)<=now?null:entry.provider;return ai&&Date.parse(ai.checkedAt)+METADATA_TTL_MS>now?{...rest,provider,ai}:{...rest,provider};})});
export const toEntry=(item:LibraryItem,now=Date.now()):LibraryEntry=>{
 if(item.source==='live'&&!canonicalTimestamp(item.fetchedAt))throw new FinderInputError('실제 영상 메타데이터의 조회 시각이 필요합니다.');
 const fetchedAt=item.fetchedAt??new Date(now).toISOString();const synthetic=item.source!=='live';const evidence=synthetic?null:verifiedChannelEvidence(item.channelId);
 return {videoId:item.videoId,teacher:{educationTitle:item.educationTitle,target:item.target,schedule:item.schedule,instructions:item.instructions,message:item.message,notes:item.notes},provider:{title:item.title,channelId:item.channelId,channelTitle:item.channelTitle,durationSeconds:item.durationSeconds,url:item.url,source:synthetic?'synthetic-mock':'live',official:evidence!==null,officialEvidence:evidence,synthetic,fetchedAt,expiresAt:item.expiresAt??new Date(Date.parse(fetchedAt)+METADATA_TTL_MS).toISOString()}};
};
export const entryVideo=(entry:LibraryEntry):Video|null=>entry.provider?{videoId:entry.videoId,...entry.provider}:null;
export const migrateLegacy=(library:Library,now=Date.now()):LibraryV2=>({version:2,entries:library.items.map(item=>toEntry(item,now))});
export const parseLibraryV2=(json:string,now=Date.now()):LibraryV2=>{
 if(new TextEncoder().encode(json).length>2*1024*1024)return fail();
 let value:unknown;try{value=JSON.parse(json);}catch(error){if(error instanceof SyntaxError)return fail();throw error;}
 if(object(value)&&value.version===1)return migrateLegacy(parseLibrary(json),now);
 if(!object(value)||value.version!==2||!only(value,['version','entries'])||!Array.isArray(value.entries)||value.entries.length>1000)return fail();
 const seen=new Set<string>();const entries=value.entries.map((row:unknown):LibraryEntry=>{
  if(!object(row)||!only(row,['videoId','teacher','provider','ai'])||typeof row.videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(row.videoId))return fail();
  if(seen.has(row.videoId))throw new FinderInputError('같은 영상 ID가 파일 안에 중복되어 있습니다. 기존 데이터는 유지됩니다.');
  seen.add(row.videoId);return {videoId:row.videoId,teacher:teacher(row.teacher),provider:provider(row.provider,row.videoId,now),...(row.ai===undefined?{}:{ai:parseAiMetadata(row.ai,row.videoId,now)})};
 });return expireMetadata({version:2,entries},now);
};
export const mergeLibraryV2=(current:LibraryV2,incoming:LibraryV2):LibraryV2=>({version:2,entries:[...current.entries.map(entry=>{const added=incoming.entries.find(row=>row.videoId===entry.videoId);return added?{...entry,provider:added.provider??entry.provider,...(added.ai?{ai:added.ai}:{})}:entry;}),...incoming.entries.filter(entry=>!current.entries.some(existing=>existing.videoId===entry.videoId))]});
