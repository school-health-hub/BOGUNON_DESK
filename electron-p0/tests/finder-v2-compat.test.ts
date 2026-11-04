import {afterEach,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rm,readdir,symlink} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import ts from 'typescript';import {runInNewContext} from 'node:vm';
import {EducationVideoLibraryStore,FinderLibraryConflict} from '../main/education-video-library';
import {validateLibraryV2} from '../main/finder-v2/validate';
import {createFinderCompatHandlers,parseFinderImport,readSelectedFinderJson} from '../main/finder-compat-ipc';
import {createEducationVideoExport} from '../main/education-video-export';
import type {LibraryV2} from '../finder-v2-protocol';
import type {EducationVideoLibrary} from '../protocol';
const v1=():EducationVideoLibrary=>JSON.parse(readFileSync('electron-p0/tests/fixtures/finder-v2/electron-v1.json','utf8'));
const v2=():LibraryV2=>JSON.parse(readFileSync('electron-p0/tests/fixtures/finder-v2/tauri-v2.json','utf8'));
const roots:string[]=[];async function root(){const p=await mkdtemp(join(tmpdir(),'finder-v2-'));roots.push(p);return p;}
afterEach(async()=>{vi.restoreAllMocks();for(const p of roots.splice(0))await rm(p,{recursive:true,force:true});});
const url='file:///qa',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
async function importV2(store:EducationVideoLibraryStore,library=v2()){return store.importReviewed(library,library.entries.map(e=>e.videoId),(await store.snapshot()).fingerprint);}
it('round-trips existing V1 mock/youtube JSON and keeps its on-disk schema unchanged alongside V2',async()=>{
 const dir=await root(),store=new EducationVideoLibraryStore(dir);await store.import(JSON.stringify(v1()));const before=await readFile(join(dir,'library.json'));
 expect(JSON.parse(await store.export())).toEqual(v1());await importV2(store);expect(await readFile(join(dir,'library.json'))).toEqual(before);expect(JSON.parse(await store.export())).toEqual(v1());
 expect((await new EducationVideoLibraryStore(dir).loadV2()).library).toEqual(v2());expect(JSON.parse(await new EducationVideoLibraryStore(dir).exportV2())).toEqual(v2());
});
it('preserves all teacher/provider/AI/candidate/reason fields with null provider and no invented duration',async()=>{
 expect(validateLibraryV2(v2())).toEqual(v2());const store=new EducationVideoLibraryStore(await root());await importV2(store);const loaded=(await store.loadV2()).library;
 expect(loaded.entries[0].provider?.durationSeconds).toBeNull();expect(loaded.entries[1].provider).toBeNull();expect(loaded.entries[0].ai).toEqual(v2().entries[0].ai);expect(loaded.entries[0].candidateRecord).toEqual(v2().entries[0].candidateRecord);
});
it('preserves legacy AI optional-field absence and native nullable optional fields without normalization',()=>{
 const d=JSON.parse(JSON.stringify(v2()));delete d.entries[0].ai.provenance;delete d.entries[0].ai.metadataVerification;delete d.entries[0].candidateRecord;
 d.entries[1].ai=null;d.entries[1].candidateRecord=null;d.entries[1].recommendationReason=null;expect(validateLibraryV2(d)).toEqual(d);expect(Object.keys(validateLibraryV2(d).entries[0].ai!)).not.toContain('provenance');
});
it('retains expired metadata and source claims as imported records rather than silently deleting/rewriting them',()=>{
 const d=JSON.parse(JSON.stringify(v2()));d.entries[0].provider.fetchedAt='2025-01-01T00:00:00.000Z';d.entries[0].provider.expiresAt='2025-01-20T00:00:00.000Z';
 expect(validateLibraryV2(d)).toEqual(d);expect(validateLibraryV2(d).entries[0].provider).not.toBeNull();
});
it.each(['root','entry','teacher','provider','ai','source','candidateRecord','verification','recommendationReason'])('rejects unsupported %s fields without dropping them',level=>{
 const d=JSON.parse(JSON.stringify(v2())),e=d.entries[0];
 const target=level==='root'?d:level==='entry'?e:level==='source'?e.ai.sources[0]:level==='verification'?e.candidateRecord.metadataVerification:e[level];target.unsupported='not silently lost';expect(()=>parseFinderImport(JSON.stringify(d))).toThrow();
});
it('rejects corrupt/unknown versions, duplicate IDs, bad URLs, incomplete/oversized data and inconsistent facts',()=>{
 const d=v2(),e=d.entries[0];
 for(const value of [{version:3,entries:[]},{...d,entries:[e,e]},{...d,entries:[{...e,teacher:{notes:'incomplete'}}]},{...d,entries:[{...e,teacher:{...e.teacher,notes:'x'.repeat(20001)}}]},{...d,entries:[{...e,provider:{...e.provider,url:'https://example.invalid/watch?v='+e.videoId}}]},{...d,entries:[{...e,provider:{...e.provider,url:'https://www.youtube.com/watch?v=FVsyn000099'}}]},{...d,entries:[{...e,candidateRecord:{...e.candidateRecord,title:'not the AI title'}}]},{...d,entries:[{...e,ai:{...e.ai,needsReview:false}}]}])expect(()=>parseFinderImport(JSON.stringify(value))).toThrow();
 expect(()=>parseFinderImport('{broken')).toThrow();expect(()=>parseFinderImport(' '.repeat(2*1024*1024+1))).toThrow();
});
it('previews cross-version collisions, applies only selected new rows, and preserves all existing V1 bytes',async()=>{
 const dir=await root(),store=new EducationVideoLibraryStore(dir);await store.save({...v1().items[0],videoId:v2().entries[0].videoId,url:v2().entries[0].provider!.url});const before=await readFile(join(dir,'library.json'));
 const h=createFinderCompatHandlers(wc,url,store,{pick:async()=>'/selected.json',read:async()=>JSON.stringify(v2())});const result=await h.prepareImport(event);expect(result.ok).toBe(true);if(!result.ok||!result.data)throw Error();
 const preview=result.data;expect(preview.rows.map(e=>e.conflict)).toEqual([true,false]);expect((await store.loadV2()).library.entries).toEqual([]);
 expect(await h.applyImport(event,{token:preview.token,selectedIds:[v2().entries[0].videoId]})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
 expect(await h.applyImport(event,{token:preview.token,selectedIds:[v2().entries[1].videoId]})).toMatchObject({ok:true,data:{added:1,skipped:1}});expect(await readFile(join(dir,'library.json'))).toEqual(before);expect((await store.loadV2()).library.entries).toEqual([v2().entries[1]]);
});
it('imports selected V1 rows through the Main picker/review path without creating a V2 file',async()=>{
 const dir=await root(),store=new EducationVideoLibraryStore(dir);await store.save(v1().items[0]);
 const h=createFinderCompatHandlers(wc,url,store,{pick:async()=>'/chosen-v1.json',read:async()=>JSON.stringify(v1())});const p=await h.prepareImport(event);if(!p.ok||!p.data)throw Error();expect(p.data.version).toBe(1);expect(p.data.rows.map(r=>r.conflict)).toEqual([true,false]);
 expect(await h.applyImport(event,{token:p.data.token,selectedIds:[v1().items[1].videoId]})).toMatchObject({ok:true,data:{added:1,skipped:1}});expect(JSON.parse(await store.export())).toEqual(v1());expect((await store.loadV2()).library.entries).toEqual([]);expect(await readdir(dir)).not.toContain('library-v2.json');
});
it('cancels preview/late picker results and rejects unknown, stale or expired tokens without touching disk',async()=>{
 const dir=await root(),store=new EducationVideoLibraryStore(dir);let time=Date.now();const h=createFinderCompatHandlers(wc,url,store,{pick:async()=>'/selected.json',read:async()=>JSON.stringify(v2()),now:()=>time});
 const p=await h.prepareImport(event);if(!p.ok||!p.data)throw Error();await h.discardImport(event);expect(await h.applyImport(event,{token:p.data.token,selectedIds:[v2().entries[0].videoId]})).toMatchObject({ok:false});expect((await store.loadV2()).library.entries).toEqual([]);
 const next=await h.prepareImport(event);if(!next.ok||!next.data)throw Error();time+=11*60*1000;expect(await h.applyImport(event,{token:next.data.token,selectedIds:[v2().entries[0].videoId]})).toMatchObject({ok:false});expect(await readdir(dir)).toEqual([]);
 let resolve!:(path:string)=>void;const late=createFinderCompatHandlers(wc,url,store,{pick:()=>new Promise(r=>{resolve=r;})});const pending=late.prepareImport(event);late.dispose();expect(await pending).toEqual({ok:true,data:null});resolve('/late.json');expect(await readdir(dir)).toEqual([]);
});
it('rejects concurrent changes made after preview and serializes independent V1 saves',async()=>{
 const store=new EducationVideoLibraryStore(await root()),h=createFinderCompatHandlers(wc,url,store,{pick:async()=>'/selected.json',read:async()=>JSON.stringify(v2())});const p=await h.prepareImport(event);if(!p.ok||!p.data)throw Error();
 await Promise.all(v1().items.map(i=>store.save(i)));expect((await store.load()).library.items).toHaveLength(2);
 expect(await h.applyImport(event,{token:p.data.token,selectedIds:[v2().entries[0].videoId]})).toMatchObject({ok:false,error:{code:'CONFLICT'}});expect((await store.loadV2()).library.entries).toEqual([]);
});
it('keeps V2-only data when a V1 save/import has the same ID',async()=>{
 const store=new EducationVideoLibraryStore(await root());await importV2(store);const e=v2().entries[0],item={...v1().items[0],videoId:e.videoId,url:e.provider!.url};
 await expect(store.save(item)).rejects.toBeInstanceOf(FinderLibraryConflict);await store.import(JSON.stringify({version:1,items:[item]}));expect((await store.load()).library.items).toEqual([]);expect((await store.loadV2()).library).toEqual(v2());
});
it('edits teacher/recommendation/facts without changing source metadata, other rows or the V1 working library',async()=>{
 const dir=await root(),store=new EducationVideoLibraryStore(dir);await store.import(JSON.stringify(v1()));await importV2(store);const before=await readFile(join(dir,'library.json')),old=await store.loadV2(),entry=old.library.entries[0];
 const saved=await store.editV2({videoId:entry.videoId,expectedFingerprint:old.fingerprint,teacher:{...entry.teacher,notes:'합성 수정 메모'},recommendationReason:{status:'teacher-edited',text:'합성 교사 수정 추천'}});
 expect(saved.library.entries[0]).toEqual({...entry,teacher:{...entry.teacher,notes:'합성 수정 메모'},recommendationReason:{status:'teacher-edited',text:'합성 교사 수정 추천'}});expect(saved.library.entries[1]).toEqual(old.library.entries[1]);expect(await readFile(join(dir,'library.json'))).toEqual(before);
 const record={...entry.candidateRecord!,title:'합성 교사 재확인 제목'};const reviewed=await store.editV2({videoId:entry.videoId,expectedFingerprint:saved.fingerprint,teacher:saved.library.entries[0].teacher,candidateRecord:record});
 expect(reviewed.library.entries[0].ai?.title).toBe(record.title);expect(reviewed.library.entries[0].provider).toEqual(entry.provider);expect(reviewed.library.entries[0].ai?.needsReview).toBe(true);
 await expect(store.editV2({videoId:entry.videoId,expectedFingerprint:old.fingerprint,teacher:entry.teacher})).rejects.toBeInstanceOf(FinderLibraryConflict);
});
it('keeps primary/backup bytes on failed V2 writes and blocks writes after corrupt/version-mismatched originals',async()=>{
 const dir=await root(),store=new EducationVideoLibraryStore(dir);await importV2(store);const before=await readFile(join(dir,'library-v2.json')),old=await store.loadV2();
 const denied=new EducationVideoLibraryStore(dir,async()=>{throw Error('synthetic denied');});await expect(denied.editV2({videoId:old.library.entries[0].videoId,expectedFingerprint:old.fingerprint,teacher:{...old.library.entries[0].teacher,notes:'not saved'}})).rejects.toThrow();expect(await readFile(join(dir,'library-v2.json'))).toEqual(before);
 await writeFile(join(dir,'library-v2.json'),'{broken');const recovered=await store.loadV2();expect(recovered.recovered).toBe(true);await expect(store.importReviewed(v2(),[v2().entries[0].videoId],recovered.fingerprint)).rejects.toThrow();expect(await readFile(join(dir,'library-v2.json'),'utf8')).toBe('{broken');
 await writeFile(join(dir,'library-v2.json'),JSON.stringify({version:99,entries:[]}));expect((await store.loadV2()).recovered).toBe(true);expect((await readdir(dir)).some(n=>n.endsWith('.tmp'))).toBe(false);
});
it('validates only explicitly chosen bounded JSON files and refuses symlinked source/store files',async()=>{
 const dir=await root(),path=join(dir,'chosen.json');await writeFile(path,JSON.stringify(v2()));expect(parseFinderImport(await readSelectedFinderJson(path))).toEqual(v2());
 const link=join(dir,'link.json');await symlink(path,link);await expect(readSelectedFinderJson(link)).rejects.toThrow();await writeFile(join(dir,'wrong.csv'),'{}');await expect(readSelectedFinderJson(join(dir,'wrong.csv'))).rejects.toThrow();
 const storeRoot=await root();await symlink(path,join(storeRoot,'library-v2.json'));await expect(new EducationVideoLibraryStore(storeRoot).loadV2()).rejects.toThrow();expect(JSON.parse(await readFile(path,'utf8'))).toEqual(v2());
});
it('exports V2 through the existing Main writer and preserves all data on dialog cancellation/write failure',async()=>{
 const dir=await root(),protectedRoot=join(dir,'profile'),store=new EducationVideoLibraryStore(protectedRoot);await importV2(store);const target=join(dir,'chosen-v2.json');
 const h=createEducationVideoExport(wc,url,store,{version:2,protectedRoot,pick:async()=>target,confirm:async()=>true});expect(await h.handle(event)).toMatchObject({ok:true,data:{status:'saved'}});expect(JSON.parse(await readFile(target,'utf8'))).toEqual(v2());
 const canceled=createEducationVideoExport(wc,url,store,{version:2,protectedRoot,pick:async()=>undefined,confirm:async()=>true});expect(await canceled.handle(event)).toMatchObject({ok:true,data:{status:'canceled'}});expect(JSON.parse(await store.exportV2())).toEqual(v2());
 const denied=createEducationVideoExport(wc,url,store,{version:2,protectedRoot,pick:async()=>target,confirm:async()=>true,write:async()=>{throw Error('synthetic denied');}});expect(await denied.handle(event)).toMatchObject({ok:false});expect(JSON.parse(await readFile(target,'utf8'))).toEqual(v2());
});
it('denies forged frames, paths/extra arguments and raw preload access while retaining search and V1 methods',async()=>{
 const pick=vi.fn(async()=>undefined),h=createFinderCompatHandlers(wc,url,new EducationVideoLibraryStore(await root()),{pick});
 expect(await h.prepareImport({...event,sender:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.prepareImport({...event,senderFrame:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.prepareImport(event,{path:'forged'})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(pick).not.toHaveBeenCalled();
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:null})),code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error();return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.educationVideo.compat;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api)).toEqual(['loadV2','prepareImport','applyImport','discardImport','editV2','exportV2File']);await api.prepareImport('forged path');expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:compat:prepareImport']);await api.applyImport({token:'qa',selectedIds:[]});expect(invoke.mock.calls.at(-1)).toEqual(['p2:education-video:compat:applyImport',{token:'qa',selectedIds:[]}]);expect(api.invoke).toBeUndefined();expect(exposed.electronWork.educationVideo.searchProvider).toBeTruthy();
});
