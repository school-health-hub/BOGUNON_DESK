import type {LibraryV2,TeacherData,ProviderData,LibraryEntry} from '../../finder-v2-protocol.js';
import {canonicalTimestamp,safeVideoUrl} from './contracts.js';
import {parseAiMetadata} from './aiLibraryMetadata.js';
import {parseCandidateRecord,candidateRecordMatchesCandidate} from './candidateRecord.js';
import {parseRecommendationReason} from './recommendationReason.js';
export const FINDER_BYTES=2*1024*1024;
export const METADATA_TTL_MS=30*86400000;
export class FinderFormatError extends Error{}
export const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function fields(v:unknown,required:readonly string[],optional:readonly string[]=[]):asserts v is Record<string,unknown>{
 if(!object(v)||required.some(k=>!Object.hasOwn(v,k)))throw new FinderFormatError('불완전한 Finder 데이터입니다. 적용하지 않았습니다.');
 const unknown=Object.keys(v).find(k=>![...required,...optional].includes(k));
 if(unknown)throw new FinderFormatError(`지원하지 않는 필드(${unknown.slice(0,80)})가 있어 손실 없는 적용을 차단했습니다.`);
}
function text(v:unknown,max=20000):asserts v is string{if(typeof v!=='string'||v.length>max||v.includes('\0'))throw new FinderFormatError('Finder 문자열 제한을 확인해 주세요.');}
export function validateTeacher(value:unknown):TeacherData{
 fields(value,['educationTitle','target','schedule','instructions','message','notes']);for(const s of Object.values(value))text(s);return structuredClone(value) as TeacherData;
}
function provider(v:unknown,id:string,now:number):ProviderData|null{
 if(v===null)return null;
 fields(v,['title','channelId','channelTitle','durationSeconds','url','source','official','officialEvidence','synthetic','fetchedAt','expiresAt']);
 text(v.title,500);text(v.channelId,200);text(v.channelTitle,500);text(v.url,200);if(v.officialEvidence!==null)text(v.officialEvidence);
 if(safeVideoUrl(v.url)!==v.url||new URL(v.url).searchParams.get('v')!==id||!['live','synthetic-mock'].includes(String(v.source))||typeof v.official!=='boolean'||typeof v.synthetic!=='boolean'||v.synthetic!==(v.source==='synthetic-mock')||!canonicalTimestamp(v.fetchedAt)||!canonicalTimestamp(v.expiresAt)||Date.parse(v.fetchedAt)>now+300000||Date.parse(v.expiresAt)>now+METADATA_TTL_MS+300000||Date.parse(v.expiresAt)<=Date.parse(v.fetchedAt)||Date.parse(v.expiresAt)-Date.parse(v.fetchedAt)>METADATA_TTL_MS||(v.durationSeconds!==null&&(!Number.isInteger(v.durationSeconds)||Number(v.durationSeconds)<1||Number(v.durationSeconds)>86400)))throw new FinderFormatError('영상 메타데이터 형식·URL·조회 시각을 확인해 주세요.');
 // Imported provenance/official claims are preserved as source data, never promoted to app verification.
 return structuredClone(v) as ProviderData;
}
export function validateLibraryV2(value:unknown,now=Date.now()):LibraryV2{
 if(Buffer.byteLength(JSON.stringify(value))>FINDER_BYTES)throw new FinderFormatError('Finder JSON은 2 MiB 이하여야 합니다.');
 fields(value,['version','entries']);if(value.version!==2||!Array.isArray(value.entries)||value.entries.length>1000)throw new FinderFormatError('지원하지 않는 Finder V2 버전·항목 수입니다.');
 const ids=new Set<string>();
 for(const row of value.entries){
  fields(row,['videoId','teacher','provider'],['ai','candidateRecord','recommendationReason']);
  if(typeof row.videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(row.videoId)||ids.has(row.videoId))throw new FinderFormatError('잘못되었거나 파일 내부에 중복된 영상 ID가 있습니다.');ids.add(row.videoId);
  validateTeacher(row.teacher);provider(row.provider,row.videoId,now);
  const ai=row.ai==null?null:parseAiMetadata(row.ai,row.videoId,now);
  const record=row.candidateRecord==null?null:parseCandidateRecord(row.candidateRecord,now);
  if(ai&&record&&!candidateRecordMatchesCandidate(record,ai))throw new FinderFormatError('AI 후보와 교사 확인 기록이 서로 일치하지 않습니다.');
  if(row.recommendationReason!=null)parseRecommendationReason(row.recommendationReason);
 }
 // Do not call Tauri expireMetadata/registry normalization: imports must be lossless, including legacy optional fields.
 return structuredClone(value) as LibraryV2;
}
export function entryTitle(entry:LibraryEntry){return entry.teacher.educationTitle||entry.candidateRecord?.title||entry.provider?.title||entry.ai?.title||entry.videoId;}
