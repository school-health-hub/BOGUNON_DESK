import {afterEach,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {EDUCATION_OFFICES,OFFICE_LAUNCHER_URLS,type SchoolInfo} from '../school-protocol';
import {SCHOOL_SESSION_GUIDE,schoolAddressPreview,validateSchoolAddressApply,withSchoolAddresses} from '../school-launcher';
import {adminAddresses,emptyAdmin,safeAdminLaunchUrl,type LeaveDraft} from '../admin-protocol';
import {SchoolProfileStore} from '../main/school-profile';import {AdminStore} from '../main/admin-store';import {createAdminHandlers,type AdminPorts} from '../main/admin-ipc';
const school:SchoolInfo={officeCode:'B10',officeName:'서울특별시교육청',schoolCode:'1000001',schoolName:'합성학교'};
const draft:LeaveDraft={id:'synthetic',system:'neis',kind:'연가',startDate:'2026-11-05',endDate:'2026-11-05',startTime:'09:00',endTime:'18:00',reason:'합성',text:'보존할 합성 원고'};
const roots:string[]=[];afterEach(async()=>{vi.restoreAllMocks();for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'school-address-'));roots.push(root);const profile=new SchoolProfileStore(join(root,'school'));await profile.save(school,0);const store=new AdminStore(join(root,'admin'));
 await store.save({...emptyAdmin(),systems:{portal:'https://custom.eduptl.kr/',neis:'',edufine:''},launcher:{environment:'school',evpn:{portal:'https://custom-remote.eduptl.kr/',neis:'',edufine:''}},drafts:[draft]},0);
 const frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic'},event={sender:contents,senderFrame:frame},review=vi.fn(async(_message:string,_detail:string)=>true),openExternal=vi.fn(async()=>{}),inspect=vi.fn();
 const ports:AdminPorts={store,schoolProfile:()=>profile.load(),school:async()=>(await profile.load()).document.school,protectedRoot:root,excel:{table:vi.fn(),review:vi.fn()},review,openExternal,inspect,copy:vi.fn(),pick:async()=>undefined,save:async()=>undefined};
 const handlers=createAdminHandlers(contents,contents.getURL(),ports),request={officeCode:'B10',schoolCode:'1000001',expectedRevision:1,environment:'school' as const,systems:['neis','evpn']};
 return {root,store,profile,contents,event,review,openExternal,inspect,ports,handlers,request};
}
it('keeps all 17 explicit office mappings verbatim and distinguishes missing/Gangwon K-Edufine and unverified sources',()=>{
 const expected=[['B10','sen'],['C10','pen'],['D10','dge'],['E10','ice'],['F10','gen'],['G10','dje'],['H10','use'],['I10','sje'],['J10','goe'],['K10','kwe'],['M10','cbe'],['N10','cne'],['P10','jbe'],['Q10','jne'],['R10','gbe'],['S10','gne'],['T10','jje']];
 expect(Object.keys(EDUCATION_OFFICES)).toEqual(expected.map(([code])=>code));const all=new Set<string>();
 for(const [code,prefix] of expected){const both=OFFICE_LAUNCHER_URLS[code as keyof typeof OFFICE_LAUNCHER_URLS];for(const environment of ['school','evpn'] as const){const urls=both[environment];expect(urls.portal?.url).toBe(`https://${prefix}.eduptl.kr`);expect(urls.neis?.url).toBe(`https://${prefix}.neis.go.kr`);expect(urls.evpn?.url).toBe(code==='R10'?'https://evpn.gbe.kr':`https://evpn.${prefix}.go.kr`);expect(urls.edufine?.url).toBe(code==='K10'?'https://klefedu.gwe.go.kr/':undefined);for(const value of Object.values(urls)){expect(safeAdminLaunchUrl(value!.url)).toBe(new URL(value!.url).href);expect(value!.evidence).toBeTruthy();}expect(urls.portal?.verification).toBe('needs-official-confirmation');}all.add(both.school.portal!.url);}
 expect(all.size).toBe(17);expect(OFFICE_LAUNCHER_URLS.K10.school.edufine?.verification).toBe('needs-official-confirmation');expect(()=>schoolAddressPreview({...school,officeCode:'Z99'},emptyAdmin())).toThrow();
 expect(SCHOOL_SESSION_GUIDE).toContain('쿠키·세션을 공유하지 않습니다');
});
it('does not write on preview, and applies only explicitly selected Main-owned URLs while preserving school, drafts and the other environment',async()=>{
 const h=await setup(),before=await readFile(join(h.root,'admin','admin.json')),schoolBytes=await readFile(join(h.root,'school','school.json'));
 expect(await h.handlers.schoolAddresses(h.event)).toMatchObject({ok:true,data:{school,environment:'school',revision:1,entries:expect.arrayContaining([{system:'edufine',currentUrl:'',proposed:null}])}});expect(await readFile(join(h.root,'admin','admin.json'))).toEqual(before);expect(h.review).not.toHaveBeenCalled();
 const result=await h.handlers.applySchoolAddresses(h.event,h.request);expect(result).toMatchObject({ok:true,data:{document:{revision:2,systems:{portal:'https://custom.eduptl.kr/',neis:'https://sen.neis.go.kr/',edufine:''},drafts:[draft]}}});const restored=(await new AdminStore(join(h.root,'admin')).load()).document;
 expect(restored.launcher?.evpn.portal).toBe('https://custom-remote.eduptl.kr/');expect(restored.launcher?.entryUrl).toBe('https://evpn.sen.go.kr/');expect(restored.templates).toEqual(emptyAdmin().templates);expect(await readFile(join(h.root,'school','school.json'))).toEqual(schoolBytes);expect(await readFile(join(h.root,'admin','admin.backup.json'))).toEqual(before);
 expect(h.review.mock.calls[0]![1]).toContain('공식 최신성 미확인 초기값');expect(h.openExternal).not.toHaveBeenCalled();expect(h.inspect).not.toHaveBeenCalled();h.handlers.dispose();
});
it('requires confirmation even when replacing a registered address, and preserves bytes on cancellation or failure',async()=>{
 const h=await setup(),before=await readFile(join(h.root,'admin','admin.json'));h.review.mockResolvedValueOnce(false);expect(await h.handlers.applySchoolAddresses(h.event,{...h.request,systems:['portal']})).toEqual({ok:true,data:null});expect(await readFile(join(h.root,'admin','admin.json'))).toEqual(before);expect(h.review.mock.calls[0]![1]).toContain('https://custom.eduptl.kr/ → https://sen.eduptl.kr');
 const failing=createAdminHandlers(h.contents,h.contents.getURL(),{...h.ports,store:new AdminStore(join(h.root,'admin'),async()=>{throw Error('synthetic write denied');})});expect(await failing.applySchoolAddresses(h.event,h.request)).toMatchObject({ok:false});expect(await readFile(join(h.root,'admin','admin.json'))).toEqual(before);failing.dispose();h.handlers.dispose();
});
it('rejects unknown offices, absent mappings, URL/auth injection, forged IPC, and stale revisions/environments',async()=>{
 const h=await setup();for(const patch of [{officeCode:'Z99'},{schoolCode:'9999999'},{systems:['edufine']},{systems:[]},{systems:['portal','portal']},{expectedRevision:0},{environment:'evpn'},{url:'https://evil.test/'},{password:'synthetic'},{systems:['__proto__']}])expect(await h.handlers.applySchoolAddresses(h.event,{...h.request,...patch})).toMatchObject({ok:false});
 expect(await h.handlers.schoolAddresses(h.event,'extra')).toMatchObject({ok:false});expect(await h.handlers.applySchoolAddresses({...h.event,senderFrame:{}},h.request)).toMatchObject({ok:false});expect(h.review).not.toHaveBeenCalled();expect((await h.store.load()).document.revision).toBe(1);
 expect(()=>validateSchoolAddressApply({...h.request,path:'/tmp/forged'})).toThrow();const preview=schoolAddressPreview(school,emptyAdmin());expect(()=>withSchoolAddresses(emptyAdmin(),preview,['edufine'])).toThrow();for(const url of ['javascript:alert(1)','file:///private','https://sen.eduptl.kr.evil.test/','https://sen.eduptl.kr/?token=secret'])expect(()=>safeAdminLaunchUrl(url)).toThrow();h.handlers.dispose();
});
it('rechecks school and revision during confirmation and immediately before commit',async()=>{
 const h=await setup(),before=await readFile(join(h.root,'admin','admin.json'));h.review.mockImplementationOnce(async()=>{await h.profile.save({...school,officeCode:'J10',schoolCode:'2000001'},1);return true;});expect(await h.handlers.applySchoolAddresses(h.event,h.request)).toMatchObject({ok:false,error:{code:'CONFLICT'}});expect(await readFile(join(h.root,'admin','admin.json'))).toEqual(before);
 await h.profile.save(school,2);h.review.mockImplementationOnce(async()=>{await h.store.setEnvironment('evpn',1);return true;});expect(await h.handlers.applySchoolAddresses(h.event,h.request)).toMatchObject({ok:false,error:{code:'CONFLICT'}});expect(adminAddresses((await h.store.load()).document,'school').neis).toBe('');
 let guarded=false;const latest=(await h.store.load()).document;await expect(h.store.save({...latest,systems:{...latest.systems,neis:'https://sen.neis.go.kr/'}},latest.revision,async()=>{guarded=true;throw Error('canceled before write');})).rejects.toThrow();expect(guarded).toBe(true);expect(adminAddresses((await h.store.load()).document,'school').neis).toBe('');h.handlers.dispose();
});
it('blocks recovered stores and cancel/duplicate requests without touching existing data',async()=>{
 const h=await setup(),before=await readFile(join(h.root,'admin','admin.json'));let release!:(v:boolean)=>void;h.review.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const pending=h.handlers.applySchoolAddresses(h.event,h.request);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));expect(await h.handlers.applySchoolAddresses(h.event,h.request)).toMatchObject({ok:false});await h.handlers.cancel(h.event);release(true);expect(await pending).toMatchObject({ok:false});expect(await readFile(join(h.root,'admin','admin.json'))).toEqual(before);
 await writeFile(join(h.root,'admin','admin.backup.json'),before);await writeFile(join(h.root,'admin','admin.json'),'SYNTHETIC CORRUPT');expect(await h.handlers.schoolAddresses(h.event)).toMatchObject({ok:true,data:{readonly:true}});expect(await h.handlers.applySchoolAddresses(h.event,h.request)).toMatchObject({ok:false});expect(await readFile(join(h.root,'admin','admin.json'),'utf8')).toBe('SYNTHETIC CORRUPT');h.handlers.dispose();
});
