import {afterEach,describe,expect,it,vi} from 'vitest';
import {PaletteRegistry,type PaletteRegistryWindow} from '../main/palette-registry';
import type {MonitorObservation,MonitorRect} from '../monitor-protocol';
import {ensureDesktopAccess} from '../main/desktop-palette';

class WindowFixture implements PaletteRegistryWindow {
  readonly webContents={};
  visible=false;destroyed=false;interactive=false;
  bounds:MonitorRect={x:0,y:0,width:100,height:100};
  isDestroyed(){return this.destroyed;}
  isVisible(){return this.visible;}
  showInactive(){this.visible=true;}
  hide(){this.visible=false;}
  setIgnoreMouseEvents(ignore:boolean){this.interactive=!ignore;}
  destroy(){this.destroyed=true;this.visible=false;}
  setBounds(bounds:MonitorRect){this.bounds=bounds;}
  getBounds(){return this.bounds;}
  getContentBounds(){return this.bounds;}
}
const display=(id:number,x=0,scaleFactor=1):MonitorObservation=>({displayId:id,label:`Monitor ${id}`,primary:id===1,bounds:{x,y:0,width:100,height:100},workArea:{x,y:0,width:100,height:100},scaleFactor,identityKey:null,identityKind:'uncertain'});
function fixture(load:(entry:unknown)=>Promise<void>=async()=>{}){
  const failures=vi.fn(),registry=new PaletteRegistry({create:display=>{const window=new WindowFixture();window.setBounds(display.workArea);return window;},load,onFailure:failures});
  return {registry,failures};
}
function present(registry:PaletteRegistry<WindowFixture>){for(const entry of registry.entries())registry.markPresentable(entry);}
afterEach(()=>vi.useRealTimers());
describe('PaletteRegistry',()=>{
  it('retains surviving windows and invalidates removed senders across topology bursts',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.reconcile([display(1),display(2,-100)]);
    const first=registry.entries()[0],removed=registry.entries()[1];expect(first).toBeDefined();expect(removed).toBeDefined();if(!first||!removed)return;
    registry.reconcile([display(1,0,1.5),display(3,100)]);
    expect(registry.entries()[0]).toBe(first);expect(registry.entries()).toHaveLength(2);expect(removed.window.isDestroyed()).toBe(true);expect(registry.forSender(removed.window.webContents)).toBeUndefined();expect(registry.forSender({})).toBeUndefined();registry.beginQuit();
  });
  it('clears hit regions and interaction after negative-coordinate workArea or DPI changes',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.reconcile([display(1)]);present(registry);const entry=registry.entries()[0];if(!entry)throw Error('missing');registry.showAll();registry.setHitRegions(entry,[{x:0,y:0,width:20,height:20}]);registry.tick({x:10,y:10});
    registry.reconcile([display(1,-100,2)]);
    expect(entry.hitRegions).toEqual([]);expect(entry.window.getBounds().x).toBe(-100);expect(entry.window).toHaveProperty('interactive',false);registry.beginQuit();
  });
  it('keeps newly attached displays hidden and respects profile visibility during explicit show',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.hideAll();registry.reconcile([display(1),display(2)]);const entry=registry.entries()[0];if(!entry)throw Error('missing');registry.syncVisibility(1,false);
    present(registry);registry.showAll();
    expect(entry.window.isVisible()).toBe(false);expect(registry.entries()[1]?.window.isVisible()).toBe(true);registry.beginQuit();
  });
  it('reports only current failed entries and ignores pending failures after quit',async()=>{
    vi.useFakeTimers();let rejectLoad:((error:Error)=>void)|undefined;const {registry,failures}=fixture(()=>new Promise<void>((_resolve,reject)=>{rejectLoad=reject;}));registry.reconcile([display(1)]);present(registry);const entry=registry.entries()[0];if(!entry)throw Error('missing');registry.ready(entry);registry.showAll();expect(registry.hasRecovery()).toBe(true);
    registry.beginQuit();rejectLoad?.(Error('late load'));await Promise.resolve();registry.fail(entry);registry.reconcile([display(2)]);vi.advanceTimersByTime(10000);
    expect(registry.entries()).toEqual([]);expect(failures).not.toHaveBeenCalled();expect(registry.hasRecovery()).toBe(false);
  });
  it('opens fallback after an unready display times out while retaining another recovery route',()=>{
    vi.useFakeTimers();const {registry,failures}=fixture();registry.reconcile([display(1),display(2)]);present(registry);const entry=registry.entries()[0];if(!entry)throw Error('missing');registry.ready(entry);registry.showAll();
    vi.advanceTimersByTime(10000);
    expect(failures).toHaveBeenCalledOnce();expect(registry.hasRecovery()).toBe(true);registry.beginQuit();
  });
  it('does not let a removed generation mark its replacement ready or failed',()=>{
    vi.useFakeTimers();const {registry,failures}=fixture();registry.reconcile([display(1)]);const old=registry.entries()[0];if(!old)throw Error('missing');registry.reconcile([]);registry.reconcile([display(1)]);const replacement=registry.entries()[0];if(!replacement)throw Error('missing');
    registry.ready(old);registry.fail(old);
    expect(replacement.ready).toBe(false);expect(replacement.failed).toBe(false);expect(failures).not.toHaveBeenCalled();registry.beginQuit();
  });
  it('routes cursor input independently by each display origin and rejects oversized regions',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.reconcile([display(1),display(2,-100)]);present(registry);registry.showAll();for(const entry of registry.entries())registry.setHitRegions(entry,[{x:0,y:0,width:20,height:20}]);
    registry.tick({x:-90,y:10});
    expect(registry.entries()[0]?.window).toHaveProperty('interactive',false);expect(registry.entries()[1]?.window).toHaveProperty('interactive',true);const entry=registry.entries()[0];if(!entry)throw Error('missing');expect(()=>registry.setHitRegions(entry,[{x:99,y:0,width:20,height:20}])).toThrow('Invalid Desktop palette hit regions');registry.beginQuit();
  });
  it('never flashes a profile disabled before presentation readiness',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.reconcile([display(1)]);const entry=registry.entries()[0];if(!entry)throw Error('missing');const show=vi.spyOn(entry.window,'showInactive');registry.syncVisibility(1,false);
    registry.markPresentable(entry);registry.showAll();
    expect(show).not.toHaveBeenCalled();expect(entry.window.isVisible()).toBe(false);registry.beginQuit();
  });
  it('waits for presentation readiness when showAll is requested during load',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.reconcile([display(1)]);const entry=registry.entries()[0];if(!entry)throw Error('missing');registry.showAll();expect(entry.window.isVisible()).toBe(false);
    registry.markPresentable(entry);
    expect(entry.window.isVisible()).toBe(true);registry.beginQuit();
  });
  it('preserves input mode when showing an already visible palette',()=>{
    vi.useFakeTimers();const {registry}=fixture();registry.reconcile([display(1)]);present(registry);const entry=registry.entries()[0];if(!entry)throw Error('missing');entry.lifecycle.setInteractive(true);
    registry.showAll();registry.syncVisibility(1,true);
    expect(entry.window.interactive).toBe(true);registry.beginQuit();
  });
});

