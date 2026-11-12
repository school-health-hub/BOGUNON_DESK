import {randomUUID} from 'node:crypto';
import type {MonitorDocument,MonitorObservation,MonitorProfile,MonitorProfileView,MonitorSnapshot,MonitorWrite} from '../monitor-protocol.js';
import {monitorDefaults,validateMonitorDocument,validateMonitorLayout} from './monitor-profile-store.js';
interface Store {read():Promise<MonitorDocument|null>;write(value:MonitorDocument):Promise<void>;flush():Promise<void>;readonly writable?:boolean;readonly error?:string|null;}
export class MonitorProfiles {
 private document:MonitorDocument=monitorDefaults();
 private displays:readonly MonitorObservation[]=[];
 private queue:Promise<void>=Promise.resolve();
 private loaded=false;
 private failed:string|null=null;
 constructor(private readonly store:Store,private readonly publish:(snapshot:MonitorSnapshot)=>void){}
 private serialize<T>(action:()=>Promise<T>):Promise<T>{const operation=this.queue.then(action);this.queue=operation.then(()=>undefined,()=>undefined);return operation;}
 async initialize(observations:readonly MonitorObservation[]):Promise<MonitorSnapshot>{return this.reconcile(observations);}
 reconcile(observations:readonly MonitorObservation[]):Promise<MonitorSnapshot>{return this.serialize(async()=>{
  if(!this.loaded){this.document=validateMonitorDocument(await this.store.read()??monitorDefaults());this.loaded=true;}
  this.displays=structuredClone(observations);
  const unique=new Map<string,MonitorObservation>();
  for(const d of observations){if(d.identityKind==='device-path'&&d.identityKey&&observations.filter(o=>o.identityKey===d.identityKey).length===1)unique.set(d.identityKey,d);}
  const profiles:MonitorProfile[]=this.document.profiles.map(p=>{
   const d=p.identityKey?unique.get(p.identityKey):undefined;
   if(!d)return {...p,connected:false,dormant:true};
   return {...p,label:d.label,connected:true,dormant:false,lastDisplayId:d.displayId,lastBounds:d.bounds,scaleFactor:d.scaleFactor};
  });
  for(const [key,d] of unique){if(!profiles.some(p=>p.identityKey===key))profiles.push({id:randomUUID(),identityKey:key,identityKind:'device-path',label:d.label,visible:true,connected:true,dormant:false,lastDisplayId:d.displayId,lastBounds:d.bounds,scaleFactor:d.scaleFactor,layoutRef:'legacy'});}
  const next={...this.document,profiles};
  if(JSON.stringify(next)!==JSON.stringify(this.document)&&this.store.writable!==false&&!this.failed){
   try{const candidate={...next,revision:this.document.revision+1};await this.store.write(candidate);this.document=candidate;}
   catch(error){if(!(error instanceof Error))throw error;this.failed=error.message;this.document=next;}
  }else this.document=next;
  const snapshot=this.snapshot();this.publish(snapshot);return snapshot;
 });}
 private snapshot():MonitorSnapshot{
  const views:MonitorProfileView[]=this.document.profiles.map(p=>{
   const matching=this.displays.filter(d=>d.identityKey===p.identityKey&&d.identityKind==='device-path');
   const display=matching.length===1?matching[0]??null:null;
   return {...p,connected:display!==null,dormant:display===null,display,layout:p.layoutRef==='legacy'?null:this.document.layouts[p.layoutRef]??null};
  });
  for(const d of this.displays){if(!views.some(p=>p.display?.displayId===d.displayId))views.push({id:`uncertain:${d.displayId}`,identityKey:null,identityKind:'uncertain',label:d.label,visible:true,connected:true,dormant:false,lastDisplayId:d.displayId,lastBounds:d.bounds,scaleFactor:d.scaleFactor,layoutRef:'legacy',display:d,layout:null});}
  return structuredClone({revision:this.document.revision,profiles:views,writable:this.store.writable!==false&&this.failed===null,error:this.failed??this.store.error??null});
 }
 async read():Promise<MonitorSnapshot>{await this.queue;return this.snapshot();}
 profileForDisplay(id:number):MonitorProfileView|undefined{return this.snapshot().profiles.find(p=>p.display?.displayId===id);}
 write(request:MonitorWrite):Promise<MonitorSnapshot>{return this.serialize(async()=>{
  if(this.store.writable===false||this.failed)throw new Error(this.failed??this.store.error??'모니터 프로필은 읽기 전용입니다.');
  if(!Number.isSafeInteger(request.revision)||request.revision!==this.document.revision)throw new Error('다른 창에서 모니터 설정이 변경됐습니다. 최신 설정을 다시 불러온 뒤 편집해 주세요.');
  const profile=this.snapshot().profiles.find(p=>p.id===request.profileId);
  if(!profile||profile.identityKind==='uncertain')throw new Error('모니터를 식별할 수 없습니다. 연결과 식별 정보를 확인한 뒤 편집해 주세요.');
  if(!profile.connected||profile.dormant||profile.display===null)throw new Error('모니터가 연결되지 않았거나 식별 정보가 중복됩니다. 모니터를 다시 연결하고 식별 정보를 확인한 뒤 편집해 주세요.');
  if(typeof request.visible!=='boolean')throw new Error('모니터 표시 설정이 올바르지 않습니다.');
  const layout=validateMonitorLayout(request.layout);
  const candidate={...this.document,revision:this.document.revision+1,profiles:this.document.profiles.map(p=>p.id===profile.id?{...p,visible:request.visible,layoutRef:p.id}:p),layouts:{...this.document.layouts,[profile.id]:layout}};
  try{await this.store.write(candidate);this.document=candidate;}
  catch(error){if(!(error instanceof Error))throw error;this.failed=error.message;this.publish(this.snapshot());throw error;}
  const snapshot=this.snapshot();this.publish(snapshot);return snapshot;
 });}
 async flush():Promise<void>{await this.queue;await this.store.flush();}
}
