import {z} from 'zod';
import {SettingsStore,validateSettings} from './settings.js';
import type {MonitorDocument} from '../monitor-protocol.js';
const rect=z.object({x:z.number().int().min(-100000).max(100000),y:z.number().int().min(-100000).max(100000),width:z.number().int().positive().max(100000),height:z.number().int().positive().max(100000)}).strict();
const profile=z.object({id:z.uuid(),identityKey:z.string().min(1).max(512),identityKind:z.literal('device-path'),label:z.string().max(256),visible:z.boolean(),connected:z.boolean(),dormant:z.boolean(),lastDisplayId:z.number().int(),lastBounds:rect,scaleFactor:z.number().positive().max(10),layoutRef:z.string().max(64)}).strict();
export const monitorDefaults=():MonitorDocument=>({version:1,revision:0,profiles:[],layouts:{}});
export function validateMonitorLayout(value:unknown):unknown {
 return validateSettings({version:1,dashboard:value,dock:{version:2,items:[]}}).dashboard;
}
export function validateMonitorDocument(value:unknown):MonitorDocument {
 if(Buffer.byteLength(JSON.stringify(value))>2097152)throw new Error('Oversized monitor profiles');
 const doc=z.object({version:z.literal(1),revision:z.number().int().nonnegative().safe(),profiles:z.array(profile).max(64),layouts:z.record(z.string(),z.unknown())}).strict().parse(value);
 const ids=new Set<string>(),keys=new Set<string>();
 for(const p of doc.profiles){
  if(ids.has(p.id)||keys.has(p.identityKey)||p.connected===p.dormant)throw new Error('Invalid monitor profile identity');
  ids.add(p.id);keys.add(p.identityKey);
  if(p.layoutRef!=='legacy'&&p.layoutRef!==p.id)throw new Error('Invalid monitor layout reference');
  if(p.layoutRef!=='legacy'&&!Object.hasOwn(doc.layouts,p.layoutRef))throw new Error('Missing monitor layout');
 }
 const layouts:Record<string,unknown>={};
 for(const [key,layout] of Object.entries(doc.layouts)){
  if(!ids.has(key))throw new Error('Orphan monitor layout');
  layouts[key]=validateMonitorLayout(layout);
 }
 return {...doc,layouts};
}
export class MonitorProfileStore {
 private readonly primary:SettingsStore<MonitorDocument>;
 private readonly backup:SettingsStore<MonitorDocument>;
 private queue:Promise<void>=Promise.resolve();
 private blocked=false;
 private problem:string|null=null;
 constructor(root:string){this.primary=new SettingsStore(root,'monitor-profiles.json',validateMonitorDocument,2097152);this.backup=new SettingsStore(root,'monitor-profiles.backup.json',validateMonitorDocument,2097152);}
 get writable():boolean{return !this.blocked;}
 get error():string|null{return this.problem;}
 async read():Promise<MonitorDocument|null>{
  await this.queue;
  try{
   const primary=await this.primary.read();
   if(primary)return primary;
   const backup=await this.backup.read();
   if(backup){this.blocked=true;this.problem='Primary monitor profiles are missing. Backup recovery is read-only.';}
   return backup;
  }
  catch(error){
   if(!(error instanceof Error))throw error;
   this.blocked=true;this.problem='Monitor profiles could not be read. Original files preserved; recovery is read-only.';
   try{return await this.backup.read()??monitorDefaults();}
   catch(backupError){if(!(backupError instanceof Error))throw backupError;return monitorDefaults();}
  }
 }
 write(value:MonitorDocument):Promise<void>{
  const safe=validateMonitorDocument(value);
  const operation=this.queue.then(async()=>{
   if(this.blocked)throw new Error(this.problem??'Monitor profiles are read-only');
   try{const previous=await this.primary.read();if(previous)await this.backup.write(previous);await this.primary.write(safe);}
   catch(error){if(!(error instanceof Error))throw error;this.blocked=true;this.problem='Monitor profiles were not saved. Existing files preserved; restart or recover before editing.';throw new Error(this.problem,{cause:error});}
  });
  this.queue=operation.then(()=>undefined,()=>undefined);return operation;
 }
 async flush():Promise<void>{await this.queue;await Promise.all([this.primary.flush(),this.backup.flush()]);}
}
