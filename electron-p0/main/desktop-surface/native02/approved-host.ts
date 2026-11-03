import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {z} from 'zod';
import {HostError,fixedError} from './errors.js';

const specSchema=z.strictObject({mode:z.enum(['development','packaged']),root:z.string().min(1).max(4096),
  sha256:z.string().regex(/^[a-f0-9]{64}$/),sourceSha:z.string().regex(/^[a-f0-9]{40}$/)}).readonly();
type Spec=z.infer<typeof specSchema>;
export type ApprovedHost=Readonly<{imagePath:string;sha256:string;sourceSha:string}>;
const approvals=new WeakMap<object,Spec>();
export const HOST_FILE='bogunon-surface-channel-host.exe';
function samePath(a:string,b:string):boolean {return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}
export async function approveHost(input:unknown):Promise<ApprovedHost>{
  const parsed=specSchema.safeParse(input);
  if(!parsed.success||!isAbsolute(parsed.data.root)||parsed.data.root.includes('\0'))throw new HostError('PathRejected');
  const spec=parsed.data;
  try{
    const root=await realpath(spec.root);
    const file=spec.mode==='development'?join(root,'artifacts','native-02','bin',HOST_FILE):join(root,'native-surface',HOST_FILE);
    const rel=relative(root,file);
    if(rel.startsWith('..')||isAbsolute(rel))throw new HostError('PathRejected');
    let cursor=root;
    for(const part of rel.split(sep)){
      cursor=join(cursor,part);const entry=await lstat(cursor);
      if(entry.isSymbolicLink())throw new HostError('PathRejected');
    }
    const entry=await lstat(file);
    if(!entry.isFile()||entry.nlink!==1||!samePath(await realpath(file),resolve(file)))throw new HostError('PathRejected');
    const hash=createHash('sha256').update(await readFile(file)).digest('hex');
    if(hash!==spec.sha256)throw new HostError('DigestMismatch');
    const approval=Object.freeze({imagePath:file,sha256:hash,sourceSha:spec.sourceSha});
    approvals.set(approval,spec);return approval;
  }catch(error){throw fixedError(error);}
}
export async function recheckHost(host:ApprovedHost):Promise<void>{
  const spec=approvals.get(host);
  if(!spec)throw new HostError('PathRejected');
  const checked=await approveHost(spec);
  if(!samePath(checked.imagePath,host.imagePath)||checked.sha256!==host.sha256)throw new HostError('DigestMismatch');
}
export function approvedPathMatches(actual:string,host:ApprovedHost):boolean {
  return approvals.has(host)&&samePath(actual,host.imagePath);
}