describe('Palette recovery and Workspace access',()=>{
  function recoveryFixture(count=1){
    const showWorkspace=vi.fn();
    const state={ready:false,quitting:false,trayAvailable:false};
    const registry:PaletteRegistry<WindowFixture>=new PaletteRegistry({create:()=>new WindowFixture(),load:async()=>{},onFailure:()=>{},onChanged:():void=>ensureDesktopAccess({...state,paletteAvailable:registry.hasRecovery()},showWorkspace)});
    registry.reconcile(Array.from({length:count},(_value,index)=>display(index+1)));
    for(const entry of registry.entries()){registry.markPresentable(entry);registry.ready(entry);}
    state.ready=true;
    return {registry,state,showWorkspace};
  }
  it.each(['hide','profile','remove'] as const)('reveals the hidden Workspace when %s removes the last recovery route',action=>{
    vi.useFakeTimers();const {registry,showWorkspace}=recoveryFixture();
    switch(action){case 'hide':registry.hideAll();break;case 'profile':registry.syncVisibility(1,false);break;case 'remove':registry.reconcile([]);break;}
    expect(showWorkspace).toHaveBeenCalledOnce();registry.beginQuit();
  });
  it.each(['profile','remove'] as const)('retains a hidden Workspace when another ready Palette survives %s',action=>{
    vi.useFakeTimers();const {registry,showWorkspace}=recoveryFixture(2);
    switch(action){case 'profile':registry.syncVisibility(1,false);break;case 'remove':registry.reconcile([display(2)]);break;}
    expect(registry.hasRecovery()).toBe(true);expect(showWorkspace).not.toHaveBeenCalled();registry.beginQuit();
  });
  it.each(['startup','quit','tray'] as const)('does not reveal Workspace when %s guards recovery handling',guard=>{
    vi.useFakeTimers();const {registry,state,showWorkspace}=recoveryFixture();
    switch(guard){case 'startup':state.ready=false;break;case 'quit':state.quitting=true;break;case 'tray':state.trayAvailable=true;break;}
    registry.hideAll();
    expect(showWorkspace).not.toHaveBeenCalled();registry.beginQuit();
  });
});
