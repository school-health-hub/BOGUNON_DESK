import {app,BrowserWindow,ipcMain,powerMonitor,screen,session,type IpcMainInvokeEvent} from 'electron';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PRODUCT_NAME,type P0Settings} from '../protocol.js';
import type {DesktopEntry,SettingsSectionId,SurfaceSettingsSnapshot} from '../desktop-surface-protocol.js';
import type {MonitorSnapshot} from '../monitor-protocol.js';
import type {PaletteProjection} from '../palette-protocol.js';
import {PaletteRegistry,type PaletteEntry} from './palette-registry.js';
import {desktopPaletteOptions} from './desktop-palette.js';
import {assertSender,resourceAllowed} from './policy.js';
import {parseDesktopEntry,parseSettingsSection} from './desktop-navigation.js';
import {createLocalEventHandlers,type LocalEventStore} from './local-events.js';
import {createLocalTaskHandlers,type LocalTaskStore} from './local-tasks.js';
import {createMemoHandlers,type MemoStore} from './memo-ipc.js';
import type {SurfaceSettingsAuthority} from './surface-settings-authority.js';
import type {MonitorProfiles} from './monitor-profiles.js';
import {observeMonitors,readNativeMonitors} from './windows-monitor-identity.js';
import {TopologyReconciler} from './topology-reconciler.js';

