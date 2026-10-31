import { useEffect, useState } from 'react';
import type { P0Info } from '../protocol';
import { DesktopWidgetLayout } from '../../src/components/dashboard/DesktopWidgetLayout';
import { DashboardToolbar } from '../../src/components/dashboard/DashboardToolbar';
import { WidgetLibraryDrawer } from '../../src/components/dashboard/WidgetLibraryDrawer';
import { AppearancePanel } from '../../src/components/dashboard/AppearancePanel';
import { PresetSelector } from '../../src/components/dashboard/PresetSelector';
import { AppDock } from '../../src/dock/AppDock';
import { DockEditor } from '../../src/dock/DockEditor';
import { MemoWidget } from '../../src/widgets/MemoWidget';
import { WidgetSessionProvider } from '../../src/dashboard/WidgetSessionContext';
import { DesktopPanelProvider } from '../../src/components/desktop/DesktopPanelContext';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { createDefaultDockLayout, parseDockLayoutValue } from '../../src/dock/storage';
import { parseDashboardLayoutValue } from '../../src/dashboard/storage';
import { hideWidget, restoreWidget } from '../../src/dashboard/layoutTransforms';
import { mergeRenderedGridLayout, resolveDeskGeometry } from '../../src/dashboard/deskGeometry';
import { applyPreset, calculateDashboardGridMetrics, useElementWidth, useViewportHeight, useViewportWidth } from '../../src/components/dashboard/dashboardCanvasSupport';
import type { DesktopActionId } from '../../src/desktop/types';
import type { DashboardEditorPanel } from '../../src/components/dashboard/useDesktopNavigation';
export function P0App() {
  const [layout,setLayout] = useState(createDefaultDashboardLayout);
  const [dock,setDock] = useState(createDefaultDockLayout);
  const [loaded,setLoaded] = useState(false), [info,setInfo] = useState<P0Info | null>(null);
  const [error,setError] = useState<string | null>(null), [status,setStatus] = useState('불러오는 중');
  const [editing,setEditing] = useState(false), [panel,setPanel] = useState<DashboardEditorPanel>(null);
  const [selected,setSelected] = useState<string | null>(null), [active,setActive] = useState<DesktopActionId>('home');
  const [notice,setNotice] = useState<string | null>(null);
  const {ref,width} = useElementWidth(); const vh=useViewportHeight(), vw=useViewportWidth();
  const geometry=resolveDeskGeometry(layout,vw);
  const visible=geometry.widgets.filter(w=>w.visible);
  const rows=visible.reduce((max,w)=>Math.max(max,w.y+w.h),1);
  const metrics=calculateDashboardGridMetrics(vh,rows,geometry.dense?geometry:undefined);
  useEffect(()=>{
    let active=true;
    void Promise.all([window.electronP0.info(),window.electronP0.readSettings()]).then(([i,s])=>{
      if(!active)return;
      if(i.appId!=='kr.sungandi.schoolhealthdesk.electronp0')throw Error('Wrong PoC identity');
      if(s){const l=parseDashboardLayoutValue(s.dashboard),d=parseDockLayoutValue(s.dock);if(!l||!d)throw Error('Invalid saved PoC layout');setLayout(l);setDock(d);}
      setInfo(i);setLoaded(true);
    }).catch(()=>{if(active)setError('PoC 설정을 읽지 못했습니다. 기존 파일을 보존하고 앱을 다시 열어 주세요.');});
    return ()=>{active=false};
  },[]);
  useEffect(()=>{
    if(!loaded)return;
    let active=true;setStatus('저장 중');
    void window.electronP0.writeSettings({version:1,dashboard:layout,dock}).then(()=>{if(active)setStatus('PoC 설정 저장됨')}).catch(()=>{if(active)setStatus('저장 실패 — 현재 배치를 유지하고 다시 시도해 주세요')});
    return ()=>{active=false};
  },[layout,dock,loaded]);
  const excluded=()=>setNotice('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다. 로그인·업무·금융 데이터에 연결하지 않습니다.');
  const navigate=(id:DesktopActionId)=>{
    if(['home','settings','quick-memo','toolbox'].includes(id)){setActive(id);setPanel(null);setEditing(false);setNotice(null)}else excluded();
  };
  if(error)return <main role="alert">{error}</main>;
  if(!loaded)return <main role="status">ELECTRON-P0를 불러오는 중입니다…</main>;
  return <WidgetSessionProvider><DesktopPanelProvider notify={setNotice} openInbox={excluded} openBogunonTask={async()=>excluded()} openQuickAddEventForDate={excluded} openQuickAddFromMemo={excluded} openQuickMemoUrl={async()=>excluded()} runDesktopAction={async id=>navigate(id)} workFolderFavorites={[]} openWorkFolderFavorite={async()=>excluded()}>
    <div className={`app-shell workspace-shell ${editing?'is-edit-mode':'is-view-mode'} bg-${layout.appearance.background} card-${layout.appearance.cardStyle} corner-${layout.appearance.cornerStyle}`}>
      <div className="p0-banner">ELECTRON-P0 · 합성/빈 데이터 전용 · 로그인·업무·금융 연결 없음</div>
      <DashboardToolbar activePanel={panel} isEditing={editing} onOpenPanel={p=>setPanel(panel===p?null:p)} onOpenQuickAdd={excluded} onReset={()=>{if(window.confirm('PoC 배치만 기본값으로 되돌릴까요?'))setLayout(createDefaultDashboardLayout())}} onToggleEdit={()=>{setEditing(!editing);setPanel(null);setSelected(null);setActive('home')}}/>
      <main ref={ref} aria-label="보건실 업무 위젯 작업 공간" className={`dashboard workspace-dashboard${metrics.requiresScroll?' is-scrollable':''}${geometry.dense?' is-dense-desk':''}`}>
        {width!==null&&<DesktopWidgetLayout widgets={geometry.widgets} width={Math.max(320,width)} compact={width<900} editing={editing} selectedId={selected} metrics={metrics} onSelect={setSelected} onHide={id=>setLayout(hideWidget({...layout,widgets:geometry.widgets},id))} onLayoutChange={next=>{if(editing&&width>=900)setLayout(current=>mergeRenderedGridLayout(current,resolveDeskGeometry(current,vw).widgets,next))}}/>}
      </main>
      {editing&&panel==='library'&&<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>setPanel(null)} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>}
      {editing&&panel==='appearance'&&<AppearancePanel appearance={layout.appearance} onClose={()=>setPanel(null)} onUpdate={appearance=>setLayout({...layout,appearance})}/>}
      {editing&&panel==='presets'&&<PresetSelector currentPresetId={layout.presetId} onClose={()=>setPanel(null)} onApply={id=>setLayout(applyPreset(layout,id,window.confirm))}/>}
      {editing&&panel==='dock'&&<DockEditor dockLayout={dock} onClose={()=>setPanel(null)} onUpdate={setDock}/>}
      {active!=='home'&&<div className="desktop-panel-backdrop"><section className="desktop-panel p0-panel" role="dialog" aria-label={active==='settings'?'PoC 설정':active==='quick-memo'?'빠른 메모':'업무 도구'}><button type="button" onClick={()=>navigate('home')}>홈으로</button>
        {active==='quick-memo'?<MemoWidget/>:active==='settings'?<><h1>PoC 설정</h1><p>앱 ID: {info?.appId}</p><p>PoC 저장 위치: {info?.userData}</p><p>소스: {info?.sourceSha}</p><p>Electron: {info?.electron}</p><p>자동 업데이트·로그인·파일 접근 API 없음</p></>:<><h1>업무 도구</h1><p>업무 기능은 이번 PoC에 연결하지 않았습니다.</p></>}
      </section></div>}
      {notice&&<div className="p0-notice" role="status">{notice}<button onClick={()=>setNotice(null)}>닫기</button></div>}
      <span className="p0-save" role="status" data-p0-save>{status}</span>
      <AppDock activeActionId={active} dockLayout={dock} onAction={navigate}/>
    </div>
  </DesktopPanelProvider></WidgetSessionProvider>;
}
