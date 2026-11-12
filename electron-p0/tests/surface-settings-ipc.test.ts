import { expect, it, vi } from 'vitest';
import { createSurfaceSettingsHandlers } from '../main/surface-settings-ipc';
import { SurfaceSettingsAuthority } from '../main/surface-settings-authority';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { createDefaultDockLayout } from '../../src/dock/storage';
import type { P0Settings } from '../protocol';

const settings=():P0Settings=>({version:1,dashboard:createDefaultDashboardLayout(),dock:createDefaultDockLayout()});
function setup() {
  const workspace={mainFrame:{},getURL:()=> 'file:///renderer/index.html'};
  const settingsWindow={mainFrame:{},getURL:()=> 'file:///renderer/settings/index.html'};
  const palette={mainFrame:{},getURL:()=> 'file:///renderer/palette/index.html'};
  const read=vi.fn(async()=>null);
  const write=vi.fn(async(_value:P0Settings)=>undefined);
  const authority=new SurfaceSettingsAuthority({read,write},()=>undefined);
  const handlers=createSurfaceSettingsHandlers([{contents:workspace,url:workspace.getURL()},{contents:settingsWindow,url:settingsWindow.getURL()}],authority);
  return {workspace,settingsWindow,palette,read,write,handlers};
}

it('allows the exact Workspace and Settings main frames to share one authority',async()=>{
  const s=setup();
  const workspaceEvent={sender:s.workspace,senderFrame:s.workspace.mainFrame};
  const settingsEvent={sender:s.settingsWindow,senderFrame:s.settingsWindow.mainFrame};
  const saved=await s.handlers.write(settingsEvent,{revision:0,value:settings()});
  expect(await s.handlers.read(workspaceEvent)).toEqual(saved);
  expect(await s.handlers.read(settingsEvent)).toEqual(saved);
  expect(s.write).toHaveBeenCalledOnce();
});

it.each(['foreign','palette','subframe','navigated'] as const)('rejects %s senders before reading or writing settings',async kind=>{
  const s=setup();
  const sender=kind==='foreign'?{mainFrame:{},getURL:s.settingsWindow.getURL}:kind==='palette'?s.palette:s.settingsWindow;
  const event={sender,senderFrame:kind==='subframe'?{}:sender.mainFrame};
  if(kind==='navigated')s.settingsWindow.getURL=()=> 'https://example.invalid/';
  await expect(s.handlers.read(event)).rejects.toThrow();
  await expect(s.handlers.write(event,{revision:0,value:settings()})).rejects.toThrow();
  expect(s.read).not.toHaveBeenCalled();
  expect(s.write).not.toHaveBeenCalled();
});

it('rejects extra read arguments before accessing the store',async()=>{
  const s=setup(),event={sender:s.settingsWindow,senderFrame:s.settingsWindow.mainFrame};
  await expect(s.handlers.read(event,'unexpected')).rejects.toThrow('Invalid settings read');
  expect(s.read).not.toHaveBeenCalled();
});

it.each<Readonly<{label:string;args:readonly unknown[]}>>([
  {label:'missing',args:[]},{label:'undefined',args:[undefined]},{label:'null',args:[null]},
  {label:'missing value',args:[{revision:0}]},{label:'missing revision',args:[{value:settings()}]},
  {label:'string revision',args:[{revision:'0',value:settings()}]},
  {label:'unknown field',args:[{revision:0,value:settings(),path:'private'}]},
  {label:'extra argument',args:[{revision:0,value:settings()},'unexpected']},
  {label:'invalid document',args:[{revision:0,value:{version:1}}]},
])('rejects malformed write arguments without accessing the store: $label',async ({args})=>{
  const s=setup(),event={sender:s.settingsWindow,senderFrame:s.settingsWindow.mainFrame};
  await expect(s.handlers.write(event,...args)).rejects.toThrow();
  expect(s.read).not.toHaveBeenCalled();
  expect(s.write).not.toHaveBeenCalled();
});
