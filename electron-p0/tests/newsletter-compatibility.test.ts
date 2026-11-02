import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {parseStudioDocument,serializeStudioDocument} from '../../src/newsletter/studioDocument';
import {NewsletterCompatibilityError} from '../../src/newsletter/compatibility';
import {NEWSLETTER_COMPATIBILITY_MESSAGE} from '../protocol';
import {compatibilityFixture,rawClone} from './newsletter-compatibility-fixtures';
import {createNewsletterSaveHandler} from '../main/newsletter-json';import {NewsletterProjects} from '../main/newsletter-projects';
import {createProjectHandler} from '../main/newsletter-project-ipc';
import {validateStoredDocument} from '../renderer/export/stored-document';
import {attachApprovedMascot} from '../../src/newsletter/rendering/bundledMascot';
import {restoreDesignRevision,updateCardLayout,applyEditorialLayout} from '../../src/newsletter/rendering/designState';
const wc={mainFrame:{},getURL:()=> 'file:///guard'},event={sender:undefined as unknown,senderFrame:undefined as unknown};event.sender=wc;event.senderFrame=wc.mainFrame;
it.each([false,true])('keeps supported V1/V2 roundtrip and normal revision restore (%s)',async v2=>{
 const d=await compatibilityFixture(v2);expect(JSON.parse(serializeStudioDocument(parseStudioDocument(d)))).toEqual(d);
 if(d.design.designSchemaVersion===2){const changed=updateCardLayout(d.design,{cardIndex:1,patch:{background:'#ffffff'},now:'2026-11-02T00:00:01.000Z'});const restored=restoreDesignRevision(changed,{revision:2,now:'2026-11-02T00:00:02.000Z'});expect(parseStudioDocument({...d,design:restored}).design.designRevision).toBe(4);}
});
it('rejects arbitrary future fields at every supported structural level, without normalizing input',async()=>{
 const base=rawClone(await compatibilityFixture());const objects=[base,base.project,base.project.topics[0],base.project.canonicalCopy.sections[0],base.project.canonicalCopy.sections[0].aiGenerated,base.project.revisionHistory[0],base.project.revisionHistory[0].snapshot,base.project.cardLayouts[0],base.design,base.design.publicationMeta,base.design.cardLayouts[0],base.design.cardLayouts[0].image,base.design.cardLayouts[0].titleStyle,base.design.a4Layout.modules[0],base.design.revisionHistory[0],base.design.revisionHistory[0].snapshot,base.design.revisionHistory[1].snapshot.cardLayouts[2]];
 for(const target of objects){Object.assign(target,{arbitraryFutureElement:{value:false}});const original=JSON.stringify(base);expect(()=>parseStudioDocument(base)).toThrow(NewsletterCompatibilityError);expect(JSON.stringify(base)).toBe(original);delete (target as Record<string,unknown>).arbitraryFutureElement;}
 expect(()=>parseStudioDocument(base)).not.toThrow();
});
it.each(['officialTemplate','foregroundMask','referenceLayout','visualFinish'])('blocks unsupported current/history structures (%s)',async key=>{
 for(const history of [false,true]){const d=rawClone(await compatibilityFixture());if(d.design.designSchemaVersion!==2)throw Error();d.design=rawClone(applyEditorialLayout(d.design,{cardIndex:0,layoutType:'A',now:'2026-11-02T00:00:01.000Z'}));const card=(history?d.design.revisionHistory[1].snapshot:d.design).cardLayouts[0] as unknown as Record<string,unknown>;if(key==='officialTemplate')card[key]={visible:false,maskEnabled:false};else{card.editorial={layoutType:'A',studentComposition:'mixed',season:'none',[key]:key==='foregroundMask'?{assetId:'synthetic-mask',sha256:'a'.repeat(64),sourceWidth:100,sourceHeight:100,points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]}:true};}expect(()=>serializeStudioDocument(d)).toThrow(NEWSLETTER_COMPATIBILITY_MESSAGE);}
});
it('rejects enums and unknown versions, even in an old snapshot',async()=>{
 const cases=[(d:any)=>{d.design.cardLayouts[0].image.edgePolicy='feather';},(d:any)=>{d.design.revisionHistory[0].snapshot.cardLayouts[0].image.edgePolicy='feather';},(d:any)=>{d.design.designSchemaVersion=99;},(d:any)=>{d.design.revisionHistory[0].snapshotVersion=99;},(d:any)=>{d.project.cardLayouts[1].kind='future';}];
 for(const change of cases){const d=rawClone(await compatibilityFixture());change(d);expect(()=>parseStudioDocument(d)).toThrow(NewsletterCompatibilityError);}
});
it('keeps pending approvals, asset hashes and original JSON bytes; main save validates before any picker',async()=>{
 const d=await compatibilityFixture();if(d.design.designSchemaVersion!==2)throw Error();d.design=attachApprovedMascot(d.design,'2026-11-02T00:00:01.000Z');const original=serializeStudioDocument(d);expect(JSON.parse(original).design.assetManifest[0].exportApproval).toBe('pending');const manifest=rawClone(d.design.assetManifest);
 const bad=rawClone(d);Object.assign(bad.design.cardLayouts[0],{officialTemplate:{future:true}});const raw=JSON.stringify(bad);const dir=await mkdtemp(join(tmpdir(),'newsletter-guard-'));const path=join(dir,'original.json');await writeFile(path,raw);const before=createHash('sha256').update(await readFile(path)).digest('hex');
 try{const pick=vi.fn(async()=>path),confirm=vi.fn(async()=>true);const handler=createNewsletterSaveHandler(wc,wc.getURL(),{validate:async json=>{validateStoredDocument({json,barrier:{ids:[],hashes:[]}});},pick,confirm});expect(await handler(event,{json:raw})).toMatchObject({ok:false,error:{code:'INVALID_INPUT',message:NEWSLETTER_COMPATIBILITY_MESSAGE}});expect(pick).not.toHaveBeenCalled();expect(confirm).not.toHaveBeenCalled();expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(before);expect(await readdir(dir)).toEqual(['original.json']);expect(d.design.assetManifest).toEqual(manifest);expect(serializeStudioDocument(d)).toBe(original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('main project save/preview refuses incompatible data without adding or rewriting stored rows',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'newsletter-project-guard-'));const store=new NewsletterProjects(dir,async(json,barrier)=>validateStoredDocument({json,barrier}));const d=await compatibilityFixture(),json=serializeStudioDocument(d),id=d.project.projectId;const first=await store.save(json,{projectId:id,revision:0,hash:''});const path=join(dir,id+'.json');const before=await readFile(path);const bad=rawClone(d);Object.assign(bad.design.revisionHistory[0].snapshot.cardLayouts[0],{futureLayout:true});
 try{const handler=createProjectHandler('save',wc,wc.getURL(),store,async()=>true);expect(await handler(event,{document:JSON.stringify(bad),expected:first.head})).toMatchObject({ok:false,error:{code:'INVALID_INPUT',message:NEWSLETTER_COMPATIBILITY_MESSAGE}});expect(await readFile(path)).toEqual(before);expect((await store.history(id))).toHaveLength(1);expect(await store.load(id)).toEqual(first);
 }finally{await store.flush();await rm(dir,{recursive:true,force:true});}
});

it('incompatible stored load/preview returns a safe message and never rewrites the original file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'newsletter-future-store-'));const bad=rawClone(await compatibilityFixture());Object.assign(bad.design.revisionHistory[0].snapshot.cardLayouts[0],{futureLayout:{visible:false}});const id=bad.project.projectId;
 // Fixture-only writer simulates a file produced by a newer version. Product
 // save/load always uses the unchanged store with its real validation port.
 const seed=new NewsletterProjects(dir,async json=>json);await seed.save(JSON.stringify(bad),{projectId:id,revision:0,hash:''});await seed.flush();const before=await readFile(join(dir,id+'.json'));const guarded=new NewsletterProjects(dir,async(json,barrier)=>validateStoredDocument({json,barrier}));
 try{for(const [action,input] of [['load',{projectId:id}],['preview',{projectId:id,revision:1}]] as const){const confirm=vi.fn(async()=>true);const h=createProjectHandler(action,wc,wc.getURL(),guarded,confirm);expect(await h(event,input)).toMatchObject({ok:false,error:{code:'INVALID_INPUT',message:NEWSLETTER_COMPATIBILITY_MESSAGE}});expect(confirm).not.toHaveBeenCalled();expect(await readFile(join(dir,id+'.json'))).toEqual(before);}expect(await readdir(dir)).toEqual([id+'.json']);}finally{await guarded.flush();await rm(dir,{recursive:true,force:true});}
});
