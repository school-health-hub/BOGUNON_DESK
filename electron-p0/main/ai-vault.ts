import {lstat,mkdir,open,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {replaceSettingsFile} from './settings.js';
import type {AiProvider} from '../protocol.js';
export type AiCredential=Readonly<{provider:AiProvider;key:string;model:string}>;
export interface AiVault {
 readonly available:boolean;
 exists():Promise<boolean>;
 read():Promise<AiCredential|null>;
 write(credential:AiCredential):Promise<void>;
 clear():Promise<void>;
}
export type AiCipher={available:boolean;encrypt:(text:string)=>Buffer;decrypt:(bytes:Buffer)=>string};
export const validAiKey=(key:unknown):key is string=>typeof key==='string'&&/^[\x21-\x7e]{8,512}$/.test(key);
export function validateCredential(value:unknown):AiCredential{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid credential');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='key,model,provider'||!['openai','gemini'].includes(String(v.provider))||!validAiKey(v.key)||typeof v.model!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v.model))throw Error('Invalid credential');
 return v as AiCredential;
}
// Separate Electron vault; never reads Tauri credentials or writes plaintext fallback.
export class EncryptedAiVault implements AiVault{
 readonly available:boolean;
 private readonly file:string;
 constructor(private readonly root:string,private readonly cipher:AiCipher){this.available=cipher.available;this.file=join(root,'api-credential.bin');}
 private async info(){try{const s=await lstat(this.file);if(!s.isFile()||s.isSymbolicLink()||s.size>16384)throw Error('Invalid vault file');return s;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}
 async exists(){return (await this.info())!==null;}
 async read(){if(!await this.info())return null;if(!this.available)throw Error('Secure storage unavailable');const bytes=await readFile(this.file);if(bytes.length>16384)throw Error('Invalid vault file');return validateCredential(JSON.parse(this.cipher.decrypt(bytes)));}
 async write(credential:AiCredential){
  if(!this.available)throw Error('Secure storage unavailable');validateCredential(credential);
  await mkdir(this.root,{recursive:true,mode:0o700});const directory=await lstat(this.root);if(!directory.isDirectory()||directory.isSymbolicLink())throw Error('Invalid vault directory');await this.info();
  const bytes=this.cipher.encrypt(JSON.stringify(credential));if(bytes.length>16384)throw Error('Oversized vault');
  const temp=join(this.root,`${randomUUID()}.tmp`);
  try{const handle=await open(temp,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await replaceSettingsFile(temp,this.file);}catch{await unlink(temp).catch(()=>{});throw Error('Secure storage write failed');}
 }
 async clear(){if(await this.info())await unlink(this.file);}
}
