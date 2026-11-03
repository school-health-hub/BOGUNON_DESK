import {EDUCATION_OFFICES,validateSchool,validateSchoolQuery,schoolObject,type SchoolCandidate,type SchoolQuery} from '../school-protocol.js';
export type SchoolFetch=(url:string,init:RequestInit)=>Promise<Response>;
export class SchoolNetworkError extends Error{}
export const NEIS_SCHOOL_ENDPOINT='https://open.neis.go.kr/hub/schoolInfo';
export function schoolSearchUrl(query:SchoolQuery){const q=validateSchoolQuery(query),url=new URL(NEIS_SCHOOL_ENDPOINT);url.searchParams.set('Type','json');url.searchParams.set('pIndex','1');url.searchParams.set('pSize','5');url.searchParams.set('SCHUL_NM',q.name);if(q.officeCode)url.searchParams.set('ATPT_OFCDC_SC_CODE',q.officeCode);return url.href;}
export function allowedSchoolUrl(value:string){try{const u=new URL(value);if(u.origin+u.pathname!==NEIS_SCHOOL_ENDPOINT||u.username||u.password||u.port||u.hash)return false;const keys=[...u.searchParams.keys()];if(new Set(keys).size!==keys.length||keys.some(k=>!['Type','pIndex','pSize','SCHUL_NM','ATPT_OFCDC_SC_CODE'].includes(k))||u.searchParams.get('Type')!=='json'||u.searchParams.get('pIndex')!=='1'||u.searchParams.get('pSize')!=='5')return false;validateSchoolQuery({name:u.searchParams.get('SCHUL_NM'),officeCode:u.searchParams.get('ATPT_OFCDC_SC_CODE')??''});return true;}catch{return false;}}
export async function searchNeisSchools(fetcher:SchoolFetch,query:SchoolQuery,signal:AbortSignal):Promise<SchoolCandidate[]>{
 const url=schoolSearchUrl(query);let response:Response|undefined;
 try{
  response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Accept:'application/json'}});
  if(signal.aborted)throw Error();
  if(!response.ok||response.redirected||response.url&&response.url!==url)throw new SchoolNetworkError('NEIS 학교 조회에 연결하지 못했습니다. 네트워크 또는 조회 한도를 확인해 주세요.');
  if(!response.headers.get('content-type')?.toLowerCase().includes('json'))throw Error();
  const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>1024*1024))throw Error();
  if(!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(signal.aborted)throw Error();if(part.done)break;size+=part.value.byteLength;if(size>1024*1024)throw Error();chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const data:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));if(!schoolObject(data))throw Error();
  if(schoolObject(data.RESULT)){if(data.RESULT.CODE==='INFO-200')return [];throw new SchoolNetworkError('NEIS 학교 조회가 거절됐습니다. 공개 API 한도·서비스 상태를 확인하고 다시 검색해 주세요.');}
  if(!Array.isArray(data.schoolInfo)||data.schoolInfo.length!==2)throw Error();const [head,body]=data.schoolInfo;
  if(!schoolObject(head)||!Array.isArray(head.head)||!head.head.some(h=>schoolObject(h)&&schoolObject(h.RESULT)&&h.RESULT.CODE==='INFO-000')||!schoolObject(body)||!Array.isArray(body.row)||body.row.length>5)throw Error();
  const seen=new Set<string>();return body.row.map((row:unknown)=>{
   if(!schoolObject(row))throw Error();const school=validateSchool({officeCode:row.ATPT_OFCDC_SC_CODE,officeName:row.ATPT_OFCDC_SC_NM,schoolCode:row.SD_SCHUL_CODE,schoolName:row.SCHUL_NM});
   if(query.officeCode&&school.officeCode!==query.officeCode||!Object.hasOwn(EDUCATION_OFFICES,school.officeCode)||seen.has(school.officeCode+school.schoolCode))throw Error();seen.add(school.officeCode+school.schoolCode);
   const safeLabel=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f<>]/.test(v)?v:'';
   return {school,kind:safeLabel(row.SCHUL_KND_SC_NM,50),location:safeLabel(row.ORG_RDNMA,200)};
  });
 }catch(error){if(signal.aborted)throw new SchoolNetworkError('학교 검색을 취소했거나 조회 시간이 초과되었습니다. 다시 검색해 주세요.');if(error instanceof SchoolNetworkError)throw error;throw new SchoolNetworkError('NEIS 학교 응답을 확인하지 못했습니다. 기존 학교 설정은 유지됩니다.');}
 finally{if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
}
