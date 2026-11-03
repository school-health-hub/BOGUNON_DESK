import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEducationVideoExport} from '../main/education-video-export';
import {EducationVideoLibraryStore} from '../main/education-video-library';
import {writeSelectedExport} from '../main/purchase-export-storage';
import {parseLibrary} from '../../src/education-video/library';
const url='file:///p0',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
const item=(videoId:string)=>({videoId,title:'합성 손씻기',channelId:'mock',channelTitle:'합성 채널',durationSeconds:600,url:`https://www.youtube.com/watch?v=${videoId}`,source:'mock' as const,educationTitle:'합성 교육',target:'합성 대상',schedule:'이번 주',instructions:'확인',message:'합성 안내문',notes:'보호할 메모'});
async function setup(){const dir=await mkdtemp(join(tmpdir(),'finder-export-')),protectedRoot=join(dir,'profile'),root=join(protectedRoot,'work-data','education-video'),path=join(dir,'chosen.json'),store=new EducationVideoLibraryStore(root);await store.save(item('EVmock00001'));await store.save(item('EVmock00002'));const original=await readFile(join(root,'library.json')),backup=await readFile(join(root,'library.backup.json'));return {dir,protectedRoot,root,path,store,async preserved(){expect(await readFile(join(root,'library.json'))).toEqual(original);expect(await readFile(join(root,'library.backup.json'))).toEqual(backup);}};}
it('writes the selected JSON file atomically, round-trips the existing import contract and preserves source/backup',async()=>{
 const c=await setup();const handler=createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick:async()=>c.path,confirm:async()=>true});
 expect(await handler.handle(event)).toEqual({ok:true,data:{status:'saved',fileName:'chosen.json'}});
 const json=await readFile(c.path,'utf8');expect(Buffer.byteLength(json)).toBeGreaterThan(0);expect(parseLibrary(json).items).toHaveLength(2);
 const imported=new EducationVideoLibraryStore(join(c.dir,'imported'));expect((await imported.import(json)).library).toEqual((await c.store.load()).library);await c.preserved();
});
it('separates picker/overwrite cancellation and failed replacement without altering either source or existing target',async()=>{
 const c=await setup();await writeFile(c.path,'EXISTING');
 const run=(pick:()=>Promise<string|undefined>,confirm:()=>Promise<boolean>,write?:typeof writeSelectedExport)=>createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick,confirm,write}).handle(event);
 expect(await run(async()=>undefined,async()=>true)).toEqual({ok:true,data:{status:'canceled'}});
 expect(await run(async()=>c.path,async()=>false)).toEqual({ok:true,data:{status:'canceled'}});
 const denied:typeof writeSelectedExport=(p,f,b,confirm,fresh)=>writeSelectedExport(p,f,b,confirm,fresh,async()=>{throw Object.assign(Error('private path'),{code:'EACCES'});});
 const result=await run(async()=>c.path,async()=>true,denied);expect(result).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});expect(JSON.stringify(result)).not.toContain('private path');
 expect(await readFile(c.path,'utf8')).toBe('EXISTING');expect((await readdir(c.dir)).filter(f=>f.endsWith('.tmp'))).toEqual([]);await c.preserved();
});
it('rejects forged callers, renderer paths/arity, wrong extensions and internal source/backup destinations',async()=>{
 const c=await setup(),pick=vi.fn(async()=>c.path);const h=createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick,confirm:async()=>true});
 for(const caller of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}}])expect(await h.handle(caller)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(await h.handle(event,{path:c.path})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(pick).not.toHaveBeenCalled();
 for(const path of [join(c.dir,'wrong.csv'),'relative.json',join(c.root,'library.json'),join(c.root,'library.backup.json'),join(c.protectedRoot,'settings.json')]){const result=await createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick:async()=>path,confirm:async()=>true}).handle(event);expect(result).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});}
 await c.preserved();
});
it('detects external edits and does not publish a late target chosen after window disposal',async()=>{
 const c=await setup();await writeFile(c.path,'ORIGINAL');
 const conflict=createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick:async()=>c.path,confirm:async()=>{await writeFile(c.path,'EXTERNAL');return true;}});
 expect(await conflict.handle(event)).toMatchObject({ok:false,error:{code:'CONFLICT'}});expect(await readFile(c.path,'utf8')).toBe('EXTERNAL');
 let choose!:(p:string)=>void;const pick=vi.fn(()=>new Promise<string>(r=>{choose=r;}));const write=vi.fn(writeSelectedExport);const h=createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick,confirm:async()=>true,write});
 const pending=h.handle(event);await vi.waitFor(()=>expect(pick).toHaveBeenCalled());expect(await h.handle(event)).toMatchObject({ok:false});h.dispose();choose(c.path);expect(await pending).toEqual({ok:true,data:{status:'canceled'}});expect(write).not.toHaveBeenCalled();await h.flush();await c.preserved();
});
it('keeps near-limit libraries importable by omitting optional JSON whitespace',async()=>{
 const c=await setup(),pick=vi.fn(async()=>c.path);const library={version:1,items:Array.from({length:1000},(_,i)=>({...item(`EVmock${String(i).padStart(5,'0')}`),notes:'x'.repeat(850),message:'x'.repeat(850)}))};
 expect(Buffer.byteLength(JSON.stringify(library))).toBeLessThanOrEqual(2*1024*1024);expect(Buffer.byteLength(JSON.stringify(library,null,2))).toBeGreaterThan(2*1024*1024);
 const exportSpy=vi.spyOn(c.store,'export').mockResolvedValue(JSON.stringify(library));
 expect(await createEducationVideoExport(wc,url,c.store,{protectedRoot:c.protectedRoot,pick,confirm:async()=>true}).handle(event)).toMatchObject({ok:true,data:{status:'saved'}});const json=await readFile(c.path,'utf8');expect(Buffer.byteLength(json)).toBeLessThanOrEqual(2*1024*1024);expect(parseLibrary(json).items).toHaveLength(1000);exportSpy.mockRestore();await c.preserved();
});
