import { PurchaseSession } from './purchase/PurchaseSession';
import { PersistentMemoProvider } from './adapters/PersistentMemo';
import { SyntheticIpcSample } from './SyntheticIpcSample';
import { useEffect, useState, lazy, Suspense } from 'react';
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
import type { DashboardLayout } from '../../src/dashboard/types';
import type { DockLayout } from '../../src/dock/types';
import type { DesktopActionId } from '../../src/desktop/types';
import type { DashboardEditorPanel } from '../../src/components/dashboard/useDesktopNavigation';
const NewsletterStudio=lazy(()=>import('../../src/newsletter/NewsletterStudio').then(m=>({default:m.NewsletterStudio})));
const EducationVideoFinder=lazy(()=>import('../../src/education-video/EducationVideoFinder').then(m=>({default:m.EducationVideoFinder})));
export function P0App() {
  const [initial,setInitial] = useState<{layout:DashboardLayout;dock:DockLayout;info:P0Info}|null>(null);
  const [error,setError] = useState(false);
  useEffect(()=>{
    let active=true;
    void Promise.all([window.electronP0.info(),window.electronP0.readSettings()]).then(([info,s])=>{
      if(!active)return;
      if(info.appId!=='kr.sungandi.schoolhealthdesk.electronp0')throw Error('Wrong PoC identity');
      const layout=s?parseDashboardLayoutValue(s.dashboard):createDefaultDashboardLayout();
      const dock=s?parseDockLayoutValue(s.dock):createDefaultDockLayout();
      if(!layout||!dock)throw Error('Invalid saved PoC layout');
      setInitial({layout,dock,info});
    }).catch(()=>{if(active)setError(true)});
    return ()=>{active=false};
  },[]);
  if(error)return <main role="alert">PoC 설정을 읽지 못했습니다. 기존 파일을 보존하고 앱을 다시 열어 주세요.</main>;
  if(!initial)return <main role="status">ELECTRON-P0를 불러오는 중입니다…</main>;
  return <P0Dashboard initial={initial}/>;
}
function P0Dashboard({initial}:{readonly initial:{layout:DashboardLayout;dock:DockLayout;info:P0Info}}) {
  const [purchaseOpen,setPurchaseOpen]=useState(false);
  const [newsletterOpen,setNewsletterOpen]=useState(false);
  const [newsletterLoaded,setNewsletterLoaded]=useState(false);
  const [educationVideoOpen,setEducationVideoOpen]=useState(false);
  const [layout,setLayout] = useState(initial.layout);
  const [dock,setDock] = useState(initial.dock);
  const info=initial.info;
  const [status,setStatus] = useState('불러오는 중');
  const [editing,setEditing] = useState(false), [panel,setPanel] = useState<DashboardEditorPanel>(null);
  const [selected,setSelected] = useState<string | null>(null), [active,setActive] = useState<DesktopActionId>('home');
  const [notice,setNotice] = useState<string | null>(null);
  const {ref,width} = useElementWidth(); const vh=useViewportHeight(), vw=useViewportWidth();
  const geometry=resolveDeskGeometry(layout,vw);
  const visible=geometry.widgets.filter(w=>w.visible);
  const rows=visible.reduce((max,w)=>Math.max(max,w.y+w.h),1);
  const metrics=calculateDashboardGridMetrics(vh,rows,geometry.dense?geometry:undefined);
  useEffect(()=>{
    let active=true;setStatus('저장 중');
    void window.electronP0.writeSettings({version:1,dashboard:layout,dock}).then(()=>{if(active)setStatus('PoC 설정 저장됨')}).catch(()=>{if(active)setStatus('저장 실패 — 현재 배치를 유지하고 다시 시도해 주세요')});
    return ()=>{active=false};
  },[layout,dock]);
  const excluded=()=>setNotice('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다. 로그인·업무·금융 데이터에 연결하지 않습니다.');
  const navigate=(id:DesktopActionId)=>{
    if(id==='purchase-helper'){setPurchaseOpen(true);setActive('home');setPanel(null);setNotice(null);return;}
    if(['home','settings','quick-memo','toolbox'].includes(id)){setActive(id);setPanel(null);setEditing(false);setNotice(null)}else excluded();
  };
  return <WidgetSessionProvider><PersistentMemoProvider><DesktopPanelProvider notify={setNotice} openInbox={excluded} openBogunonTask={async()=>excluded()} openQuickAddEventForDate={excluded} openQuickAddFromMemo={excluded} openQuickMemoUrl={async()=>excluded()} runDesktopAction={async id=>navigate(id)} workFolderFavorites={[]} openWorkFolderFavorite={async()=>excluded()}>
    <div hidden={newsletterOpen||educationVideoOpen} style={{display:newsletterOpen||educationVideoOpen?"none":undefined}} className={`app-shell workspace-shell ${editing?'is-edit-mode':'is-view-mode'} bg-${layout.appearance.background} card-${layout.appearance.cardStyle} corner-${layout.appearance.cornerStyle}`}>
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
        {active==='quick-memo'?<MemoWidget/>:active==='settings'?<><h1>PoC 설정</h1><button type="button" onClick={()=>{setActive("home");setNewsletterLoaded(true);setNewsletterOpen(true);}}>보건소식지 제작소</button><SyntheticIpcSample/><p>앱 ID: {info?.appId}</p><p>PoC 저장 위치: {info?.userData}</p><p>소스: {info?.sourceSha}</p><p>Electron: {info?.electron}</p><p>자동 업데이트·로그인·운영 데이터 접근 API 없음</p></>:<><h1>업무 도구</h1><button type="button" onClick={()=>{setActive("home");setPurchaseOpen(true);}}>품의 도우미 · 세션 전용</button><button type="button" onClick={()=>{setActive('home');setEducationVideoOpen(true);}}>교육영상 Finder · 합성 Mock</button></>}
      </section></div>}
      {notice&&<div className="p0-notice" role="status">{notice}<button onClick={()=>setNotice(null)}>닫기</button></div>}
      <span className="p0-save" role="status" data-p0-save>{status}</span>
      <div className="dock-zone"><AppDock activeActionId={active} dockLayout={dock} onAction={navigate}/></div>
    </div>
    <PurchaseSession open={purchaseOpen} onClose={()=>setPurchaseOpen(false)}/>
    <div hidden={!newsletterOpen} inert={!newsletterOpen} style={{display:newsletterOpen?undefined:"none"}}>{newsletterLoaded&&<Suspense fallback={<p role="status">소식지 불러오는 중…</p>}><NewsletterStudio onClose={()=>setNewsletterOpen(false)}/></Suspense>}</div>
    {educationVideoOpen&&<Suspense fallback={<main role="status">교육영상 Finder를 불러오는 중…</main>}><EducationVideoFinder onClose={()=>setEducationVideoOpen(false)}/></Suspense>}
  </DesktopPanelProvider></PersistentMemoProvider></WidgetSessionProvider>;
}
