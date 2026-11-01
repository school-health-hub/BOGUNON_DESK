import {lstat,readFile,open,rename,unlink,mkdir,rm} from 'node:fs/promises';
import {join,dirname,parse,extname,isAbsolute,basename} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import type {NewsletterExportSelection,NewsletterExportResult} from '../protocol.js';
export type ExportFile={fileName:string;bytes:Buffer};
async function safeParents(path:string){let p=path;while(p!==parse(p).root){const s=await lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe output folder');p=dirname(p);}}
async function stamp(path:string){try{const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>32*1024*1024)throw Error('Unsafe output target');return `${s.dev}:${s.ino}:`+createHash('sha256').update(await readFile(path)).digest('hex');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}
async function stageFile(path:string,bytes:Buffer){const f=await open(path,'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}}
export async function saveGeneratedExport(files:ExportFile[],selection:NewsletterExportSelection,target:string,confirm:()=>Promise<boolean>,commit:typeof rename=rename):Promise<NewsletterExportResult>{
 if(!isAbsolute(target))throw Error('Invalid target');
 if(selection==='card-pngs'){
  await safeParents(target);
  const id=randomUUID(),stage=join(target,`.newsletter-${id}.tmp`),folder=join(target,`newsletter-cards-${id}`);
  await mkdir(stage,{mode:0o700});try{for(const f of files)await stageFile(join(stage,f.fileName),f.bytes);await commit(stage,folder);return {saved:true,names:[basename(folder)]};}finally{await rm(stage,{recursive:true,force:true});}
 }
 const extension=selection==='a4-png'?'.png':'.pdf';if(files.length!==1||extname(target).toLowerCase()!==extension)throw Error('Invalid output extension');
 await safeParents(dirname(target));const before=await stamp(target);if(before!==null&&!await confirm())return {saved:false};
 const temp=join(dirname(target),`.newsletter-${randomUUID()}.tmp`);
 try{await stageFile(temp,files[0].bytes);if(await stamp(target)!==before)throw Error('Output changed');await commit(temp,target);return {saved:true,names:[basename(target)]};}finally{await unlink(temp).catch(()=>{});}
}
