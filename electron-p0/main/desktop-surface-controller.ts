import {app,BrowserWindow,ipcMain,screen,session,type IpcMainInvokeEvent} from 'electron';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {P0Settings,IpcResult,MemoDocument} from '../protocol.js';
import type {DesktopSurfaceDocument,DesktopSurfaceMode} from '../desktop-surface-protocol.js';
import type {PaletteRect,PaletteSurface,PaletteWidgetAction} from '../palette-protocol.js';
import {assertSender,resourceAllowed} from './policy.js';
import {desktopPaletteOptions,DesktopPaletteLifecycle,type PaletteFailureGate} from './desktop-palette.js';
import type {DesktopSurfaceModeStore} from './desktop-surface-mode.js';
import type {LocalEventStore} from './local-events.js';
import type {LocalTaskStore} from './local-tasks.js';
import type {MemoStore} from './memo-ipc.js';
import {moveWidgetOwnership,reconcileDesktopProfiles,setWidgetVisible,writeProfileLayout,type DisplaySnapshot} from './desktop-surface-domain.js';

type Entry={displayId:number;profileKey:string;dockVisible:boolean;window:BrowserWindow;lifecycle:DesktopPaletteLifecycle;ready:boolean;regions:readonly PaletteRect[]};
type Ports={renderer:string;dev?:string;workspace:BrowserWindow;layout:{read():Promise<P0Settings|null>};mode:DesktopSurfaceModeStore;events:LocalEventStore;tasks:LocalTaskStore;memo:MemoStore;failureGate?:PaletteFailureGate;quitting:()=>boolean};
const ok=<T>(data:T):IpcResult<T>=>({ok:true,data});
const storageError=<T>(message:string):IpcResult<T>=>({ok:false,error:{code:'STORAGE_ERROR',message,retryable:true}});
export const clipPaletteRegions=(values:readonly unknown[],bounds:Readonly<{width:number;height:number}>):readonly PaletteRect[]=>values.map(value=>{if(!value||typeof value!=='object')throw new Error('Invalid region');const {x,y,width,height}=value as Record<string,unknown>;if(![x,y,width,height].every(Number.isFinite)||Number(width)<=0||Number(height)<=0)throw new Error('Invalid region');const left=Math.max(0,Number(x)),top=Math.max(0,Number(y)),right=Math.min(bounds.width,Number(x)+Number(width)),bottom=Math.min(bounds.height,Number(y)+Number(height));return right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:null;}).filter((region):region is PaletteRect=>region!==null);
const validatePaletteLayout=(value:unknown):unknown=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid Desktop Palette layout');
  const candidate=value as Record<string,unknown>,widgets=candidate.widgets;
  if(candidate.version!==1||!Array.isArray(widgets)||widgets.length!==13||JSON.stringify(value).length>65536)throw new Error('Invalid Desktop Palette layout');
  const ids=new Set<string>();
  for(const widget of widgets){if(!widget||typeof widget!=='object'||Array.isArray(widget))throw new Error('Invalid Desktop Palette widget');const item=widget as Record<string,unknown>;if(typeof item.id!=='string'||typeof item.type!=='string'||typeof item.visible!=='boolean'||![item.x,item.y,item.w,item.h].every(number=>typeof number==='number'&&Number.isInteger(number))||Number(item.x)<0||Number(item.y)<0||Number(item.w)<1||Number(item.h)<1||Number(item.x)+Number(item.w)>12||Number(item.y)+Number(item.h)>40||ids.has(item.id))throw new Error('Invalid Desktop Palette widget');ids.add(item.id);}
  return structuredClone(value);
};

