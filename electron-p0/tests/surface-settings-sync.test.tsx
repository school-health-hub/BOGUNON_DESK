// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { SurfaceSettingsBridge, SurfaceSettingsSnapshot } from '../desktop-surface-protocol';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { createDefaultDockLayout } from '../../src/dock/storage';
import { useSurfaceSettings } from '../renderer/useSurfaceSettings';

afterEach(cleanup);
const first = (): SurfaceSettingsSnapshot => ({revision:0,value:{version:1,dashboard:createDefaultDashboardLayout(),dock:createDefaultDockLayout()}});
function bridge(initial=first()) {
  let current=initial;
  const listeners=new Set<(snapshot:SurfaceSettingsSnapshot)=>void>();
  let flushListener:()=>Promise<void>=async()=>undefined;
  let resumeListener:()=>void=()=>undefined;
  const read=vi.fn(async()=>current);
  const write=vi.fn<SurfaceSettingsBridge['write']>(async request=>{
    if(request.revision!==current.revision)throw new Error('Settings changed');
    current={revision:current.revision+1,value:request.value};
    listeners.forEach(listener=>listener(current));
    return current;
  });
  const api:SurfaceSettingsBridge={read,write,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},onFlush:listener=>{flushListener=listener;return()=>{flushListener=async()=>undefined;};},onResume:listener=>{resumeListener=listener;return()=>{resumeListener=()=>undefined;};}};
  Object.defineProperty(window,'electronSurfaceSettings',{configurable:true,value:api});
  return {read,write,flush:()=>flushListener(),resume:()=>resumeListener(),publish:(snapshot:SurfaceSettingsSnapshot)=>{current=snapshot;listeners.forEach(listener=>listener(snapshot));}};
}

it('does not write when mounting or receiving another surface snapshot',async()=>{
  const api=bridge();
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  const layout={...createDefaultDashboardLayout(),appearance:{...createDefaultDashboardLayout().appearance,background:'lavender' as const}};
  act(()=>api.publish({revision:1,value:{version:1,dashboard:layout,dock:createDefaultDockLayout()}}));
  await waitFor(()=>expect(result.current.layout.appearance.background).toBe('lavender'));
  expect(api.write).not.toHaveBeenCalled();
});

it('saves explicit edits with the current revision and keeps queued dock changes',async()=>{
  const api=bridge();
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  act(()=>{
    result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'lavender'}}));
    result.current.setDock(dock=>({...dock,items:dock.items.map(item=>({...item,visible:false}))}));
  });
  await waitFor(()=>expect(result.current.status).toBe('PoC 설정 저장됨'));
  expect(api.write).toHaveBeenCalledTimes(2);
  expect(api.write.mock.calls[1]?.[0].revision).toBe(1);
  expect(result.current.layout.appearance.background).toBe('lavender');
  expect(result.current.dock.items.every(item=>!item.visible)).toBe(true);
});

it('reloads a rejected stale edit without writing the discarded draft again',async()=>{
  const api=bridge();
  const newer={revision:2,value:{version:1 as const,dashboard:createDefaultDashboardLayout(),dock:createDefaultDockLayout()}};
  api.write.mockImplementationOnce(async()=>{api.publish(newer);throw new Error('Settings changed');});
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  act(()=>result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'lavender'}})));
  await waitFor(()=>expect(result.current.status).toContain('최신 설정'));
  expect(result.current.layout.appearance.background).toBe(createDefaultDashboardLayout().appearance.background);
  expect(api.write).toHaveBeenCalledOnce();
  expect(api.read).toHaveBeenCalled();
});

it('does not submit an edit made while conflict recovery is waiting for a newer snapshot',async()=>{
  const api=bridge();
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  let resolveRecovery:(snapshot:SurfaceSettingsSnapshot)=>void=()=>undefined;
  const recovery=new Promise<SurfaceSettingsSnapshot>(resolve=>{resolveRecovery=resolve;});
  api.read.mockImplementationOnce(()=>recovery);
  api.write.mockRejectedValueOnce(new Error('Settings changed'));
  act(()=>result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'mint'}})));
  await waitFor(()=>expect(api.read).toHaveBeenCalledTimes(2));
  act(()=>result.current.setDock(dock=>({...dock,items:dock.items.map(item=>({...item,visible:false}))})));
  const latestLayout={...createDefaultDashboardLayout(),appearance:{...createDefaultDashboardLayout().appearance,background:'lavender' as const}};
  await act(async()=>resolveRecovery({revision:2,value:{version:1,dashboard:latestLayout,dock:createDefaultDockLayout()}}));
  await waitFor(()=>expect(result.current.status).toContain('최신 설정'));
  expect(api.write).toHaveBeenCalledOnce();
  expect(result.current.layout.appearance.background).toBe('lavender');
  expect(result.current.dock).toEqual(createDefaultDockLayout());
});

it('waits for both an in-flight edit and a queued edit before acknowledging flush',async()=>{
  const api=bridge();
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  let finishFirst:(snapshot:SurfaceSettingsSnapshot)=>void=()=>undefined;
  api.write.mockImplementationOnce(()=>new Promise(resolve=>{finishFirst=resolve;}));
  act(()=>{
    result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'mint'}}));
    result.current.setDock(dock=>({...dock,items:dock.items.map(item=>({...item,visible:false}))}));
  });
  let acknowledged=false;
  const flush=api.flush().then(()=>{acknowledged=true;});
  await act(async()=>{await Promise.resolve();});
  expect(acknowledged).toBe(false);
  const written=api.write.mock.calls[0]?.[0].value;
  if(!written)throw new Error('Expected first write');
  await act(async()=>{api.publish({revision:1,value:written});finishFirst({revision:1,value:written});await flush;});
  expect(api.write).toHaveBeenCalledTimes(2);
  expect(api.write.mock.calls[1]?.[0].revision).toBe(1);
  expect(acknowledged).toBe(true);
});

it('rejects the flush acknowledgement when a pending write fails',async()=>{
  const api=bridge();
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  api.write.mockRejectedValueOnce(new Error('disk unavailable'));
  act(()=>result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'mint'}})));
  await act(async()=>{await expect(api.flush()).rejects.toThrow('disk unavailable');});
});

it('keeps edits frozen after acknowledging flush until Main resumes a cancelled quit',async()=>{
  const api=bridge();
  const {result}=renderHook(()=>useSurfaceSettings(first()));
  await act(async()=>{await api.flush();});
  act(()=>result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'mint'}})));
  expect(api.write).not.toHaveBeenCalled();
  expect(result.current.layout.appearance.background).toBe(createDefaultDashboardLayout().appearance.background);
  act(()=>api.resume());
  act(()=>result.current.setLayout(layout=>({...layout,appearance:{...layout.appearance,background:'mint'}})));
  await waitFor(()=>expect(api.write).toHaveBeenCalledOnce());
  expect(result.current.layout.appearance.background).toBe('mint');
});
