import {lstat} from 'node:fs/promises';import {dirname,join,parse} from 'node:path';
import {SettingsStore} from './settings.js';
import {emptyAdmin,validateAdminDocument,withAdminEnvironment,ADMIN_ENVIRONMENTS,type AdminEnvironment,type AdminDocument,type AdminLoad} from '../admin-protocol.js';
export class AdminConflict extends Error{}
export class AdminStore{
 private readonly primary:SettingsStore<AdminDocument>;private readonly backup:SettingsStore<AdminDocument>;private queue:Promise<void>=Promise.resolve();
 constructor(private readonly root:string,private readonly writePrimary?:(document:AdminDocument)=>Promise<void>){this.primary=new SettingsStore(root,'admin.json',validateAdminDocument,2*1024*1024);this.backup=new SettingsStore(root,'admin.backup.json',validateAdminDocument,2*1024*1024);}
 private async safe(){for(let path=this.root;path!==parse(path).root;path=dirname(path)){try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Unsafe administrative directory');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}for(const name of ['admin.json','admin.backup.json']){try{const info=await lstat(join(this.root,name));if(info.isSymbolicLink()||!info.isFile()||info.nlink!==1)throw Error('Unsafe administrative file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}}
 async load():Promise<AdminLoad>{await this.safe();try{const document=await this.primary.read();if(document)return {document,recovered:false};const backup=await this.backup.read();return backup?{document:backup,recovered:true}:{document:emptyAdmin(),recovered:false};}catch{const backup=await this.backup.read();if(backup)return {document:backup,recovered:true};throw Error('Administrative files unreadable');}}
 save(value:unknown,revision:unknown,beforeWrite?:()=>Promise<void>){const document=validateAdminDocument(value);if(!Number.isSafeInteger(revision)||revision!==document.revision)throw Error('Invalid revision');
  const task=this.queue.then(async()=>{const before=await this.load();if(before.recovered)throw Error('Recovered backup is read only');if(before.document.revision!==revision)throw new AdminConflict();const profile=document.launcher?{...document.launcher,...(before.document.launcher?.entryUrl!==undefined&&document.launcher.entryUrl===undefined?{entryUrl:before.document.launcher.entryUrl}:{})}:before.document.launcher;const next=validateAdminDocument({...document,...(profile?{launcher:profile}:{}),revision:document.revision+1});if(before.document.revision>0)await this.backup.write(before.document);await beforeWrite?.();await (this.writePrimary?this.writePrimary(next):this.primary.write(next));return {document:next,recovered:false};});this.queue=task.then(()=>{},()=>{});return task;
 }
 async setEnvironment(environment:unknown,revision:unknown){
  if(typeof environment!=='string'||!Object.prototype.hasOwnProperty.call(ADMIN_ENVIRONMENTS,environment)||!Number.isSafeInteger(revision)||Number(revision)<0)throw Error('Invalid launcher environment');
  const current=await this.load();if(current.document.revision!==revision)throw new AdminConflict();
  return this.save(withAdminEnvironment(current.document,environment as AdminEnvironment),revision);
 }
 flush(){return this.queue;}
}
