import {DesktopPaletteLifecycle} from './desktop-palette.js';
import type {MonitorObservation,MonitorRect} from '../monitor-protocol.js';

export interface PaletteRegistryWindow {
  readonly webContents:object;
  isDestroyed():boolean;
  isVisible():boolean;
  showInactive():void;
  hide():void;
  setIgnoreMouseEvents(ignore:boolean,options?:{readonly forward:boolean}):void;
  destroy():void;
  setBounds(bounds:MonitorRect):void;
  getBounds():MonitorRect;
  getContentBounds():MonitorRect;
}
export interface PaletteEntry<W extends PaletteRegistryWindow=PaletteRegistryWindow> {
  display:MonitorObservation;
  readonly window:W;
  readonly lifecycle:DesktopPaletteLifecycle;
  ready:boolean;
  presentable:boolean;
  failed:boolean;
  enabled:boolean;
  hitRegions:readonly MonitorRect[];
  startupTimer:ReturnType<typeof setTimeout>|undefined;
}
interface RegistryPorts<W extends PaletteRegistryWindow> {
  readonly create:(display:MonitorObservation)=>W;
  readonly load:(entry:PaletteEntry<W>)=>Promise<void>;
  readonly onFailure:()=>void;
  readonly onChanged?:()=>void;
}
const sameRect=(a:MonitorRect,b:MonitorRect)=>a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
export class InvalidPaletteHitRegion extends Error {}

export class PaletteRegistry<W extends PaletteRegistryWindow=PaletteRegistryWindow> {
  private readonly byDisplay=new Map<number,PaletteEntry<W>>();
  private quitting=false;
  private visible=true;
  constructor(private readonly ports:RegistryPorts<W>){}
  entries():readonly PaletteEntry<W>[] {return [...this.byDisplay.values()];}
  private current(entry:PaletteEntry<W>):boolean {return !this.quitting&&this.byDisplay.get(entry.display.displayId)===entry;}
  forSender(contents:unknown):PaletteEntry<W>|undefined {
    return this.entries().find(entry=>entry.window.webContents===contents&&!entry.window.isDestroyed());
  }
  reconcile(displays:readonly MonitorObservation[]):void {
    if(this.quitting)return;
    const ids=new Set(displays.map(display=>display.displayId));
    for(const entry of this.entries())if(!ids.has(entry.display.displayId))this.remove(entry);
    for(const display of displays){
      const existing=this.byDisplay.get(display.displayId);
      if(existing){
        if(!sameRect(existing.display.workArea,display.workArea)||existing.display.scaleFactor!==display.scaleFactor){
          existing.hitRegions=[];existing.lifecycle.setInteractive(false);
          if(!existing.window.isDestroyed())existing.window.setBounds(display.workArea);
        }
        existing.display=display;
        continue;
      }
      const window=this.ports.create(display);
      const entry:PaletteEntry<W>={display,window,lifecycle:new DesktopPaletteLifecycle(window),ready:false,presentable:false,failed:false,enabled:true,hitRegions:[],startupTimer:undefined};
      this.byDisplay.set(display.displayId,entry);
      entry.startupTimer=setTimeout(()=>{if(this.current(entry)&&!entry.ready)this.fail(entry);},10000);
      void this.ports.load(entry).catch(()=>this.fail(entry));
    }
    this.ports.onChanged?.();
  }
  private remove(entry:PaletteEntry<W>):void {
    this.byDisplay.delete(entry.display.displayId);
    clearTimeout(entry.startupTimer);entry.startupTimer=undefined;
    entry.lifecycle.beginQuit();
  }
  ready(entry:PaletteEntry<W>):void {
    if(!this.current(entry)||entry.failed||entry.window.isDestroyed())return;
    entry.ready=true;clearTimeout(entry.startupTimer);entry.startupTimer=undefined;this.ports.onChanged?.();
  }
  fail(entry:PaletteEntry<W>):void {
    if(!this.current(entry)||entry.failed)return;
    entry.ready=false;entry.failed=true;entry.hitRegions=[];
    clearTimeout(entry.startupTimer);entry.startupTimer=undefined;entry.lifecycle.setInteractive(false);
    this.ports.onFailure();this.ports.onChanged?.();
  }
  show(entry:PaletteEntry<W>):void {
    if(this.current(entry)&&entry.presentable&&this.visible&&entry.enabled&&!entry.failed&&!entry.window.isVisible())entry.lifecycle.show();
  }
  markPresentable(entry:PaletteEntry<W>):void {
    if(!this.current(entry)||entry.failed||entry.window.isDestroyed())return;
    entry.presentable=true;this.show(entry);this.ports.onChanged?.();
  }
  showAll():void {if(this.quitting)return;this.visible=true;for(const entry of this.entries())this.show(entry);this.ports.onChanged?.();}
  hideAll():void {if(this.quitting)return;this.visible=false;for(const entry of this.entries())entry.lifecycle.hide();this.ports.onChanged?.();}
  syncVisibility(displayId:number,profileVisible:boolean):void {
    const entry=this.byDisplay.get(displayId);if(!entry||this.quitting)return;
    entry.enabled=profileVisible;
    if(profileVisible)this.show(entry);else entry.lifecycle.hide();
    this.ports.onChanged?.();
  }
  hasRecovery():boolean {return !this.quitting&&this.entries().some(entry=>entry.ready&&!entry.failed&&!entry.window.isDestroyed()&&entry.window.isVisible());}
  setHitRegions(entry:PaletteEntry<W>,regions:readonly MonitorRect[]):void {
    if(!this.current(entry)||entry.window.isDestroyed())return;
    const bounds=entry.window.getContentBounds();
    if(regions.length>16||regions.some(region=>![region.x,region.y,region.width,region.height].every(Number.isFinite)||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>bounds.width+1||region.y+region.height>bounds.height+1))throw new InvalidPaletteHitRegion('Invalid Desktop palette hit regions');
    entry.hitRegions=regions.map(region=>({...region}));
  }
  tick(cursor:Readonly<{x:number;y:number}>):void {
    if(this.quitting)return;
    for(const entry of this.entries()){
      if(entry.failed||entry.window.isDestroyed()||!entry.window.isVisible())continue;
      const bounds=entry.window.getBounds(),x=cursor.x-bounds.x,y=cursor.y-bounds.y;
      entry.lifecycle.setInteractive(entry.hitRegions.some(region=>x>=region.x&&x<region.x+region.width&&y>=region.y&&y<region.y+region.height));
    }
  }
  beginQuit():void {
    if(this.quitting)return;this.quitting=true;
    for(const entry of this.entries())this.remove(entry);
  }
}
