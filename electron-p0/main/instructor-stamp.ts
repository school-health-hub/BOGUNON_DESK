import {createHash} from 'node:crypto';
import {join,dirname,parse} from 'node:path';
import {lstat,mkdir} from 'node:fs/promises';
import {SettingsStore} from './settings.js';
import type {StampView} from '../instructor-files-protocol.js';
export interface StampCipher {available:boolean;encrypt(s:string):Buffer;decrypt(b:Buffer):string}
export const STAMP_LIMIT={bytes:2*1024*1024,dimension:1024,pixels:1024*1024};
/** Header limits BEFORE native decode; only PNG/JPEG. Native decode+PNG reencode follows. */
export function stampDimensions(b:Buffer){
 if(b.length<24||b.length>STAMP_LIMIT.bytes)throw Error('image');let width=0,height=0;
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  if(b.toString('ascii',12,16)!=='IHDR')throw Error('image');width=b.readUInt32BE(16);height=b.readUInt32BE(20);
  let p=8,end=false;while(p+12<=b.length){const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8);if(n>STAMP_LIMIT.bytes||p+12+n>b.length||t==='acTL')throw Error('image');p+=n+12;if(t==='IEND'){end=p===b.length;break;}}if(!end)throw Error('image');
 }else if(b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217){
  let i=2;while(i<b.length-2){if(b[i++]!==255)throw Error('image');while(b[i]===255)i++;const t=b[i++];if(t===0xda)break;const n=b.readUInt16BE(i);if(n<2||i+n>b.length)throw Error('image');if([0xc0,0xc1,0xc2].includes(t)){height=b.readUInt16BE(i+3);width=b.readUInt16BE(i+5);break;}i+=n;}
 }else throw Error('image');
 if(width<8||height<8||width>STAMP_LIMIT.dimension||height>STAMP_LIMIT.dimension||width*height>STAMP_LIMIT.pixels)throw Error('image');return {width,height};
}
export async function safeParents(path:string){for(let p=path;p!==parse(p).root;p=dirname(p)){const s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');}}
export interface InstructorStampScope {school:string;instructor:string}
export class InstructorStampStore {
 constructor(private root:string,private cipher:StampCipher){}
 private async store(user:string,scope?:InstructorStampScope){
  if(!this.cipher.available||!/^[a-f0-9-]{36}$/i.test(user))throw Error('stamp_unavailable');
  if(scope&&(!/^[a-f0-9-]{36}$/i.test(scope.school)||!/^[a-f0-9-]{36}$/i.test(scope.instructor)))throw Error('stamp_scope');
  const filename=scope?'instructor-'+createHash('sha256').update(scope.school+':'+scope.instructor).digest('hex')+'.json':'stamp.json';
  await mkdir(this.root,{recursive:true,mode:0o700});await safeParents(this.root);
  const root=join(this.root,createHash('sha256').update(user).digest('hex'));await mkdir(root,{mode:0o700,recursive:true});await safeParents(root);
  try{const s=await lstat(join(root,filename));if(s.isSymbolicLink()||!s.isFile())throw Error('unsafe_stamp');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  return new SettingsStore<{version:1;ciphertext:string}>(root,filename,v=>{const x=v as {version:unknown;ciphertext:unknown};if(!x||x.version!==1||typeof x.ciphertext!=='string'||x.ciphertext.length>4*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(x.ciphertext))throw Error('stamp');return x as {version:1;ciphertext:string};},5*1024*1024);
 }
 async read(user:string,scope?:InstructorStampScope):Promise<StampView|null>{const value=await(await this.store(user,scope)).read();if(!value||!value.ciphertext)return null;const bytes=Buffer.from(this.cipher.decrypt(Buffer.from(value.ciphertext,'base64')),'base64');const d=stampDimensions(bytes);if(bytes[0]!==137)throw Error('stamp');return {...d,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};}
 async save(user:string,png:Buffer,fresh:()=>void=()=>{},scope?:InstructorStampScope){stampDimensions(png);const store=await this.store(user,scope);await store.read();fresh();await store.write({version:1,ciphertext:this.cipher.encrypt(png.toString('base64')).toString('base64')});fresh();return this.read(user,scope);}
 async remove(user:string,fresh:()=>void=()=>{},scope?:InstructorStampScope){const store=await this.store(user,scope);await store.read();fresh();await store.write({version:1,ciphertext:''});fresh();}
}
