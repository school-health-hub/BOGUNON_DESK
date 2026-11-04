import {lstat,mkdir,open,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import type {AiCipher} from './ai-vault.js';import {replaceSettingsFile} from './settings.js';
import {validYoutubeKey} from './finder-youtube.js';
export interface YoutubeVault{readonly available:boolean;exists():Promise<boolean>;read():Promise<string|null>;write(key:string):Promise<void>;clear():Promise<void>}
// Reuse Electron safeStorage and the existing atomic file replacement primitive.
// Dedicated root/file: never reads, changes or substitutes an AI provider's key.
export class EncryptedYoutubeVault implements YoutubeVault{
 readonly available:boolean;private readonly file:string;
 constructor(private readonly root:string,private readonly cipher:AiCipher){this.available=cipher.available;this.file=join(root,'youtube-api-key.bin');}
 private async info(){try{const s=await lstat(this.file);if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>16384)throw Error();return s;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw Error('YouTube 보안 저장소를 읽지 못했습니다. 기존 파일은 유지합니다.');}}
 async exists(){return !!await this.info();}
 async read(){if(!await this.info())return null;if(!this.available)throw Error('이 환경에서는 Windows 보안 저장소를 사용할 수 없습니다.');try{const value=JSON.parse(this.cipher.decrypt(await readFile(this.file)));if(!value||Object.keys(value).sort().join(',')!=='key,version'||value.version!==1||!validYoutubeKey(value.key))throw Error();return value.key as string;}catch{throw Error('YouTube Key 복원에 실패했습니다. 기존 보안 파일은 유지합니다.');}}
 async write(key:string){
  if(!this.available||!validYoutubeKey(key))throw Error('YouTube Key를 안전하게 저장할 수 없습니다.');
  await mkdir(this.root,{recursive:true,mode:0o700});const dir=await lstat(this.root);if(!dir.isDirectory()||dir.isSymbolicLink())throw Error('YouTube 보안 저장소를 확인해 주세요.');await this.info();
  const bytes=this.cipher.encrypt(JSON.stringify({version:1,key}));if(!bytes.length||bytes.length>16384)throw Error('YouTube Key 암호화에 실패했습니다.');const temp=join(this.root,randomUUID()+'.tmp');
  try{const h=await open(temp,'wx',0o600);try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}await replaceSettingsFile(temp,this.file);}catch{await unlink(temp).catch(()=>{});throw Error('YouTube Key 저장에 실패했습니다. 기존 파일은 유지합니다.');}
 }
 async clear(){if(await this.info())await unlink(this.file);}
}
