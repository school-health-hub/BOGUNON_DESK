import {lstat,mkdir,open,readFile,unlink} from 'node:fs/promises';import {dirname,join,parse} from 'node:path';import {randomUUID} from 'node:crypto';
import {replaceSettingsFile} from './settings.js';import type {AiCipher} from './ai-vault.js';
export type AccountEntries=Record<string,string>;
function validate(value:unknown):AccountEntries{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>24||Object.entries(value).some(([k,v])=>!/^sb-[a-z0-9_-]+-auth-token(?:[a-zA-Z0-9_.:-]*)$/.test(k)||k.length>512||typeof v!=='string'||v.length>128*1024)||Buffer.byteLength(JSON.stringify(value))>256*1024)throw Error('Invalid account storage');return {...value} as AccountEntries;
}
// Electron-only vault: Windows safeStorage/DPAPI, no plaintext/Tauri fallback.
export class AccountVault{
 private queue:Promise<void>=Promise.resolve();readonly available:boolean;private file:string;
 constructor(private root:string,private cipher:AiCipher){this.available=cipher.available;this.file=join(root,'session.bin');}
 private async safe(){for(let path=this.root;path!==parse(path).root;path=dirname(path))try{const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink())throw Error();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}try{const s=await lstat(this.file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>512*1024)throw Error();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 async read():Promise<AccountEntries>{if(!this.available)throw Error('Secure storage unavailable');await this.queue;await this.safe();try{const bytes=await readFile(this.file);const parsed=JSON.parse(this.cipher.decrypt(bytes));if(parsed?.version!==1||Object.keys(parsed).sort().join(',')!=='items,version')throw Error();return validate(parsed.items);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw Error('Account storage unreadable; original preserved');}}
 write(items:AccountEntries,guard=()=>{}){const safe=validate(items);const action=this.queue.then(async()=>{if(!this.available)throw Error('Secure storage unavailable');await this.safe();const bytes=this.cipher.encrypt(JSON.stringify({version:1,items:safe}));if(bytes.length>512*1024)throw Error();await mkdir(this.root,{recursive:true,mode:0o700});const temp=join(this.root,randomUUID()+'.tmp');try{const handle=await open(temp,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}guard();await replaceSettingsFile(temp,this.file);}catch{await unlink(temp).catch(()=>{});throw Error('Account storage not saved');}});this.queue=action.catch(()=>{});return action;}
 flush(){return this.queue;}
}
