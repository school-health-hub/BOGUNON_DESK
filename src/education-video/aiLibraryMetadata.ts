import {FinderInputError,safeVideoUrl} from './model';
import {canonicalTimestamp} from './searchService';
import type {AiVideoCandidate} from './aiVideo';
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const fail=():never=>{throw new FinderInputError('AI 영상 출처 정보가 손상되었습니다. 기존 자료는 유지됩니다.');};
const text=(value:unknown,max:number):string=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!value.includes('\0')?value:fail();
const fields=['videoId','url','title','publisher','durationSeconds','description','relevance','reason','sources','checkedAt','needsReview'];
export function parseAiMetadata(value:unknown,videoId:string,now:number):AiVideoCandidate{
 if(!object(value)||Object.keys(value).some(key=>!fields.includes(key))||value.videoId!==videoId||!canonicalTimestamp(value.checkedAt)||Date.parse(value.checkedAt)>now+300000||value.needsReview!==true||!Array.isArray(value.sources)||value.sources.length<1||value.sources.length>20)return fail();
 const url=text(value.url,200);if(safeVideoUrl(url)!==url||new URL(url).searchParams.get('v')!==videoId)return fail();
 if(value.durationSeconds!==null&&(typeof value.durationSeconds!=='number'||!Number.isInteger(value.durationSeconds)||value.durationSeconds<1||value.durationSeconds>86400))return fail();
 const sources=value.sources.map((source:unknown)=>{
  if(!object(source)||Object.keys(source).some(key=>key!=='url'&&key!=='title'))return fail();
  const sourceUrl=text(source.url,200);if(safeVideoUrl(sourceUrl)!==url)return fail();
  return {url:sourceUrl,title:text(source.title,500)};
 });
 return {videoId,url,title:text(value.title,500),publisher:value.publisher===null?null:text(value.publisher,500),durationSeconds:value.durationSeconds,description:text(value.description,5000),relevance:text(value.relevance,2000),reason:text(value.reason,2000),sources,checkedAt:value.checkedAt,needsReview:true};
}
