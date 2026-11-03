// Same staged write / fingerprint / rename pattern as Newsletter exports; no renderer paths.
import {lstat,open,rename,unlink,link} from 'node:fs/promises';
import {dirname,basename,join,extname,isAbsolute,parse} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {PurchaseExportResult} from '../protocol.js';
export class ExportConflict extends Error {}
async function parents(path:string){for(let p=dirname(path);p!==parse(p).root;p=dirname(p)){const s=await lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe parent');}}
async function fingerprint(path:string):Promise<string|null>{
 let file;
 try{
  const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.size>32*1024*1024)throw Error('Unsafe file');
  file=await open(path,'r');const opened=await file.stat();if(opened.ino!==before.ino||opened.dev!==before.dev)throw new ExportConflict();
  const hash=createHash('sha256');let offset=0;const chunk=Buffer.alloc(65536);
  for(;;){const {bytesRead}=await file.read(chunk,0,chunk.length,offset);if(!bytesRead)break;offset+=bytesRead;if(offset>32*1024*1024)throw Error('Oversized target');hash.update(chunk.subarray(0,bytesRead));}
  const after=await file.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||offset!==before.size)throw new ExportConflict();
  return `${after.dev}:${after.ino}:${after.mode}:${after.size}:${after.mtimeMs}:${after.ctimeMs}:${hash.digest('hex')}`;
 }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}finally{await file?.close();}
}
export async function writeSelectedExport(path:string,format:'csv'|'xlsx'|'json',bytes:Buffer,confirm:()=>Promise<boolean>,fresh:()=>void=()=>{},commit:typeof rename=rename):Promise<PurchaseExportResult>{
 if(!isAbsolute(path)||extname(path).toLowerCase()!==`.${format}`||!bytes.length||bytes.length>32*1024*1024)throw Error('Invalid target');
 await parents(path);fresh();const before=await fingerprint(path);
 if(before!==null&&!await confirm())return {status:'canceled'};
 fresh();const temp=join(dirname(path),`.purchase-${randomUUID()}.tmp`);
 try{
  const file=await open(temp,'wx',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
  await parents(path);if(await fingerprint(path)!==before)throw new ExportConflict();fresh();
  // New targets use atomic no-clobber publication. Existing targets use atomic replacement.
  if(before===null){try{await link(temp,path);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new ExportConflict();throw e;}}else{await commit(temp,path);}
  return {status:'saved',fileName:basename(path)};
 }finally{await unlink(temp).catch(()=>{});}
}

// Preserve the Purchase-only API; Finder reuses the same atomic writer with a validated JSON snapshot.
export const writePurchaseExport=(path:string,format:'csv'|'xlsx',bytes:Buffer,confirm:()=>Promise<boolean>,fresh:()=>void=()=>{},commit:typeof rename=rename)=>writeSelectedExport(path,format,bytes,confirm,fresh,commit);
