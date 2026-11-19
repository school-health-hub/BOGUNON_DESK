import {expect,it,vi} from 'vitest';
import {DesktopPaletteLifecycle,desktopPaletteOptions} from '../main/desktop-palette';
import {clipPaletteRegions} from '../main/desktop-surface-controller';

it('creates a transparent frameless non-taskbar palette without WorkerW attachment',()=>{
  expect(desktopPaletteOptions({x:-1920,y:0,width:1920,height:1040})).toMatchObject({x:-1920,y:0,width:1920,height:1040,transparent:true,frame:false,skipTaskbar:true,alwaysOnTop:false,show:false});
});

it('clicks through empty space and enables input only for declared regions',()=>{
  const setIgnoreMouseEvents=vi.fn();
  const window={isDestroyed:()=>false,isVisible:()=>false,showInactive:vi.fn(),hide:vi.fn(),destroy:vi.fn(),setIgnoreMouseEvents};
  const lifecycle=new DesktopPaletteLifecycle(window);
  lifecycle.show();
  lifecycle.setInteractive(true);
  lifecycle.setInteractive(false);
  expect(setIgnoreMouseEvents.mock.calls).toEqual([[true,{forward:true}],[false],[true,{forward:true}]]);
});

it('clips partially visible hit regions and ignores fully off-screen widgets',()=>{
  expect(clipPaletteRegions([{x:-10,y:5,width:30,height:20},{x:0,y:120,width:20,height:20}],{width:100,height:100})).toEqual([{x:0,y:5,width:20,height:20}]);
});