interface Ports {
 readonly renderer:string;readonly dev?:string;readonly settings:SurfaceSettingsAuthority;readonly profiles:MonitorProfiles;
 readonly events:LocalEventStore;readonly tasks:LocalTaskStore;readonly memo:MemoStore;
 readonly openWorkspace:(entry?:DesktopEntry)=>void;readonly openSettings:(section:SettingsSectionId)=>void;
 readonly onFailure:()=>void;readonly onChanged:()=>void;readonly quitting:()=>boolean;
}
export class DesktopPaletteHost {
 readonly registry:PaletteRegistry<BrowserWindow>;
 private globalSettings:P0Settings|null=null;private revision=0;
 private readonly topology:TopologyReconciler<ReturnType<typeof observeMonitors>>;
 private readonly paletteUrl:string;
 private readonly inputTimer:ReturnType<typeof setInterval>;
 private readonly schedule=()=>this.topology.schedule();
 constructor(private readonly ports:Ports){
  const {renderer,dev}=ports;
  this.paletteUrl=dev?new URL('palette/index.html',dev).href:pathToFileURL(join(renderer,'palette','index.html')).href;
  const isolated=session.fromPartition('persist:electron-p0-palette');
  isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
  isolated.on('will-download',event=>event.preventDefault());isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!resourceAllowed(details.url,renderer,dev?new URL(dev).origin:undefined)}));
  this.registry=new PaletteRegistry<BrowserWindow>({
   create:display=>new BrowserWindow({title:`${PRODUCT_NAME} Desktop Palette${display.primary?'':` — ${display.label}`}`,...desktopPaletteOptions(display.workArea),webPreferences:{preload:join(app.getAppPath(),'preload','palette-preload.cjs'),session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,webSecurity:true}}),
   load:async entry=>{
    const window=entry.window;window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-redirect',event=>event.preventDefault());window.webContents.on('will-attach-webview',event=>event.preventDefault());
    window.webContents.on('did-fail-load',()=>this.registry.fail(entry));window.webContents.on('render-process-gone',()=>this.registry.fail(entry));window.on('closed',()=>this.registry.fail(entry));
    window.once('ready-to-show',()=>this.registry.markPresentable(entry));
    window.on('close',event=>{if(ports.quitting())return;event.preventDefault();entry.lifecycle.hide();ports.onChanged();});
    this.registry.syncVisibility(entry.display.displayId,ports.profiles.profileForDisplay(entry.display.displayId)?.visible??true);
    await window.loadURL(this.paletteUrl);
   },onFailure:ports.onFailure,onChanged:ports.onChanged,
  });
  const resolve=(event:IpcMainInvokeEvent)=>{const entry=this.registry.forSender(event.sender);if(!entry)throw new Error('Unknown Desktop Palette');assertSender(event,entry.window.webContents,this.paletteUrl);return entry;};
  const handle=(name:string,run:(entry:PaletteEntry<BrowserWindow>,event:IpcMainInvokeEvent,args:unknown[])=>unknown)=>ipcMain.handle('p0:palette:'+name,(event,...args:unknown[])=>run(resolve(event),event,args));
  const none=(args:unknown[])=>{if(args.length)throw new Error('Invalid Palette arguments');};
  handle('read-settings',async(_entry,_event,args)=>{none(args);return(await ports.settings.read()).value;});
  handle('read-projection',async(entry,_event,args)=>{none(args);this.globalSettings=(await ports.settings.read()).value;return this.projection(entry);});
  handle('ready',(entry,_event,args)=>{none(args);this.registry.ready(entry);});
  handle('open-workspace',(_entry,_event,args)=>{if(args.length>1)throw new Error('Invalid Workspace request');ports.openWorkspace(args.length?parseDesktopEntry(args[0]):undefined);});
  handle('open-settings',(_entry,_event,args)=>{if(args.length!==1)throw new Error('Invalid Settings request');ports.openSettings(parseSettingsSection(args[0]));});
  handle('set-interactive',(entry,_event,args)=>{if(args.length!==1||typeof args[0]!=='boolean')throw new Error('Invalid Palette input');entry.lifecycle.setInteractive(args[0]);});
  handle('set-hit-regions',(entry,_event,args)=>{
   const rows=args[0];if(args.length!==1||!Array.isArray(rows)||rows.length>16)throw new Error('Invalid Palette regions');
   const regions=rows.map((row:unknown)=>{if(!row||typeof row!=='object'||!('x'in row)||typeof row.x!=='number'||!('y'in row)||typeof row.y!=='number'||!('width'in row)||typeof row.width!=='number'||!('height'in row)||typeof row.height!=='number'||Object.keys(row).length!==4)throw new Error('Invalid Palette region');return{x:row.x,y:row.y,width:row.width,height:row.height};});
   this.registry.setHitRegions(entry,regions);
  });
  const handlers=new WeakMap<PaletteEntry<BrowserWindow>,{events:ReturnType<typeof createLocalEventHandlers>;tasks:ReturnType<typeof createLocalTaskHandlers>;memo:ReturnType<typeof createMemoHandlers>}>();
  const bound=(entry:PaletteEntry<BrowserWindow>)=>{let group=handlers.get(entry);if(!group){group={events:createLocalEventHandlers(entry.window.webContents,this.paletteUrl,ports.events),tasks:createLocalTaskHandlers(entry.window.webContents,this.paletteUrl,ports.tasks),memo:createMemoHandlers(entry.window.webContents,this.paletteUrl,ports.memo)};handlers.set(entry,group);}return group;};
  handle('events:load',(entry,event,args)=>bound(entry).events.load(event,...args));
  handle('events:save',(entry,event,args)=>{if(args.length!==3)throw new Error('Invalid event save');return bound(entry).events.save(event,{event:args[0],expectedRevision:args[1],expectedUpdatedAt:args[2]});});
  handle('events:remove',(entry,event,args)=>{if(args.length!==4)throw new Error('Invalid event removal');return bound(entry).events.remove(event,{id:args[0],expectedRevision:args[1],expectedUpdatedAt:args[2],confirmed:args[3]});});
  handle('tasks:load',(entry,event,args)=>bound(entry).tasks.load(event,...args));handle('tasks:save',(entry,event,args)=>bound(entry).tasks.save(event,...args));
  handle('memo:read',(entry,event,args)=>bound(entry).memo.read(event,...args));handle('memo:write',(entry,event,args)=>bound(entry).memo.write(event,...args));
  this.inputTimer=setInterval(()=>this.registry.tick(screen.getCursorScreenPoint()),50);
  this.topology=new TopologyReconciler(async()=>{
   let native:Awaited<ReturnType<typeof readNativeMonitors>>=[];
   try{native=await readNativeMonitors();}catch(error){if(!(error instanceof Error))throw error;console.warn('Monitor identity unavailable; existing profiles preserved.');}
   return observeMonitors(screen.getAllDisplays(),screen.getPrimaryDisplay().id,native,point=>screen.dipToScreenPoint(point));
  },async(displays,current)=>{await ports.profiles.reconcile(displays);if(ports.quitting()||!current())return;this.registry.reconcile(displays);const snapshot=await ports.profiles.read();if(current())this.publishProfiles(snapshot,true);},ports.onFailure);
  screen.on('display-added',this.schedule);screen.on('display-removed',this.schedule);screen.on('display-metrics-changed',this.schedule);
  powerMonitor.on('resume',this.schedule);
 }
 async start():Promise<void>{this.globalSettings=(await this.ports.settings.read()).value;await this.topology.start();}
 private projection(entry:PaletteEntry<BrowserWindow>):PaletteProjection{return{revision:this.revision,value:this.globalSettings,monitorLayout:this.ports.profiles.profileForDisplay(entry.display.displayId)?.layout??null};}
 isSettling():boolean{return this.topology.isSettling();}
 publishSettings(snapshot:SurfaceSettingsSnapshot):void{this.globalSettings=snapshot.value;if(!this.isSettling())this.broadcast();}
 publishProfiles(_snapshot:MonitorSnapshot,settledApply=false):void{
  if(this.isSettling()&&!settledApply)return;
  for(const entry of this.registry.entries())this.registry.syncVisibility(entry.display.displayId,this.ports.profiles.profileForDisplay(entry.display.displayId)?.visible??true);
  this.broadcast();
 }
 private broadcast():void{this.revision++;for(const entry of this.registry.entries())if(!entry.window.isDestroyed()&&!entry.window.webContents.isDestroyed())entry.window.webContents.send('p0:surface-settings:changed',this.projection(entry));}
 beginQuit():void{this.topology.stop();clearInterval(this.inputTimer);screen.removeListener('display-added',this.schedule);screen.removeListener('display-removed',this.schedule);screen.removeListener('display-metrics-changed',this.schedule);powerMonitor.removeListener('resume',this.schedule);this.registry.beginQuit();}
}
