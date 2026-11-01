import {lstat,readdir} from 'node:fs/promises';
import {join,dirname,parse} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {SettingsStore} from './settings.js';
import {validateNewsletterSave} from './newsletter-json.js';
import type {NewsletterHead,NewsletterApprovalBarrier,NewsletterProjectRecord,NewsletterPreview} from '../protocol.js';
export class ProjectConflict extends Error{}
export function projectId(value:unknown):string{if(typeof value!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value))throw Error('Invalid project ID');return value;}
type Row={revision:number;createdAt:string;previousHash:string;document:string;hash:string;restoredFrom?:number};
export type RestorePrompt={projectId:string;sourceRevision:number;currentRevision:number};
type File={version:1;projectId:string;rows:Row[]};
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hashRow=(r:Omit<Row,'hash'>)=>digest({revision:r.revision,createdAt:r.createdAt,previousHash:r.previousHash,document:r.document,...(r.restoredFrom===undefined?{}:{restoredFrom:r.restoredFrom})});
export function validateProjectFile(value:unknown):File{
 const f=value as File;if(!f||Object.keys(f).sort().join(',')!=='projectId,rows,version'||f.version!==1||!Array.isArray(f.rows)||!f.rows.length||f.rows.length>100)throw Error('Invalid project file');projectId(f.projectId);
 let previous='';for(const [i,r] of f.rows.entries()){
  if(!r||Object.keys(r).sort().join(',')!==(r.restoredFrom===undefined?'createdAt,document,hash,previousHash,revision':'createdAt,document,hash,previousHash,restoredFrom,revision')||r.revision!==i+1||r.previousHash!==previous||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||r.hash!==hashRow(r)||r.restoredFrom!==undefined&&(!Number.isInteger(r.restoredFrom)||r.restoredFrom<1||r.restoredFrom>=r.revision))throw Error('Damaged revision');
  validateNewsletterSave({json:r.document});if(JSON.parse(r.document).project.projectId!==f.projectId)throw Error('Wrong project');previous=r.hash;
 }return structuredClone(f);
}
function barrier(documents:readonly string[]):NewsletterApprovalBarrier{
 const ids=new Set<string>(),hashes=new Set<string>();
 for(const json of documents){const d=JSON.parse(json).design;for(const manifest of [d.assetManifest,...d.revisionHistory.map((r:{snapshot:{assetManifest:unknown}})=>r.snapshot.assetManifest)]){
  if(!Array.isArray(manifest))throw Error('Invalid asset manifest');for(const a of manifest)if(a.exportApproval!=='approved'||a.approvalStatus!=='approved'){ids.add(a.id);hashes.add(a.sha256);}
 }}return {ids:[...ids].sort(),hashes:[...hashes].sort()};
}
const head=(f:File):NewsletterHead=>({projectId:f.projectId,revision:f.rows.length,hash:f.rows.at(-1)!.hash});
const same=(a:NewsletterHead,b:NewsletterHead)=>a.projectId===b.projectId&&a.revision===b.revision&&a.hash===b.hash;
export class NewsletterProjects {
 private queue:Promise<unknown>=Promise.resolve();
 private previews=new Map<string,{preview:NewsletterPreview;selectedHash:string}>();
 constructor(private readonly root:string,private readonly validate:(json:string,barrier:NewsletterApprovalBarrier)=>Promise<string>){}
 private run<T>(fn:()=>Promise<T>){const op=this.queue.then(fn);this.queue=op.catch(()=>{});return op;}
 private async safe(id?:string){let path=this.root;while(path!==parse(path).root){try{const s=await lstat(path);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe storage path');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}path=dirname(path);}if(id){try{const s=await lstat(join(this.root,`${projectId(id)}.json`));if(s.isSymbolicLink()||!s.isFile()||s.nlink!==1||s.size>64*1024*1024)throw Error('Unsafe project file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}}
 private async normalized(json:string,block:NewsletterApprovalBarrier){const out=await this.validate(json,block);validateNewsletterSave({json:out});if(JSON.parse(out).project.projectId!==JSON.parse(json).project.projectId)throw Error('Validation identity mismatch');return out;}
 private file(id:string){return new SettingsStore<File>(this.root,`${projectId(id)}.json`,validateProjectFile,64*1024*1024);}
 private async read(id:string){await this.safe(id);return this.file(id).read();}
 private async commit(id:string,before:File|null,after:File){
  if(Buffer.byteLength(JSON.stringify(after))>64*1024*1024)throw Error('Project storage limit');
  await this.safe(id);const latest=await this.read(id);if((before===null)!==(latest===null)||before&&latest&&digest(before)!==digest(latest))throw new ProjectConflict();
  await this.file(id).write(after);
 }
 list(){return this.run(async()=>{await this.safe();try{return (await readdir(this.root,{withFileTypes:true})).filter(f=>f.isFile()&&/^[a-z0-9][a-z0-9-]{0,63}\.json$/.test(f.name)).map(f=>f.name.slice(0,-5)).sort();}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}});}
 load(id:string){return this.run(async()=>{const f=await this.read(id);if(!f)throw Error('Missing project');const document=await this.normalized(f.rows.at(-1)!.document,barrier(f.rows.map(r=>r.document)));return {head:head(f),document};});}
 history(id:string){return this.run(async()=>{const f=await this.read(id);if(!f)throw Error('Missing project');return f.rows.map(({revision,hash,createdAt,restoredFrom})=>({revision,hash,createdAt,...(restoredFrom===undefined?{}:{restoredFrom})}));});}
 save(json:string,expected:NewsletterHead){return this.run(async()=>{
  validateNewsletterSave({json});const id=projectId(JSON.parse(json).project.projectId);if(id!==expected.projectId)throw new ProjectConflict();const f=await this.read(id);
  if(!same(expected,f?head(f):{projectId:id,revision:0,hash:''}))throw new ProjectConflict();
  const document=await this.normalized(json,barrier([...(f?.rows.map(r=>r.document)??[]),json]));
  validateNewsletterSave({json:document});if(JSON.parse(document).project.projectId!==id)throw Error('Validation identity mismatch');
  const row:Omit<Row,'hash'>={revision:(f?.rows.length??0)+1,createdAt:new Date().toISOString(),previousHash:f?.rows.at(-1)!.hash??'',document};
  const next:File={version:1,projectId:id,rows:[...(f?.rows??[]),{...row,hash:hashRow(row)}]};await this.commit(id,f,next);return {head:head(next),document};
 });}
 preview(id:string,revision:number){return this.run(async()=>{
  const f=await this.read(id),selected=f?.rows[revision-1];if(!f||!selected)throw Error('Missing revision');
  const document=await this.normalized(selected.document,barrier(f.rows.map(r=>r.document)));
  const preview:NewsletterPreview={token:randomUUID(),head:head(f),revision,document};if(this.previews.size>=16)this.previews.clear();this.previews.set(preview.token,{preview,selectedHash:selected.hash});return preview;
 });}
 restore(token:string,expected:NewsletterHead,confirm:(info:RestorePrompt)=>Promise<boolean>){return this.run(async()=>{
  const p=this.previews.get(token);this.previews.delete(token);if(!p||!same(p.preview.head,expected))throw new ProjectConflict();
  const id=projectId(expected.projectId),f=await this.read(id);if(!f||!same(head(f),expected)||f.rows[p.preview.revision-1]?.hash!==p.selectedHash)throw new ProjectConflict();
  if(!await confirm({projectId:id,sourceRevision:p.preview.revision,currentRevision:expected.revision}))return {restored:false};
  const document=await this.normalized(p.preview.document,barrier(f.rows.map(r=>r.document)));
  const row:Omit<Row,'hash'>={revision:f.rows.length+1,createdAt:new Date().toISOString(),previousHash:expected.hash,document,restoredFrom:p.preview.revision};
  const next:File={version:1,projectId:id,rows:[...f.rows,{...row,hash:hashRow(row)}]};await this.commit(id,f,next);return {restored:true,record:{head:head(next),document} as NewsletterProjectRecord};
 });}
 async flush(){await this.queue;}
}
