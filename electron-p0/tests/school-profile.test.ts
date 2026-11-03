import {it,expect,vi,expectTypeOf} from 'vitest';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {SchoolProfileStore,createSchoolHandlers} from '../main/school-profile';
import {searchNeisSchools,allowedSchoolUrl,schoolSearchUrl} from '../main/school-network';
import {validateSchoolDocument,validateSchoolQuery,EDUCATION_OFFICES,OFFICE_LAUNCHER_URLS,type SchoolInfo} from '../school-protocol';
import type {SchoolInfo as OriginalSchoolInfo} from '../../src/school-info/types';
const school:SchoolInfo={officeCode:'B10',officeName:'서울특별시교육청',schoolCode:'1000001',schoolName:'합성초등학교'};
const other:SchoolInfo={officeCode:'J10',officeName:'경기도교육청',schoolCode:'2000001',schoolName:'합성중학교'};
const query={name:'합성',officeCode:'' as const};
function response(schools=[school,other]){return new Response(JSON.stringify({schoolInfo:[{head:[{list_total_count:schools.length},{RESULT:{CODE:'INFO-000'}}]},{row:schools.map(s=>({ATPT_OFCDC_SC_CODE:s.officeCode,ATPT_OFCDC_SC_NM:s.officeName,SD_SCHUL_CODE:s.schoolCode,SCHUL_NM:s.schoolName,SCHUL_KND_SC_NM:'합성 학교유형',ORG_RDNMA:'합성 공개 소재지',PRIVATE_FIELD:'ignored'}))}]}),{headers:{'content-type':'application/json'}});}
async function setup(fetcher=vi.fn(async()=>response())){const root=await mkdtemp(join(tmpdir(),'school-contract-')),store=new SchoolProfileStore(root),frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic'},event={sender:contents,senderFrame:frame};const handlers=createSchoolHandlers(contents,contents.getURL(),{store,fetch:fetcher});return {root,store,contents,event,fetcher,handlers,cleanup:async()=>{handlers.dispose();await store.flush();await rm(root,{recursive:true,force:true});}};}
it('matches the existing BOGUNON school DTO and rejects unknown/auth fields',()=>{
 expectTypeOf<SchoolInfo>().toEqualTypeOf<OriginalSchoolInfo>();
 for(const input of [{version:1,revision:0,school:{...school,password:'synthetic'}},{version:1,revision:-1,school},{version:1,revision:0,school:{...school,officeCode:'Z99'}},{version:1,revision:0,school:{...school,schoolCode:'1'}},{version:1,revision:0,school,token:'synthetic'}])expect(()=>validateSchoolDocument(input)).toThrow();
 expect(Object.keys(EDUCATION_OFFICES)).toHaveLength(17);expect(Object.keys(OFFICE_LAUNCHER_URLS)).toEqual(Object.keys(EDUCATION_OFFICES));
 for(const urls of Object.values(OFFICE_LAUNCHER_URLS))expect(Object.keys(urls)).toEqual(['school','evpn']);
});
it('uses only the fixed public NEIS query, disallows URL/key/proxy/credential injection',async()=>{
 const url=schoolSearchUrl(query);expect(allowedSchoolUrl(url)).toBe(true);
 for(const value of [url.replace('open.neis.go.kr','evil.test'),url+'&KEY=private',url+'&SCHUL_NM=other',url.replace('https:','http:'),url.replace('schoolInfo','mealServiceDietInfo'),url+'#fragment',url.replace('pSize=5','pSize=1000'),url.replace('open.neis.go.kr','user:pass@open.neis.go.kr')])expect(allowedSchoolUrl(value)).toBe(false);
 for(const q of [{name:'합성',officeCode:'B10',url:'https://evil.test/'},{name:'합성',officeCode:'Z99'},{name:'a',officeCode:''},{name:'합성\n학교',officeCode:''}])expect(()=>validateSchoolQuery(q)).toThrow();
 const fetcher=vi.fn(async()=>response());const result=await searchNeisSchools(fetcher,query,new AbortController().signal);expect(result).toEqual([{school,kind:'합성 학교유형',location:'합성 공개 소재지'},{school:other,kind:'합성 학교유형',location:'합성 공개 소재지'}]);expect(fetcher.mock.calls[0]).toEqual([url,expect.objectContaining({method:'GET',redirect:'error',credentials:'omit',cache:'no-store'})]);expect(JSON.stringify(result)).not.toContain('PRIVATE_FIELD');
});
it('handles no-results, service rejection, corrupt JSON, redirects and oversized streaming safely',async()=>{
 const noData=()=>Promise.resolve(new Response(JSON.stringify({RESULT:{CODE:'INFO-200'}}),{headers:{'content-type':'application/json'}}));expect(await searchNeisSchools(noData,query,new AbortController().signal)).toEqual([]);
 const cases=[()=>new Response(JSON.stringify({RESULT:{CODE:'ERROR-300'}}),{headers:{'content-type':'application/json'}}),()=>new Response('broken',{headers:{'content-type':'application/json'}}),()=>new Response('private',{headers:{'content-type':'text/html'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'1048577'}}),()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(1048577));c.close();}}),{headers:{'content-type':'application/json'}}),()=>new Response('denied',{status:403})];
 for(const make of cases)await expect(searchNeisSchools(async()=>make(),query,new AbortController().signal)).rejects.toThrow();
 const redirected=response();Object.defineProperty(redirected,'redirected',{value:true});await expect(searchNeisSchools(async()=>redirected,query,new AbortController().signal)).rejects.toThrow();
 await expect(searchNeisSchools(async()=>response([other]),{...query,officeCode:'B10'},new AbortController().signal)).rejects.toThrow();
});
it('persists only an explicitly selected cached result and restores it without rewriting admin data',async()=>{
 const h=await setup();try{const admin=join(h.root,'unrelated-admin.json'),original='SYNTHETIC EXISTING ADMIN';await writeFile(admin,original);expect((await h.store.load()).document.school).toBeNull();const found=await h.handlers.search(h.event,query);expect(found.ok).toBe(true);if(!found.ok)throw Error();expect((await h.store.load()).document.school).toBeNull();
 const selected=await h.handlers.select(h.event,{searchId:found.data.searchId,schoolCode:school.schoolCode,officeCode:school.officeCode,expectedRevision:0});expect(selected).toMatchObject({ok:true,data:{document:{revision:1,school},bogunon:'unavailable'}});expect((await new SchoolProfileStore(h.root).load()).document.school).toEqual(school);expect(await readFile(admin,'utf8')).toBe(original);expect((await h.handlers.select(h.event,{searchId:found.data.searchId,schoolCode:school.schoolCode,officeCode:school.officeCode,expectedRevision:1})).ok).toBe(false);
 }finally{await h.cleanup();}
});
it('preserves primary bytes on write failure/CAS conflict and makes backup recovery readonly',async()=>{
 const h=await setup();try{await h.store.save(school,0);const before=await readFile(join(h.root,'school.json'));await expect(h.store.save(other,0)).rejects.toThrow();const failing=new SchoolProfileStore(h.root,async()=>{throw Error('synthetic EACCES');});await expect(failing.save(other,1)).rejects.toThrow();expect(await readFile(join(h.root,'school.json'))).toEqual(before);await h.store.save(other,1);expect(JSON.parse(await readFile(join(h.root,'school.backup.json'),'utf8')).school).toEqual(school);await writeFile(join(h.root,'school.json'),'SYNTHETIC CORRUPT');expect(await h.store.load()).toMatchObject({recovered:true,document:{school}});await expect(h.store.save(other,1)).rejects.toThrow();expect(await readFile(join(h.root,'school.json'),'utf8')).toBe('SYNTHETIC CORRUPT');
 }finally{await h.cleanup();}
});
it('denies foreign sender/frame, wrong arity, fabricated results, expired results and unsafe filesystem links',async()=>{
 const h=await setup();try{expect((await h.handlers.search({...h.event,sender:{}},query)).ok).toBe(false);expect((await h.handlers.search({...h.event,senderFrame:{}},query)).ok).toBe(false);expect((await h.handlers.load(h.event,'extra')).ok).toBe(false);expect(h.fetcher).not.toHaveBeenCalled();let clock=0;const handlers=createSchoolHandlers(h.contents,h.contents.getURL(),{store:h.store,fetch:h.fetcher,now:()=>clock});const found=await handlers.search(h.event,query);if(!found.ok)throw Error();const selection={searchId:found.data.searchId,schoolCode:school.schoolCode,officeCode:school.officeCode,expectedRevision:0};expect((await handlers.select(h.event,{...selection,schoolCode:'9999999'})).ok).toBe(false);expect((await handlers.select(h.event,{...selection,password:'synthetic'})).ok).toBe(false);clock=300001;expect((await handlers.select(h.event,selection)).ok).toBe(false);expect((await h.store.load()).document.school).toBeNull();handlers.dispose();
 const target=join(h.root,'target.json');await writeFile(target,'{}');await symlink(target,join(h.root,'school.json'));await expect(h.store.load()).rejects.toThrow();expect(await readFile(target,'utf8')).toBe('{}');
 }finally{await h.cleanup();}
});
it('aborts timeout/cancel, invalidates stale results, and exposes no successful empty fallback',async()=>{
 const h=await setup();try{let signal:AbortSignal|undefined;const handlers=createSchoolHandlers(h.contents,h.contents.getURL(),{store:h.store,timeoutMs:5,fetch:async(_url,init)=>{signal=init.signal as AbortSignal;return new Promise<Response>((_resolve,reject)=>{signal!.addEventListener('abort',()=>reject(Error('synthetic aborted')),{once:true});});}});expect(await handlers.search(h.event,query)).toMatchObject({ok:false,error:{message:expect.stringContaining('시간이 초과')}});expect(signal?.aborted).toBe(true);handlers.dispose();
 let release:((value:Response)=>void)|undefined;const stale=createSchoolHandlers(h.contents,h.contents.getURL(),{store:h.store,fetch:async()=>new Promise<Response>(resolve=>{release=resolve;})});const pending=stale.search(h.event,query);await stale.cancel(h.event);release!(response());expect((await pending).ok).toBe(false);stale.dispose();expect((await h.store.load()).document.school).toBeNull();
 }finally{await h.cleanup();}
});
