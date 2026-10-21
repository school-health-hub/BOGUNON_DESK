import { invoke, isTauri } from '@tauri-apps/api/core';
import { getSupabaseClient } from '../auth/supabaseClient';
import { safeVideoUrl, validateConditions, type Conditions, type Video } from './model';
import { verifiedChannelEvidence } from './officialChannels';
export type SearchRequest={readonly topic:string;readonly audience:string;readonly desiredMinutes:number};
export type SearchResponse={readonly source:'live'|'synthetic-mock';readonly notice:string;readonly results:readonly Video[]};
export type FinderAuthStatus='loading'|'signedIn'|'signedOut';
export type FinderSession={readonly accessToken:string;readonly userId:string;readonly expiresAt:number};
export type SearchCode='UNAUTHORIZED'|'SESSION_EXPIRED'|'REAL_DISPATCH_DISABLED'|'INVALID_RESPONSE'|'INVALID_REQUEST'|'QUOTA_EXCEEDED'|'RATE_LIMITED'|'NOT_CONFIGURED'|'SEARCH_FAILED'|'FORBIDDEN'|'UNAVAILABLE'|'SEARCH_BUSY'|'UPSTREAM_QUOTA'|'UPSTREAM_INVALID'|'UPSTREAM_UNAVAILABLE';
const messages:Readonly<Record<SearchCode,string>>={FORBIDDEN:'허용된 화면에서 다시 요청해 주세요.',UNAVAILABLE:'서버 검색을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',SEARCH_BUSY:'같은 검색을 처리 중입니다. 잠시 후 다시 시도해 주세요.',UPSTREAM_QUOTA:'영상 제공자의 사용량 한도에 도달했습니다.',UPSTREAM_INVALID:'영상 제공자의 응답을 확인하지 못했습니다.',UPSTREAM_UNAVAILABLE:'영상 제공자에 연결하지 못했습니다.',UNAUTHORIZED:'서버 검색은 BOGUNON 로그인이 필요합니다.',SESSION_EXPIRED:'로그인이 만료되었습니다. 다시 로그인해 주세요.',REAL_DISPATCH_DISABLED:'Phase 2B에서는 실제 외부 검색이 차단되어 있습니다. 로컬 Mock을 사용해 주세요.',INVALID_RESPONSE:'검색 응답 형식을 확인하지 못했습니다.',INVALID_REQUEST:'검색 조건을 확인해 주세요.',QUOTA_EXCEEDED:'검색 사용량 한도를 초과했습니다.',RATE_LIMITED:'요청이 많습니다. 잠시 후 다시 시도해 주세요.',NOT_CONFIGURED:'서버 검색 설정이 준비되지 않았습니다.',SEARCH_FAILED:'검색 요청을 처리하지 못했습니다.'};
export class FinderSearchError extends Error{readonly name='FinderSearchError';constructor(readonly code:SearchCode){super(messages[code]);}}
export type SearchDependencies={readonly getSession:()=>Promise<FinderSession|null>;readonly transport:(request:SearchRequest,accessToken:string)=>Promise<unknown>};
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const invalid=():never=>{throw new FinderSearchError('INVALID_RESPONSE');};
export const canonicalTimestamp=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export const parseSearchResponse=(value:unknown):SearchResponse=>{
 if(!object(value)||(value.source!=='live'&&value.source!=='synthetic-mock')||typeof value.notice!=='string'||value.notice.length>1000||!Array.isArray(value.results)||value.results.length>12)return invalid();
 const source=value.source;const seen=new Set<string>();
 const results=value.results.map((row:unknown):Video=>{
  if(!object(row)||typeof row.videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(row.videoId)||seen.has(row.videoId)||typeof row.title!=='string'||!row.title.trim()||row.title.length>500||typeof row.channelId!=='string'||!row.channelId||typeof row.channelTitle!=='string'||row.channelTitle.length>500||typeof row.url!=='string'||safeVideoUrl(row.url)!==row.url||new URL(row.url).searchParams.get('v')!==row.videoId||(row.durationSeconds!==null&&(typeof row.durationSeconds!=='number'||!Number.isInteger(row.durationSeconds)||row.durationSeconds<1||row.durationSeconds>86400))||typeof row.synthetic!=='boolean'||row.synthetic!==(source==='synthetic-mock')||typeof row.official!=='boolean'||(row.officialEvidence!==null&&typeof row.officialEvidence!=='string')||(source==='live'&&!canonicalTimestamp(row.fetchedAt))||(row.fetchedAt!==undefined&&(!canonicalTimestamp(row.fetchedAt)||Date.parse(row.fetchedAt)>Date.now()+300000||Date.parse(row.fetchedAt)<=Date.now()-30*86400000)))return invalid();
  seen.add(row.videoId);const evidence=row.synthetic?null:verifiedChannelEvidence(row.channelId);
  return {videoId:row.videoId,title:row.title,channelId:row.channelId,channelTitle:row.channelTitle,durationSeconds:row.durationSeconds,url:row.url,source,synthetic:row.synthetic,official:evidence!==null,officialEvidence:evidence,...(row.fetchedAt===undefined?{}:{fetchedAt:row.fetchedAt})};
 });return {source,notice:value.notice,results};
};
const safeError=(error:unknown):FinderSearchError=>{
 if(error instanceof FinderSearchError)return error;
 if(object(error)&&typeof error.code==='string'&&Object.prototype.hasOwnProperty.call(messages,error.code)){
  const code=Object.keys(messages).find(key=>key===error.code);
  switch(code){case 'FORBIDDEN':case 'UNAVAILABLE':case 'SEARCH_BUSY':case 'UPSTREAM_QUOTA':case 'UPSTREAM_INVALID':case 'UPSTREAM_UNAVAILABLE':case 'UNAUTHORIZED':case 'SESSION_EXPIRED':case 'REAL_DISPATCH_DISABLED':case 'INVALID_RESPONSE':case 'INVALID_REQUEST':case 'QUOTA_EXCEEDED':case 'RATE_LIMITED':case 'NOT_CONFIGURED':case 'SEARCH_FAILED':return new FinderSearchError(code);}
 }
 if(typeof error==='string'&&error==='REAL_DISPATCH_DISABLED')return new FinderSearchError('REAL_DISPATCH_DISABLED');
 return new FinderSearchError('SEARCH_FAILED');
};
export const nativeSearchDependencies:SearchDependencies={
 getSession:async()=>{const {data,error}=await getSupabaseClient().auth.getSession();const session=data.session;if(error||!session)return null;return {accessToken:session.access_token,userId:session.user.id,expiresAt:(session.expires_at??0)*1000};},
 transport:async(request,accessToken)=>{if(!isTauri())throw new FinderSearchError('REAL_DISPATCH_DISABLED');return invoke<unknown>('education_video_search',{request,accessToken});},
};
export const searchWithSession=async(conditions:Conditions,status:FinderAuthStatus,dependencies:SearchDependencies=nativeSearchDependencies,expectedUserId='',isCurrent:()=>boolean=()=>true):Promise<SearchResponse>=>{
 if(status!=='signedIn')throw new FinderSearchError('UNAUTHORIZED');
 if(validateConditions(conditions))throw new FinderSearchError('INVALID_REQUEST');
 try{const session=await dependencies.getSession();if(!session||!session.accessToken||!session.userId||session.expiresAt<=Date.now()||!isCurrent()||(expectedUserId!==''&&session.userId!==expectedUserId))throw new FinderSearchError('SESSION_EXPIRED');const response=await dependencies.transport({topic:conditions.topic.trim(),audience:conditions.target.trim(),desiredMinutes:conditions.minutes},session.accessToken);if(!isCurrent()||session.expiresAt<=Date.now())throw new FinderSearchError('SESSION_EXPIRED');return parseSearchResponse(response);}catch(error){throw safeError(error);}
};
