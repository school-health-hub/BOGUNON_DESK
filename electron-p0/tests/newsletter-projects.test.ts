import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,symlink,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const fault=vi.hoisted(()=>({rename:false}));
vi.mock('node:fs/promises',async original=>{const real=await original<typeof import('node:fs/promises')>();return {...real,rename:async(...args:Parameters<typeof real.rename>)=>{if(fault.rename&&String(args[1]).endsWith('synthetic-project.json'))throw Error('SYNTHETIC RENAME FAILURE');return real.rename(...args);}};});
import {NewsletterProjects,ProjectConflict} from '../main/newsletter-projects';
import {createProjectHandler} from '../main/newsletter-project-ipc';
import {validateStoredDocument} from '../renderer/export/stored-document';
import {createNewsletterProject} from '../../src/newsletter/project';import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';import {upgradeNewsletterDesignStateV2} from '../../src/newsletter/rendering/designState';
const now='2026-10-30T00:00:00.000Z',id='synthetic-project',empty={projectId:id,revision:0,hash:''};
async function fixture(){const project=await createNewsletterProject({projectId:id,title:'합성 원고',now});return JSON.stringify({project,design:upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:id,canonicalProjectRevision:1,now}),now)});}
const make=(root:string)=>new NewsletterProjects(root,async(json,barrier)=>validateStoredDocument({json,barrier}));
const dir=()=>mkdtemp(join(tmpdir(),'newsletter-projects-'));
it('creates, reloads, previews without mutation and appends a confirmed restore revision',async()=>{
 const root=await dir(),store=make(root),first=await store.save(await fixture(),empty),changed=JSON.parse(first.document);changed.project.title='합성 수정';const second=await store.save(JSON.stringify(changed),first.head);
 const path=join(root,id+'.json'),bytes=await readFile(path,'utf8'),p=await store.preview(id,1);expect(p.document).toBe(first.document);expect(await readFile(path,'utf8')).toBe(bytes);
 expect(await store.restore(p.token,p.head,async()=>false)).toEqual({restored:false});expect(await readFile(path,'utf8')).toBe(bytes);
 const next=await store.preview(id,1),restored=await store.restore(next.token,next.head,async info=>{expect(info).toEqual({projectId:id,sourceRevision:1,currentRevision:2});return true;});
 expect(restored.record?.head.revision).toBe(3);expect(restored.record?.document).toBe(first.document);expect((await store.history(id)).map(r=>[r.revision,r.restoredFrom])).toEqual([[1,undefined],[2,undefined],[3,1]]);
 expect(await make(root).load(id)).toEqual(restored.record);expect(second.head.revision).toBe(2);expect(await store.list()).toEqual([id]);
});
it('rejects stale/concurrent saves and stale preview tokens while preserving the newer head',async()=>{
 const root=await dir(),store=make(root),first=await store.save(await fixture(),empty);
 const results=await Promise.allSettled([store.save(first.document,first.head),store.save(first.document,first.head)]);expect(results.map(r=>r.status)).toEqual(['fulfilled','rejected']);expect(results[1].status==='rejected'&&results[1].reason).toBeInstanceOf(ProjectConflict);
 const p=await store.preview(id,1),current=await store.load(id),newer=await store.save(current.document,current.head),before=await readFile(join(root,id+'.json'),'utf8');
 await expect(store.restore(p.token,p.head,async()=>true)).rejects.toBeInstanceOf(ProjectConflict);expect(await readFile(join(root,id+'.json'),'utf8')).toBe(before);expect((await store.load(id)).head).toEqual(newer.head);
});
it('retains good revisions on write failure and rejects damaged history without automatic recovery',async()=>{
 const root=await dir(),store=make(root),first=await store.save(await fixture(),empty),path=join(root,id+'.json'),before=await readFile(path,'utf8');
 fault.rename=true;try{await expect(store.save(first.document,first.head)).rejects.toThrow();expect(await readFile(path,'utf8')).toBe(before);expect(await readdir(root)).toEqual([id+'.json']);}finally{fault.rename=false;}
 const file=JSON.parse(before);file.rows[0].document='CORRUPT';await writeFile(path,JSON.stringify(file));const corrupt=await readFile(path,'utf8');
 await expect(store.load(id)).rejects.toThrow();await expect(store.preview(id,1)).rejects.toThrow();await expect(store.save(first.document,first.head)).rejects.toThrow();expect(await readFile(path,'utf8')).toBe(corrupt);
});
it('detects an external valid change during restore confirmation before committing',async()=>{
 const root=await dir(),store=make(root),first=await store.save(await fixture(),empty),p=await store.preview(id,1);let latest='';
 await expect(store.restore(p.token,p.head,async()=>{await make(root).save(first.document,first.head);latest=await readFile(join(root,id+'.json'),'utf8');return true;})).rejects.toBeInstanceOf(ProjectConflict);expect(await readFile(join(root,id+'.json'),'utf8')).toBe(latest);
});
it('rejects arbitrary paths, symlink files and unauthorized callers before storage I/O',async()=>{
 const root=await dir(),store=make(root),frame={},wc={mainFrame:frame,getURL:()=> 'file:///test'},event={sender:wc,senderFrame:frame};
 const h=createProjectHandler('load',wc,'file:///test',store,async()=>true);
 expect(await h({sender:{},senderFrame:frame},{projectId:id})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 for(const request of [{projectId:'../outside'},{projectId:id,path:'/outside'}])expect(await h(event,request)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await readdir(root)).toEqual([]);const outside=join(await dir(),'outside.json');await writeFile(outside,'SYNTHETIC OUTSIDE');await symlink(outside,join(root,id+'.json'));
 expect(await h(event,{projectId:id})).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});expect(await readFile(outside,'utf8')).toBe('SYNTHETIC OUTSIDE');
});
it('retains the exact head on restore commit failure and requires a fresh preview for retry',async()=>{
 const root=await dir(),store=make(root),first=await store.save(await fixture(),empty),p=await store.preview(id,1),before=await readFile(join(root,id+'.json'),'utf8');
 fault.rename=true;try{await expect(store.restore(p.token,p.head,async()=>true)).rejects.toThrow();expect(await readFile(join(root,id+'.json'),'utf8')).toBe(before);}finally{fault.rename=false;}
 await expect(store.restore(p.token,p.head,async()=>true)).rejects.toBeInstanceOf(ProjectConflict);
 const next=await store.preview(id,1);expect((await store.restore(next.token,next.head,async()=>true)).record?.head.revision).toBe(2);expect(first.head.revision).toBe(1);
});
it('restoring an older approved asset cannot grant output permission after a later pending state',async()=>{
 const root=await dir(),store=make(root),doc=JSON.parse(await fixture());
 const asset={id:'synthetic-image',sha256:'a'.repeat(64),mediaType:'image/png',approvalStatus:'approved',exportApproval:'approved',originalName:'synthetic.png',localReference:'asset:'+'a'.repeat(64),registry:{classification:'USER_CREATED',purpose:'illustration',usageScope:'newsletter-output'}};
 doc.design.assetManifest=[asset];doc.design.cardLayouts[0].image.assetId=asset.id;
 const last=doc.design.revisionHistory.at(-1);last.snapshot.assetManifest=[asset];last.snapshot.cardLayouts=doc.design.cardLayouts;
 const first=await store.save(JSON.stringify(doc),empty);
 const pending=JSON.parse(first.document);pending.design.assetManifest[0].exportApproval='pending';pending.design.revisionHistory.at(-1).snapshot.assetManifest[0].exportApproval='pending';
 await store.save(JSON.stringify(pending),first.head);
 const p=await store.preview(id,1);expect(JSON.parse(p.document).design.assetManifest[0].exportApproval).toBe('pending');
 const restored=await store.restore(p.token,p.head,async()=>true);expect(JSON.parse(restored.record!.document).design.assetManifest[0].exportApproval).toBe('pending');
 const raw=JSON.parse(await readFile(join(root,id+'.json'),'utf8'));expect(JSON.parse(raw.rows[0].document).design.assetManifest[0].exportApproval).toBe('approved');expect(raw.rows).toHaveLength(3);
});
