// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {PaletteApp} from '../renderer/palette/PaletteApp';
import {createDefaultDashboardLayout} from '../../src/dashboard/layouts';
import type {PaletteBridge} from '../palette-protocol';

vi.mock('../../src/components/dashboard/DesktopWidgetLayout',()=>({DesktopWidgetLayout:({width,metrics}:{width:number;metrics:{contentHeight:number}})=><div data-widget-type="clock" data-testid="grid" data-width={width} data-height={metrics.contentHeight}/> }));
vi.mock('../renderer/palette/PaletteDock',()=>({PaletteDock:()=>null}));
vi.mock('../../src/components/desktop/DesktopPanelContext',()=>({DesktopPanelProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../../src/dashboard/WidgetSessionContext',()=>({WidgetSessionProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../renderer/local-calendar/LocalCalendarProvider',()=>({LocalCalendarProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../renderer/adapters/workspace',()=>({LocalWorkspaceProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../renderer/adapters/PersistentMemo',()=>({PersistentMemoProvider:({children}:{children:ReactNode})=>children}));

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('remeasures after a transient asynchronous hit-region rejection without replacing valid widgets',async()=>{
  vi.stubGlobal('innerWidth',1200);vi.stubGlobal('innerHeight',800);
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(new DOMRect(10,10,100,100));
  const ready=vi.fn(async()=>undefined);
  const setHitRegions=vi.fn<PaletteBridge['setHitRegions']>().mockRejectedValueOnce(Error('Invalid Desktop palette hit regions')).mockResolvedValue(undefined);
  const api:PaletteBridge={readSettings:async()=>null,readProjection:async()=>({revision:1,value:null,monitorLayout:createDefaultDashboardLayout()}),setInteractive:async()=>undefined,setHitRegions,ready,openWorkspace:async()=>undefined,openSettings:async()=>undefined,onSettingsChanged:()=>()=>undefined};
  vi.stubGlobal('electronPalette',api);
  render(<PaletteApp/>);
  await waitFor(()=>expect(ready).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByTestId('grid')).toBeTruthy();
});

it('keeps repeated hit-region failure closed instead of announcing readiness',async()=>{
  vi.stubGlobal('innerWidth',1200);vi.stubGlobal('innerHeight',800);
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(new DOMRect(10,10,100,100));
  const ready=vi.fn(async()=>undefined);
  const setHitRegions=vi.fn<PaletteBridge['setHitRegions']>().mockRejectedValue(Error('synthetic persistent IPC failure'));
  const api:PaletteBridge={readSettings:async()=>null,readProjection:async()=>({revision:1,value:null,monitorLayout:createDefaultDashboardLayout()}),setInteractive:async()=>undefined,setHitRegions,ready,openWorkspace:async()=>undefined,openSettings:async()=>undefined,onSettingsChanged:()=>()=>undefined};
  vi.stubGlobal('electronPalette',api);
  const view=render(<PaletteApp/>);
  await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled();
  view.unmount();
});

it('ignores a rejected older publication after a newer one has become ready',async()=>{
  vi.stubGlobal('innerWidth',1200);vi.stubGlobal('innerHeight',800);
  const observers:Array<()=>void>=[];
  vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){observers.push(callback);}observe(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(new DOMRect(10,10,100,100));
  let rejectOld:(reason:Error)=>void=()=>{throw Error('publication not started');};
  const old=new Promise<void>((_resolve,reject)=>{rejectOld=reject;});
  const ready=vi.fn(async()=>undefined);
  const setHitRegions=vi.fn<PaletteBridge['setHitRegions']>().mockReturnValueOnce(old).mockResolvedValue(undefined);
  const api:PaletteBridge={readSettings:async()=>null,readProjection:async()=>({revision:1,value:null,monitorLayout:createDefaultDashboardLayout()}),setInteractive:async()=>undefined,setHitRegions,ready,openWorkspace:async()=>undefined,openSettings:async()=>undefined,onSettingsChanged:()=>()=>undefined};
  vi.stubGlobal('electronPalette',api);
  render(<PaletteApp/>);
  await waitFor(()=>expect(setHitRegions).toHaveBeenCalled());
  await act(async()=>{observers.forEach(callback=>callback());});
  await waitFor(()=>expect(ready).toHaveBeenCalled());
  await act(async()=>{rejectOld(Error('stale bounds'));});
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByTestId('grid')).toBeTruthy();
});

it('updates viewport geometry and publishes only visible input after a shrink, then restores without storage writes',async()=>{
  vi.stubGlobal('innerWidth',1920);vi.stubGlobal('innerHeight',1032);
  const observers:Array<()=>void>=[];
  vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){observers.push(callback);}observe(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return this.dataset.widgetType?new DOMRect(10,10,1900,1000):new DOMRect();});
  const submitted:Array<readonly {x:number;y:number;width:number;height:number}[]>=[];
  const setHitRegions=vi.fn(async(regions:readonly {x:number;y:number;width:number;height:number}[])=>{
    if(regions.some(r=>r.x<0||r.y<0||r.x+r.width>window.innerWidth||r.y+r.height>window.innerHeight))throw Error('Invalid Desktop palette hit regions');
    submitted.push(regions);
  });
  const layout=createDefaultDashboardLayout();
  const api:PaletteBridge={readSettings:async()=>null,readProjection:async()=>({revision:1,value:null,monitorLayout:layout}),setInteractive:async()=>undefined,setHitRegions,ready:async()=>undefined,openWorkspace:async()=>undefined,openSettings:async()=>undefined,onSettingsChanged:()=>()=>undefined};
  vi.stubGlobal('electronPalette',api);
  render(<PaletteApp/>);
  await screen.findByTestId('grid');
  const originalHeight=screen.getByTestId('grid').getAttribute('data-height');
  await act(async()=>{vi.stubGlobal('innerWidth',1200);vi.stubGlobal('innerHeight',800);window.dispatchEvent(new Event('resize'));observers.forEach(callback=>callback());});
  await waitFor(()=>expect(screen.getByTestId('grid').getAttribute('data-width')).toBe('1200'));
  expect(screen.getByTestId('grid').getAttribute('data-height')).not.toBe(originalHeight);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(submitted.at(-1)).toEqual([{x:10,y:10,width:1190,height:790}]);
  await act(async()=>{vi.stubGlobal('innerWidth',1920);vi.stubGlobal('innerHeight',1032);window.dispatchEvent(new Event('resize'));observers.forEach(callback=>callback());});
  await waitFor(()=>expect(screen.getByTestId('grid').getAttribute('data-width')).toBe('1920'));
  expect(submitted.at(-1)).toEqual([{x:10,y:10,width:1900,height:1000}]);
  expect(layout).toEqual(createDefaultDashboardLayout());
});
