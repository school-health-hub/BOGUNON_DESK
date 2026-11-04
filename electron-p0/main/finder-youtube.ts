import type {FinderConditions,YoutubeVideo} from '../finder-search-protocol.js';
export const FINDER_ERRORS={invalid:'검색 입력 또는 YouTube 응답 형식을 확인해 주세요.',key:'YouTube Data API v3 전용 API Key를 등록해 주세요. Gemini 연결 권한과는 별개입니다.',auth:'YouTube API Key·API 활성화·키 제한 설정을 확인해 주세요.',quota:'YouTube API 할당량 또는 요청 한도에 도달했습니다. Google Cloud Console에서 확인하세요. 자동 재시도하지 않습니다.',network:'YouTube 검색에 연결하지 못했습니다. 기존 보관함과 원고는 유지됩니다.',timeout:'YouTube 검색 시간이 초과됐습니다. 자동 재시도하지 않습니다.',cancel:'검색을 취소했습니다. 기존 보관함과 원고는 유지됩니다.',busy:'진행 중인 검색 또는 연결 작업을 먼저 완료하거나 취소해 주세요.'} as const;
export class FinderSearchError extends Error{}
export type YoutubeFetch=(url:string,init:RequestInit)=>Promise<Response>;
export const validYoutubeKey=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{20,200}$/.test(v);
export const validVideoId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{11}$/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).sort().join(',')===allowed.sort().join(',');
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const pageToken=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_=-]{1,512}$/.test(v);
export function validateFinderConditions(v:unknown):FinderConditions{
 if(!object(v)||!keys(v,['topic','target','minutes'])||!text(v.topic,100)||!text(v.target,100)||!Number.isInteger(v.minutes)||Number(v.minutes)<1||Number(v.minutes)>180)throw new FinderSearchError(FINDER_ERRORS.invalid);
 const query=v.topic+' '+v.target;
 if(/(?:학생명|성명|이름|학번|학생번호)\s*[:：]|\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b|\b\d{6}-[1-8]\d{6}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:password|비밀번호|api[ _-]?key|token)\s*[:=]|\b(?:sk-|AIza)[A-Za-z0-9_-]{15,}/i.test(query))throw new FinderSearchError('검색어에 개인정보·인증정보를 입력하지 마세요. 학생·교직원 정보는 외부 검색에 보내지 않습니다.');
 return {topic:v.topic.trim(),target:v.target.trim(),minutes:Number(v.minutes)};
}
export function youtubeUrl(operation:'search'|'videos',key:string,conditions:FinderConditions,ids:readonly string[]=[],token?:string){
 if(!validYoutubeKey(key))throw new FinderSearchError(FINDER_ERRORS.key);
 const u=new URL('https://www.googleapis.com/youtube/v3/'+operation);u.searchParams.set('key',key);
 if(operation==='search'){
  const q=validateFinderConditions(conditions);u.searchParams.set('part','snippet');u.searchParams.set('type','video');u.searchParams.set('maxResults','10');u.searchParams.set('safeSearch','strict');u.searchParams.set('relevanceLanguage','ko');u.searchParams.set('q',q.topic+' '+q.target);
  if(token){if(!pageToken(token))throw new FinderSearchError(FINDER_ERRORS.invalid);u.searchParams.set('pageToken',token);}
 }else{if(!ids.length||ids.length>10||ids.some(id=>!validVideoId(id))||new Set(ids).size!==ids.length)throw new FinderSearchError(FINDER_ERRORS.invalid);u.searchParams.set('part','snippet,contentDetails');u.searchParams.set('id',ids.join(','));}
 return u.href;
}
export function allowedYoutubeUrl(value:string){
 try{const u=new URL(value);if(u.origin!=='https://www.googleapis.com'||u.username||u.password||u.hash||u.port)return false;
 const p=u.searchParams,operation=u.pathname==='/youtube/v3/search'?'search':u.pathname==='/youtube/v3/videos'?'videos':null;
 if(!operation||!validYoutubeKey(p.get('key')))return false;
 if([...p.keys()].some((key,index,all)=>all.indexOf(key)!==index))return false;
 if(operation==='search')return [...p.keys()].every(k=>['key','part','type','maxResults','safeSearch','relevanceLanguage','q','pageToken'].includes(k))&&p.get('part')==='snippet'&&p.get('type')==='video'&&p.get('maxResults')==='10'&&p.get('safeSearch')==='strict'&&p.get('relevanceLanguage')==='ko'&&text(p.get('q'),201)&&(!p.has('pageToken')||pageToken(p.get('pageToken')));
 const ids=p.get('id')?.split(',')??[];return [...p.keys()].every(k=>['key','part','id'].includes(k))&&p.get('part')==='snippet,contentDetails'&&ids.length>0&&ids.length<=10&&ids.every(validVideoId)&&new Set(ids).size===ids.length;
 }catch{return false;}
}
const MAX_BYTES=512*1024;
async function requestJson(fetcher:YoutubeFetch,url:string,signal:AbortSignal):Promise<unknown>{
 if(!allowedYoutubeUrl(url))throw new FinderSearchError(FINDER_ERRORS.invalid);let response:Response|undefined;
 try{
  response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Accept:'application/json'}});
  if(signal.aborted)throw new FinderSearchError(FINDER_ERRORS.cancel);
  if(response.redirected||response.url&&response.url!==url)throw new FinderSearchError(FINDER_ERRORS.network);
  const status=response.status;
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new FinderSearchError(status===401||status===403?FINDER_ERRORS.auth:status===429?FINDER_ERRORS.quota:FINDER_ERRORS.network);
  const size=response.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>MAX_BYTES)||!response.body)throw new FinderSearchError(FINDER_ERRORS.invalid);
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{while(true){const part=await reader.read();if(signal.aborted)throw new FinderSearchError(FINDER_ERRORS.cancel);if(part.done)break;length+=part.value.byteLength;if(length>MAX_BYTES)throw new FinderSearchError(FINDER_ERRORS.invalid);chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  let body:unknown;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new FinderSearchError(FINDER_ERRORS.invalid);}
  if(!response.ok){const reasons=object(body)&&object(body.error)&&Array.isArray(body.error.errors)?body.error.errors.filter(object).map(e=>e.reason):[];throw new FinderSearchError(status===429||reasons.some(r=>['quotaExceeded','dailyLimitExceeded','rateLimitExceeded','userRateLimitExceeded'].includes(String(r)))?FINDER_ERRORS.quota:status===400||status===401||status===403?FINDER_ERRORS.auth:FINDER_ERRORS.network);}
  return body;
 }catch(e){if(e instanceof FinderSearchError)throw e;throw new FinderSearchError(signal.aborted?FINDER_ERRORS.cancel:FINDER_ERRORS.network);}
 finally{if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
}
export function parseYoutubeSearch(value:unknown){
 if(!object(value)||value.error||!Array.isArray(value.items)||value.items.length>10||value.nextPageToken!==undefined&&!pageToken(value.nextPageToken))throw new FinderSearchError(FINDER_ERRORS.invalid);
 const ids:string[]=[];for(const item of value.items){if(!object(item)||!object(item.id)||!validVideoId(item.id.videoId))throw new FinderSearchError(FINDER_ERRORS.invalid);if(!ids.includes(item.id.videoId))ids.push(item.id.videoId);}
 return {ids,nextToken:typeof value.nextPageToken==='string'?value.nextPageToken:undefined};
}
function plainTitle(value:string){return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[0-9a-f]+);/gi,entity=>{const named:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];const n=entity.toLowerCase().startsWith('&#x')?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));return n>=32&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):entity;});}
export function parseYoutubeDetails(value:unknown,ids:readonly string[]):YoutubeVideo[]{
 if(!object(value)||value.error||!Array.isArray(value.items)||value.items.length>10)throw new FinderSearchError(FINDER_ERRORS.invalid);
 const found=new Map<string,YoutubeVideo>();
 for(const item of value.items){
  if(!object(item)||!validVideoId(item.id)||!ids.includes(item.id)||found.has(item.id)||!object(item.snippet)||!object(item.contentDetails))throw new FinderSearchError(FINDER_ERRORS.invalid);
  const s=item.snippet,duration=item.contentDetails.duration;if(!text(s.title,500)||!text(s.channelTitle,200)||typeof s.channelId!=='string'||!/^UC[A-Za-z0-9_-]{22}$/.test(s.channelId)||typeof duration!=='string')throw new FinderSearchError(FINDER_ERRORS.invalid);
  const m=/^PT(?:(\d{1,3})H)?(?:(\d{1,3})M)?(?:(\d{1,3})S)?$/.exec(duration);if(!m||!m.slice(1).some(Boolean))continue;const seconds=Number(m[1]??0)*3600+Number(m[2]??0)*60+Number(m[3]??0);if(seconds<1||seconds>86400)continue;
  found.set(item.id,{videoId:item.id,title:plainTitle(s.title),channelId:s.channelId,channelTitle:plainTitle(s.channelTitle),durationSeconds:seconds,url:`https://www.youtube.com/watch?v=${item.id}`,source:'youtube'});
 }
 return ids.flatMap(id=>found.has(id)?[found.get(id)!]:[]);
}
export async function searchYoutube(fetcher:YoutubeFetch,key:string,conditions:FinderConditions,signal:AbortSignal,token?:string){
 const search=parseYoutubeSearch(await requestJson(fetcher,youtubeUrl('search',key,conditions,[],token),signal));
 const videos=search.ids.length?parseYoutubeDetails(await requestJson(fetcher,youtubeUrl('videos',key,conditions,search.ids),signal),search.ids):[];
 return {videos,nextToken:search.nextToken,omitted:search.ids.length-videos.length};
}
