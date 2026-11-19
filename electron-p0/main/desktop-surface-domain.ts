import {createHash} from 'node:crypto';
import type {DesktopSurfaceDocument,DesktopSurfaceProfile,MonitorIdentity} from '../desktop-surface-protocol.js';

export type DisplaySnapshot=Readonly<{id:number;label:string;primary:boolean;workArea:Readonly<{x:number;y:number;width:number;height:number}>;scaleFactor:number}>;
export type ConnectedProfile=Readonly<{profileKey:string;ownedWidgetIds:readonly string[];layout:unknown|null;dockVisible:boolean}>;
export type ReconciledDesktopProfiles=Readonly<{document:DesktopSurfaceDocument;displayProfiles:ReadonlyMap<number,ConnectedProfile>} >;
type LayoutWidget=Readonly<{id:string;type:string;x:number;y:number;w:number;h:number;visible:boolean}>;

const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const layoutWidgets=(layout:unknown):readonly LayoutWidget[]=>{
  if(!record(layout)||!Array.isArray(layout.widgets))return [];
  return layout.widgets.filter((widget):widget is LayoutWidget=>record(widget)&&typeof widget.id==='string'&&typeof widget.type==='string'&&typeof widget.x==='number'&&typeof widget.y==='number'&&typeof widget.w==='number'&&typeof widget.h==='number'&&typeof widget.visible==='boolean');
};
const withVisibility=(layout:unknown,visibleIds:ReadonlySet<string>):unknown=>{
  if(!record(layout)||!Array.isArray(layout.widgets))return layout;
  return {...layout,widgets:layout.widgets.map(widget=>record(widget)&&typeof widget.id==='string'?{...widget,visible:visibleIds.has(widget.id)}:widget)};
};
const maskVisibility=(layout:unknown,ownedIds:ReadonlySet<string>):unknown=>{
  if(!record(layout)||!Array.isArray(layout.widgets))return layout;
  return {...layout,widgets:layout.widgets.map(widget=>record(widget)&&typeof widget.id==='string'&&typeof widget.visible==='boolean'?{...widget,visible:widget.visible&&ownedIds.has(widget.id)}:widget)};
};
const fingerprint=(display:DisplaySnapshot)=>`${display.label.normalize('NFKC').trim().toLowerCase()}|${display.workArea.width}x${display.workArea.height}|${display.scaleFactor}`;
const profileKey=(identity:string,displayId:number)=>`monitor:${createHash('sha256').update(`${identity}|${displayId}`).digest('hex').slice(0,20)}`;
const identity=(display:DisplaySnapshot):MonitorIdentity=>({fingerprint:fingerprint(display),label:display.label,lastDisplayId:display.id,workArea:{...display.workArea},scaleFactor:display.scaleFactor});
const profile=(display:DisplaySnapshot,layout:unknown|null,ownedWidgetIds:readonly string[],updatedAt:string):DesktopSurfaceProfile=>({visible:true,layout,dormant:false,ownedWidgetIds:[...ownedWidgetIds],monitor:identity(display),updatedAt});

export function reconcileDesktopProfiles(document:DesktopSurfaceDocument,displays:readonly DisplaySnapshot[],baseLayout:unknown|null,updatedAt:string):ReconciledDesktopProfiles{
  const profiles:Record<string,DesktopSurfaceProfile>=Object.fromEntries(Object.entries(document.profiles).map(([key,value])=>[key,{...value,dormant:true}]));
  const used=new Set<string>(),mapping=new Map<number,ConnectedProfile>();
  const primary=displays.find(display=>display.primary)??displays[0];
  const allWidgetIds=layoutWidgets(baseLayout).map(widget=>widget.id);
  for(const display of displays){
    const candidates=Object.entries(profiles).filter(([key,value])=>!used.has(key)&&value.monitor.fingerprint===fingerprint(display));
    const exact=Object.entries(profiles).find(([key,value])=>!used.has(key)&&value.monitor.lastDisplayId===display.id),matched=exact??(candidates.length===1?candidates[0]:undefined);
    const key=matched?.[0]??profileKey(fingerprint(display),display.id);
    const existing=matched?.[1];
    const owned=existing?.ownedWidgetIds??(display.id===primary?.id?allWidgetIds:[]);
    const sourceLayout=existing?.layout??baseLayout;
    const next=existing?{...existing,dormant:false,monitor:identity(display)}:profile(display,maskVisibility(sourceLayout,new Set(owned)),owned,updatedAt);
    profiles[key]=next;used.add(key);
    mapping.set(display.id,{profileKey:key,ownedWidgetIds:[...next.ownedWidgetIds],layout:next.layout,dockVisible:false});
  }
  const connectedKeys=[...mapping.values()].map(value=>value.profileKey),primaryKey=primary?mapping.get(primary.id)?.profileKey:undefined;
  const dock=selectDockProfile({preferredProfileKey:document.dockProfileKey,connectedProfileKeys:connectedKeys,primaryProfileKey:primaryKey??connectedKeys[0]??null});
  for(const [id,value] of mapping)mapping.set(id,{...value,dockVisible:value.profileKey===dock.activeProfileKey});
  return{document:{...document,profiles,dockProfileKey:dock.preferredProfileKey??dock.activeProfileKey},displayProfiles:mapping};
}

