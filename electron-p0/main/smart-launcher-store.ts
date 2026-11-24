import {lstat} from 'node:fs/promises';
import {dirname,join,parse,resolve} from 'node:path';
import {SettingsStore} from './settings.js';
import {emptySmartLauncherPreferences,validateSmartLauncherPreferences,type SmartLauncherPreferences,type SmartLauncherPreferencesLoad,type SmartLauncherRecordResult} from '../smart-launcher-preferences.js';
import {validateWorkActionId} from '../smart-work-launcher.js';

export class SmartLauncherConflict extends Error{}

type PreferenceChange=(current:SmartLauncherPreferences)=>SmartLauncherPreferences;
const rootQueues=new Map<string,Promise<void>>();

function inRootQueue<T>(root:string,operation:()=>Promise<T>):Promise<T>{
  const key=process.platform==='win32'?resolve(root).toLowerCase():resolve(root);
  const previous=rootQueues.get(key)??Promise.resolve();
  const task=previous.then(operation),tail=task.then(()=>{},()=>{});
  rootQueues.set(key,tail);
  void tail.then(()=>{if(rootQueues.get(key)===tail)rootQueues.delete(key);});
  return task;
}

export class SmartLauncherStore{
  private readonly primary:SettingsStore<SmartLauncherPreferences>;
  private readonly backup:SettingsStore<SmartLauncherPreferences>;
  private queue:Promise<void>=Promise.resolve();

  constructor(private readonly root:string,private readonly writePrimary?:(document:SmartLauncherPreferences)=>Promise<void>){
    this.primary=new SettingsStore(root,'smart-launcher.json',validateSmartLauncherPreferences,64*1024);
    this.backup=new SettingsStore(root,'smart-launcher.backup.json',validateSmartLauncherPreferences,64*1024);
  }

  private async safe():Promise<void>{
    for(let path=this.root;path!==parse(path).root;path=dirname(path)){
      try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Unsafe smart launcher directory');}
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
    for(const name of ['smart-launcher.json','smart-launcher.backup.json']){
      try{const info=await lstat(join(this.root,name));if(info.isSymbolicLink()||!info.isFile()||info.nlink!==1)throw new Error('Unsafe smart launcher file');}
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
  }

  async load():Promise<SmartLauncherPreferencesLoad>{
    await this.safe();
    try{
      const document=await this.primary.read();
      if(document)return {document,recovered:false};
      const backup=await this.backup.read();
      return backup?{document:backup,recovered:true}:{document:emptySmartLauncherPreferences(),recovered:false};
    }catch{
      try{const backup=await this.backup.read();if(backup)return {document:backup,recovered:true};}
      catch{throw new Error('Smart launcher preference files unreadable');}
      throw new Error('Smart launcher preference files unreadable');
    }
  }

  private update(expectedRevision:number|undefined,change:PreferenceChange):Promise<SmartLauncherPreferencesLoad>{
    const task=this.queue.then(()=>inRootQueue(this.root,async()=>{
      const before=await this.load();
      if(before.recovered)throw new Error('Recovered smart launcher backup is read only');
      if(expectedRevision!==undefined&&before.document.revision!==expectedRevision)throw new SmartLauncherConflict();
      const changed=change(before.document);
      if(changed===before.document)return before;
      const next=validateSmartLauncherPreferences({...changed,revision:before.document.revision+1});
      if(before.document.revision>0)await this.backup.write(before.document);
      await (this.writePrimary?this.writePrimary(next):this.primary.write(next));
      if(before.document.revision===0)await this.backup.write(next);
      return {document:next,recovered:false};
    }));
    this.queue=task.then(()=>{},()=>{});
    return task;
  }

  toggleFavorite(id:unknown,expectedRevision:unknown):Promise<SmartLauncherPreferencesLoad>{
    const actionId=validateWorkActionId(id),revision=this.revision(expectedRevision);
    return this.update(revision,current=>{
      const favorites=current.favorites.includes(actionId)?current.favorites.filter(value=>value!==actionId):[...current.favorites,actionId];
      if(favorites.length>12)throw new Error('Smart launcher favorites are full');
      return {...current,favorites};
    });
  }

  reorderFavorites(ids:unknown,expectedRevision:unknown):Promise<SmartLauncherPreferencesLoad>{
    if(!Array.isArray(ids)||ids.length>12)throw new Error('Invalid smart launcher favorite order');
    const favorites=ids.map(validateWorkActionId),revision=this.revision(expectedRevision);
    if(new Set(favorites).size!==favorites.length)throw new Error('Invalid smart launcher favorite order');
    return this.update(revision,current=>{
      if(favorites.length!==current.favorites.length||favorites.some(id=>!current.favorites.includes(id)))throw new Error('Invalid smart launcher favorite order');
      return {...current,favorites};
    });
  }

  setRecentEnabled(enabled:unknown,expectedRevision:unknown):Promise<SmartLauncherPreferencesLoad>{
    if(typeof enabled!=='boolean')throw new Error('Invalid smart launcher recent setting');
    return this.update(this.revision(expectedRevision),current=>current.recentEnabled===enabled?current:{...current,recentEnabled:enabled});
  }

  clearRecent(expectedRevision:unknown):Promise<SmartLauncherPreferencesLoad>{
    return this.update(this.revision(expectedRevision),current=>current.recent.length===0?current:{...current,recent:[]});
  }

  async recordLaunch(id:unknown,timestamp:unknown):Promise<SmartLauncherRecordResult>{
    const actionId=validateWorkActionId(id),instant=this.timestamp(timestamp);
    let recorded=false;
    const load=await this.update(undefined,current=>{if(!current.recentEnabled)return current;recorded=true;return {...current,recent:[{id:actionId,timestamp:instant},...current.recent].slice(0,10)};});
    return {load,recorded};
  }

  flush():Promise<void>{return this.queue;}

  private revision(value:unknown):number{
    if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error('Invalid smart launcher revision');
    return Number(value);
  }

  private timestamp(value:unknown):string{
    const probe=validateSmartLauncherPreferences({...emptySmartLauncherPreferences(),recent:[{id:'leave-annual',timestamp:value}]});
    const parsed=probe.recent[0];if(!parsed)throw new Error('Invalid smart launcher timestamp');return parsed.timestamp;
  }
}
