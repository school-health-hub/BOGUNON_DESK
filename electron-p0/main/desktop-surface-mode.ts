import type {DesktopSurfaceDocument,DesktopSurfaceProfile,MonitorIdentity} from '../desktop-surface-protocol.js';
import {SettingsStore} from './settings.js';

const defaults=():DesktopSurfaceDocument=>({version:2,mode:'palette',profiles:{},dockProfileKey:null});
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const monitor=(value:unknown):MonitorIdentity=>{
  if(!isRecord(value)||typeof value.fingerprint!=='string'||typeof value.label!=='string'||typeof value.lastDisplayId!=='number'||!Number.isInteger(value.lastDisplayId)||typeof value.scaleFactor!=='number'||!isRecord(value.workArea))throw new Error('Invalid monitor identity');
  const {x,y,width,height}=value.workArea;if(![x,y,width,height].every(Number.isFinite)||Number(width)<=0||Number(height)<=0)throw new Error('Invalid monitor work area');
  return{fingerprint:value.fingerprint,label:value.label,lastDisplayId:value.lastDisplayId,scaleFactor:value.scaleFactor,workArea:{x:Number(x),y:Number(y),width:Number(width),height:Number(height)}};
};
const legacyProfile=(key:string,value:Record<string,unknown>,ownedWidgetIds:readonly string[]):DesktopSurfaceProfile=>({visible:value.visible===true,layout:structuredClone(value.layout),ownedWidgetIds,monitor:{fingerprint:key,label:key,lastDisplayId:0,workArea:{x:0,y:0,width:1,height:1},scaleFactor:1},dormant:true,updatedAt:'1970-01-01T00:00:00.000Z'});
export function validateDesktopSurfaceDocument(value:unknown):DesktopSurfaceDocument{
  if(!isRecord(value)||(value.mode!=='window'&&value.mode!=='palette')||!isRecord(value.profiles))throw new Error('Invalid desktop surface settings');
  if(value.version!==2){const profiles:Record<string,DesktopSurfaceProfile>={};let first=true;for(const [key,entry] of Object.entries(value.profiles)){if(!isRecord(entry)||typeof entry.visible!=='boolean'||!('layout'in entry))throw new Error('Invalid legacy desktop surface profile');const widgets=isRecord(entry.layout)&&Array.isArray(entry.layout.widgets)?entry.layout.widgets.filter(isRecord).map(widget=>widget.id).filter((id):id is string=>typeof id==='string'):[];profiles[key]=legacyProfile(key,entry,first?widgets:[]);first=false;}return{version:2,mode:value.mode,profiles,dockProfileKey:Object.keys(profiles)[0]??null};}
  if(value.dockProfileKey!==null&&typeof value.dockProfileKey!=='string')throw new Error('Invalid Dock monitor profile');
  const profiles:Record<string,DesktopSurfaceProfile>={};
  for(const [key,profile] of Object.entries(value.profiles)){
    if(!/^[a-zA-Z0-9._:-]{1,160}$/.test(key)||!isRecord(profile)||typeof profile.visible!=='boolean'||!('layout'in profile)||!Array.isArray(profile.ownedWidgetIds)||!profile.ownedWidgetIds.every(id=>typeof id==='string')||typeof profile.dormant!=='boolean'||typeof profile.updatedAt!=='string')throw new Error('Invalid desktop surface profile');
    profiles[key]={visible:profile.visible,layout:structuredClone(profile.layout),ownedWidgetIds:[...new Set(profile.ownedWidgetIds)],monitor:monitor(profile.monitor),dormant:profile.dormant,updatedAt:profile.updatedAt};
  }
  return {version:2,mode:value.mode,profiles,dockProfileKey:value.dockProfileKey};
}
export class DesktopSurfaceModeStore{
  private readonly store:SettingsStore<DesktopSurfaceDocument>;
  constructor(root:string){this.store=new SettingsStore(root,'desktop-surface.json',validateDesktopSurfaceDocument,1024*1024);}
  async read():Promise<DesktopSurfaceDocument>{return await this.store.read()??defaults();}
  write(value:DesktopSurfaceDocument):Promise<void>{return this.store.write(value);}
  flush():Promise<void>{return this.store.flush();}
}