export function moveWidgetOwnership(document:DesktopSurfaceDocument,widgetId:string,targetProfileKey:string,updatedAt:string):DesktopSurfaceDocument{
  if(!document.profiles[targetProfileKey])throw new Error('Unknown target monitor profile');
  const seedLayout=Object.values(document.profiles).find(value=>value.ownedWidgetIds.includes(widgetId)&&value.layout!==null)?.layout??Object.values(document.profiles).find(value=>value.layout!==null)?.layout??null;
  const profiles:Record<string,DesktopSurfaceProfile>={};
  for(const [key,value] of Object.entries(document.profiles)){
    const owned=value.ownedWidgetIds.filter(id=>id!==widgetId);
    const nextOwned=key===targetProfileKey?[...owned,widgetId]:owned;
    const sourceLayout=key===targetProfileKey&&value.layout===null?seedLayout:value.layout;
    const widgets=layoutWidgets(sourceLayout),visible=new Set(widgets.filter(widget=>widget.visible&&widget.id!==widgetId).map(widget=>widget.id));
    if(key===targetProfileKey)visible.add(widgetId);
    profiles[key]={...value,ownedWidgetIds:nextOwned,layout:withVisibility(sourceLayout,visible),updatedAt:key===targetProfileKey||owned.length!==value.ownedWidgetIds.length?updatedAt:value.updatedAt};
  }
  return{...document,profiles};
}

export function setWidgetVisible(document:DesktopSurfaceDocument,profileKeyValue:string,widgetId:string,visible:boolean,updatedAt:string):DesktopSurfaceDocument{
  const current=document.profiles[profileKeyValue];if(!current)throw new Error('Unknown monitor profile');
  if(!current.ownedWidgetIds.includes(widgetId))throw new Error('Widget is not owned by this monitor');
  if(!record(current.layout)||!Array.isArray(current.layout.widgets))return document;
  const layout={...current.layout,widgets:current.layout.widgets.map(widget=>record(widget)&&widget.id===widgetId?{...widget,visible}:widget)};
  return{...document,profiles:{...document.profiles,[profileKeyValue]:{...current,layout,updatedAt}}};
}

export function writeProfileLayout(document:DesktopSurfaceDocument,profileKeyValue:string,layout:unknown,updatedAt:string):DesktopSurfaceDocument{
  const current=document.profiles[profileKeyValue];if(!current)throw new Error('Unknown monitor profile');
  const hasOwner=Object.values(document.profiles).some(profileValue=>profileValue.ownedWidgetIds.length>0);
  const initialize=document.dockProfileKey===profileKeyValue&&!hasOwner;
  const owned=initialize?layoutWidgets(layout).map(widget=>widget.id):current.ownedWidgetIds;
  return{...document,profiles:{...document.profiles,[profileKeyValue]:{...current,ownedWidgetIds:owned,layout:maskVisibility(layout,new Set(owned)),updatedAt}}};
}

export function selectDockProfile(input:Readonly<{preferredProfileKey:string|null;connectedProfileKeys:readonly string[];primaryProfileKey:string|null}>):Readonly<{activeProfileKey:string|null;preferredProfileKey:string|null}>{
  const active=input.preferredProfileKey&&input.connectedProfileKeys.includes(input.preferredProfileKey)?input.preferredProfileKey:input.primaryProfileKey&&input.connectedProfileKeys.includes(input.primaryProfileKey)?input.primaryProfileKey:input.connectedProfileKeys[0]??null;
  return{activeProfileKey:active,preferredProfileKey:input.preferredProfileKey};
}

export function projectLayoutInsideWorkArea<T extends LayoutWidget>(widgets:readonly T[],input:Readonly<{maxRows:number;dockRows:number}>):readonly T[]{
  const available=Math.max(1,input.maxRows-input.dockRows);
  return widgets.map(widget=>({...widget,x:Math.max(0,Math.min(12-widget.w,widget.x)),y:Math.max(0,Math.min(available-widget.h,widget.y))}));
}
