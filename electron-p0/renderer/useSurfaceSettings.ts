import { useEffect, useRef, useState, type SetStateAction } from 'react';
import type { SurfaceSettingsSnapshot, SurfaceSettingsWrite } from '../desktop-surface-protocol';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { parseDashboardLayoutValue } from '../../src/dashboard/storage';
import { createDefaultDockLayout, parseDockLayoutValue } from '../../src/dock/storage';
import type { DashboardLayout } from '../../src/dashboard/types';
import type { DockLayout } from '../../src/dock/types';

type Model = Readonly<{layout:DashboardLayout;dock:DockLayout}>;
function model(snapshot:SurfaceSettingsSnapshot):Model {
  if(!snapshot.value)return {layout:createDefaultDashboardLayout(),dock:createDefaultDockLayout()};
  const layout=parseDashboardLayoutValue(snapshot.value.dashboard),dock=parseDockLayoutValue(snapshot.value.dock);
  if(!layout||!dock)throw new TypeError('Invalid saved surface settings');
  return {layout,dock};
}
function isUpdater<T>(update:SetStateAction<T>):update is (value:T)=>T {
  return typeof update==='function';
}
function nextValue<T>(update:SetStateAction<T>,current:T):T {
  return isUpdater(update) ? update(current) : update;
}

export function useSurfaceSettings(initial:SurfaceSettingsSnapshot) {
  const api=window.electronSurfaceSettings;
  const [view,setView]=useState(()=>model(initial));
  const [status,setStatus]=useState('PoC 설정 저장됨');
  const current=useRef(initial),optimistic=useRef(view),queued=useRef<Model|null>(null);
  const running=useRef(false),recovering=useRef(false),inflight=useRef<SurfaceSettingsWrite|null>(null),live=useRef(true);
  const flushing=useRef(false),failure=useRef<Error|null>(null),idleWaiters=useRef(new Set<()=>void>());
  const show=(next:Model)=>{optimistic.current=next;if(live.current)setView(next);};
  const receive=(snapshot:SurfaceSettingsSnapshot)=>{
    if(snapshot.revision<=current.current.revision)return;
    const own=inflight.current?.revision===snapshot.revision-1&&JSON.stringify(inflight.current.value)===JSON.stringify(snapshot.value);
    current.current=snapshot;
    if(!own)queued.current=null;
    if(!queued.current)show(model(snapshot));
    if(live.current)setStatus(own?'PoC 설정 저장됨':'다른 창의 최신 설정을 적용했습니다.');
  };
  useEffect(()=>{
    live.current=true;
    const unsubscribe=api.subscribe(receive);
    const unsubscribeFlush=api.onFlush?.(()=>flush());
    const unsubscribeResume=api.onResume?.(()=>{flushing.current=false;});
    void api.read().then(snapshot=>{if(live.current)receive(snapshot);}).catch(error=>{
      if(live.current)setStatus(error instanceof Error?`설정 확인 실패 — ${error.message}`:'설정 확인 실패');
    });
    return()=>{live.current=false;unsubscribe();unsubscribeFlush?.();unsubscribeResume?.();};
  },[api]);

  const drain=async()=>{
    if(running.current)return;
    running.current=true;
    try {
      while(queued.current&&live.current){
        const next=queued.current;
        queued.current=null;
        const request:SurfaceSettingsWrite={revision:current.current.revision,value:{version:1,dashboard:next.layout,dock:next.dock}};
        inflight.current=request;
        if(live.current)setStatus('저장 중');
        try {
          const saved=await api.write(request);
          receive(saved);
          if(live.current&&!queued.current)setStatus('PoC 설정 저장됨');
        } catch(error) {
          failure.current=error instanceof Error?error:new Error('설정 저장 실패');
          recovering.current=true;
          queued.current=null;
          try {
            const latest=await api.read();
            if(latest.revision>=current.current.revision){current.current=latest;show(model(latest));}
            if(live.current)setStatus('저장하지 못한 변경을 지우고 최신 설정을 다시 불러왔습니다. 변경 내용을 확인한 뒤 다시 시도해 주세요.');
          } catch(reloadError) {
            show(model(current.current));
            if(live.current)setStatus(reloadError instanceof Error?`저장·설정 확인 실패 — ${reloadError.message}`:error instanceof Error?`설정 저장 실패 — ${error.message}`:'설정 저장 실패');
          } finally {recovering.current=false;}
        } finally {inflight.current=null;}
      }
    } finally {running.current=false;idleWaiters.current.forEach(resolve=>resolve());idleWaiters.current.clear();}
  };
  const flush=async()=>{
    flushing.current=true;
    if(running.current)await new Promise<void>(resolve=>idleWaiters.current.add(resolve));
    else await drain();
    if(failure.current)throw failure.current;
  };
  const edit=(next:Model)=>{if(recovering.current||flushing.current)return;failure.current=null;show(next);queued.current=next;void drain();};
  const setLayout=(update:SetStateAction<DashboardLayout>)=>edit({...optimistic.current,layout:nextValue(update,optimistic.current.layout)});
  const setDock=(update:SetStateAction<DockLayout>)=>edit({...optimistic.current,dock:nextValue(update,optimistic.current.dock)});
  return {...view,setLayout,setDock,status};
}