export class DesktopSurfaceController{
  private document:DesktopSurfaceDocument={version:2,mode:'palette',profiles:{},dockProfileKey:null};
  private readonly entries=new Map<number,Entry>();
  private readonly editCheckpoints=new Map<number,DesktopSurfaceDocument>();
  private readonly paletteUrl:string;
  private readonly workspaceUrl:string;
  private readonly isolated:Electron.Session;
  private timer:ReturnType<typeof setInterval>|undefined;
  private settingsHandoff:{returnToPalette:boolean}|null=null;
  private readonly workspaceHidden=()=>this.clearSettingsHandoff();
  private readonly topologyChanged=()=>{if(this.document.mode==='palette')void this.reconcile();};
  constructor(private readonly ports:Ports){
    this.paletteUrl=ports.dev?new URL('palette/index.html',ports.dev).href:pathToFileURL(join(ports.renderer,'palette','index.html')).href;
    this.workspaceUrl=ports.dev??pathToFileURL(join(ports.renderer,'index.html')).href;
    this.isolated=session.fromPartition('persist:electron-p0-palette');
    this.isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));this.isolated.setPermissionCheckHandler(()=>false);this.isolated.on('will-download',event=>event.preventDefault());
    this.isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!resourceAllowed(details.url,ports.renderer,ports.dev?new URL(ports.dev).origin:undefined)}));
    screen.on('display-added',this.topologyChanged);screen.on('display-removed',this.topologyChanged);screen.on('display-metrics-changed',this.topologyChanged);
    ports.workspace.on('hide',this.workspaceHidden);
    this.registerIpc();
  }
  async start():Promise<void>{this.document=await this.ports.mode.read();if(this.document.mode==='palette')await this.activatePalette();else this.activateWindow();}
  isPaletteMode():boolean{return this.document.mode==='palette';}
  read():DesktopSurfaceDocument{return structuredClone(this.document);}
  async setMode(mode:DesktopSurfaceMode):Promise<DesktopSurfaceDocument>{
    const next={...this.document,mode};await this.ports.mode.write(next);this.document=next;
    if(mode==='palette')await this.activatePalette();else this.activateWindow();
    return this.read();
  }
  private async activatePalette():Promise<void>{
    try{await this.reconcile();await this.waitUntilReady();this.ports.workspace.hide();}
    catch(error){this.ports.workspace.show();this.ports.workspace.focus();throw error;}
  }
  private async waitUntilReady():Promise<void>{
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){const entries=[...this.entries.values()];if(entries.length>0&&entries.every(entry=>entry.ready&&!entry.window.isDestroyed()))return;await new Promise(resolve=>setTimeout(resolve,50));}
    throw new Error('Desktop Palette did not become ready');
  }
  private activateWindow():void{for(const entry of this.entries.values())entry.lifecycle.hide();if(!this.ports.workspace.isDestroyed()){this.ports.workspace.show();this.ports.workspace.focus();}}
  private async reconcile():Promise<void>{
    const displays=screen.getAllDisplays(),ids=new Set(displays.map(display=>display.id)),primaryId=screen.getPrimaryDisplay().id;
    const settings=await this.ports.layout.read();
    const snapshots:readonly DisplaySnapshot[]=displays.map(display=>({id:display.id,label:display.label||`Display ${display.id}`,primary:display.id===primaryId,workArea:{...display.workArea},scaleFactor:display.scaleFactor}));
    const reconciled=reconcileDesktopProfiles(this.document,snapshots,settings?.dashboard??null,new Date().toISOString());
    if(JSON.stringify(reconciled.document)!==JSON.stringify(this.document)){await this.ports.mode.write(reconciled.document);this.document=reconciled.document;}
    for(const [id,entry] of this.entries)if(!ids.has(id)){entry.lifecycle.beginQuit();this.entries.delete(id);}
    if(this.ports.failureGate?.consume())throw new Error('QA-injected Desktop Palette creation failure');
    await Promise.all(displays.map(async display=>{
      const connected=reconciled.displayProfiles.get(display.id);if(!connected)return;
      const existing=this.entries.get(display.id);if(existing){existing.profileKey=connected.profileKey;existing.dockVisible=connected.dockVisible;existing.window.setBounds(display.workArea);existing.regions=[];existing.lifecycle.setInteractive(false);existing.lifecycle.show();existing.window.webContents.send('p0:palette:surface-changed');return;}
      const profileKey=connected.profileKey,profile=this.document.profiles[profileKey];if(profile?.visible===false)return;
      const window=new BrowserWindow({...desktopPaletteOptions(display.workArea),title:`BOGUNON DESK Desktop Palette — ${display.label||display.id}`,webPreferences:{preload:join(app.getAppPath(),'preload','palette-preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webviewTag:false,webSecurity:true,session:this.isolated}});
      const entry:Entry={displayId:display.id,profileKey,dockVisible:connected.dockVisible,window,lifecycle:new DesktopPaletteLifecycle(window),ready:false,regions:[]};this.entries.set(display.id,entry);
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-redirect',event=>event.preventDefault());window.webContents.on('will-attach-webview',event=>event.preventDefault());
      window.on('closed',()=>{if(!this.ports.quitting())this.entries.delete(display.id);});window.once('ready-to-show',()=>entry.lifecycle.show());
      await window.loadURL(this.paletteUrl);
    }));
    if(!this.timer)this.timer=setInterval(()=>this.routePointer(),50);
  }
  private resolve(event:IpcMainInvokeEvent):Entry{const entry=[...this.entries.values()].find(candidate=>candidate.window.webContents===event.sender&&!candidate.window.isDestroyed());if(!entry)throw new Error('Unknown Desktop Palette');assertSender(event,entry.window.webContents,this.paletteUrl);return entry;}
  private surface(entry:Entry):PaletteSurface{const current=this.document.profiles[entry.profileKey];if(!current)throw new Error('Desktop Palette profile unavailable');const connected=new Set([...this.entries.values()].map(value=>value.profileKey));return{profileKey:entry.profileKey,layout:structuredClone(current.layout),ownedWidgetIds:[...current.ownedWidgetIds],dockVisible:entry.dockVisible,profiles:Object.entries(this.document.profiles).map(([profileKey,value])=>({profileKey,label:value.monitor.label,connected:connected.has(profileKey),ownedWidgetIds:[...value.ownedWidgetIds]}))};}
  private broadcast():void{for(const entry of this.entries.values())if(!entry.window.isDestroyed())entry.window.webContents.send('p0:palette:surface-changed');}
  private setSettingsActive(active:boolean):void{for(const entry of this.entries.values())if(!entry.window.isDestroyed())entry.window.webContents.send('p0:palette:settings-active',active);}
  private clearSettingsHandoff():void{if(!this.settingsHandoff)return;this.settingsHandoff=null;this.setSettingsActive(false);}
  private routePointer():void{const point=screen.getCursorScreenPoint();for(const entry of this.entries.values()){if(entry.window.isDestroyed()||!entry.window.isVisible())continue;const bounds=entry.window.getBounds(),x=point.x-bounds.x,y=point.y-bounds.y;entry.lifecycle.setInteractive(entry.regions.some(region=>x>=region.x&&x<region.x+region.width&&y>=region.y&&y<region.y+region.height));}}
  private registerIpc():void{
    const handle=(name:string,run:(event:IpcMainInvokeEvent,args:readonly unknown[],entry:Entry)=>unknown)=>ipcMain.handle(`p0:palette:${name}`,(event,...args:unknown[])=>run(event,args,this.resolve(event)));
    handle('read-surface',(_event,args,entry)=>{if(args.length)throw new Error('Invalid arguments');return this.surface(entry);});
    handle('write-layout',async(_event,args,entry)=>{if(args.length!==1)throw new Error('Invalid arguments');const layout=validatePaletteLayout(args[0]);const next=writeProfileLayout(this.document,entry.profileKey,layout,new Date().toISOString());await this.ports.mode.write(next);this.document=next;this.broadcast();return this.surface(entry);});
    handle('update-widget',async(_event,args,entry)=>{if(args.length!==1||!args[0]||typeof args[0]!=='object')throw new Error('Invalid widget action');const action=args[0] as PaletteWidgetAction;if(typeof action.widgetId!=='string'||!['claim','move','hide','show'].includes(action.action))throw new Error('Invalid widget action');let next=this.document;if(action.action==='hide'||action.action==='show')next=setWidgetVisible(next,entry.profileKey,action.widgetId,action.action==='show',new Date().toISOString());else{const target=action.targetProfileKey??entry.profileKey;next=moveWidgetOwnership(next,action.widgetId,target,new Date().toISOString());}await this.ports.mode.write(next);this.document=next;this.broadcast();return this.surface(entry);});
    handle('set-dock-monitor',async(_event,args,entry)=>{if(args.length)throw new Error('Invalid arguments');const next={...this.document,dockProfileKey:entry.profileKey};await this.ports.mode.write(next);this.document=next;for(const value of this.entries.values())value.dockVisible=value.profileKey===entry.profileKey;this.broadcast();return this.surface(entry);});
    handle('begin-edit',(event,args)=>{if(args.length)throw new Error('Invalid arguments');this.editCheckpoints.set(event.sender.id,structuredClone(this.document));});
    handle('finish-edit',async(event,args,entry)=>{if(args.length!==1||typeof args[0]!=='boolean')throw new Error('Invalid edit completion');const checkpoint=this.editCheckpoints.get(event.sender.id);this.editCheckpoints.delete(event.sender.id);if(args[0]===false&&checkpoint){await this.ports.mode.write(checkpoint);this.document=checkpoint;await this.reconcile();this.broadcast();}return this.surface(entry);});
    handle('read-settings',(_event,args)=>{if(args.length)throw new Error('Invalid arguments');return this.ports.layout.read();});
    handle('ready',(_event,args,entry)=>{if(args.length)throw new Error('Invalid arguments');entry.ready=true;entry.lifecycle.show();});
    handle('set-hit-regions',(_event,args,entry)=>{if(args.length!==1||!Array.isArray(args[0])||args[0].length>32)throw new Error('Invalid regions');entry.regions=clipPaletteRegions(args[0] as unknown[],entry.window.getContentBounds());});
    handle('set-interactive',(_event,args,entry)=>{if(args.length!==1||typeof args[0]!=='boolean')throw new Error('Invalid input mode');entry.lifecycle.setInteractive(args[0]);});
    handle('open-workspace',(_event,args)=>{if(args.length)throw new Error('Invalid arguments');this.ports.workspace.show();this.ports.workspace.focus();});
    handle('open-settings',(_event,args)=>{if(args.length)throw new Error('Invalid arguments');if(this.settingsHandoff)return;const returnToPalette=!this.ports.workspace.isVisible();this.settingsHandoff={returnToPalette};this.setSettingsActive(true);this.ports.workspace.webContents.send('p0:open-settings',returnToPalette);});
    ipcMain.handle('p0:settings:ready',(event,...args:unknown[])=>{assertSender(event,this.ports.workspace.webContents,this.workspaceUrl);if(args.length)throw new Error('Invalid settings request');if(!this.settingsHandoff&&this.document.mode==='palette'){this.settingsHandoff={returnToPalette:false};this.setSettingsActive(true);}if(!this.settingsHandoff)return;this.ports.workspace.show();this.ports.workspace.focus();});
    ipcMain.handle('p0:settings:dismissed',(event,...args:unknown[])=>{assertSender(event,this.ports.workspace.webContents,this.workspaceUrl);if(args.length!==1||typeof args[0]!=='boolean')throw new Error('Invalid settings request');const returnToPalette=this.settingsHandoff?.returnToPalette??false;if(returnToPalette&&!args[0]&&this.document.mode==='palette')this.ports.workspace.hide();this.clearSettingsHandoff();});
    handle('memo:read',async(_event,args)=>{if(args.length)throw new Error('Invalid arguments');try{return ok(await this.ports.memo.read());}catch{return storageError<MemoDocument>('메모를 불러오지 못했습니다.');}});
    handle('memo:write',async(_event,args)=>{if(args.length!==1)throw new Error('Invalid arguments');try{return ok(await this.ports.memo.write(args[0]));}catch{return storageError<MemoDocument>('메모를 저장하지 못했습니다.');}});
    handle('events:load',async(_event,args)=>{if(args.length)throw new Error('Invalid arguments');try{return ok(await this.ports.events.load());}catch{return storageError('일정을 불러오지 못했습니다.');}});
    handle('tasks:load',async(_event,args)=>{if(args.length)throw new Error('Invalid arguments');try{return ok(await this.ports.tasks.load());}catch{return storageError('업무를 불러오지 못했습니다.');}});
  }
  beginQuit():void{if(this.timer)clearInterval(this.timer);this.timer=undefined;this.editCheckpoints.clear();this.settingsHandoff=null;this.ports.workspace.removeListener('hide',this.workspaceHidden);screen.removeListener('display-added',this.topologyChanged);screen.removeListener('display-removed',this.topologyChanged);screen.removeListener('display-metrics-changed',this.topologyChanged);for(const entry of this.entries.values())entry.lifecycle.beginQuit();this.entries.clear();}
}
