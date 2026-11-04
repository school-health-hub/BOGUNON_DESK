import {SchoolProfileProvider,SchoolInitialSetup,SchoolProfileSettings} from './school-profile/SchoolProfile';
import {AiSettings,AiAssistant} from './ai/AiTools';
import type {InventoryPurchaseRequest} from './purchase/inventoryPurchase';
import {LocalWorkspaceStatus} from './local-tasks/LocalNotices';
import {LocalWorkspaceProvider} from './adapters/workspace';
import {LocalTasksPanel,type LocalTaskRequest} from './local-tasks/LocalTasksPanel';
import {ShoppingCart,FileText,Search,Database,Wallet,BriefcaseBusiness} from 'lucide-react';
import {SurfaceDialog} from './SurfaceDialog';
import {SurfaceSettings} from './SurfaceSettings';
import {ToolCard} from './ToolCard';
import {InventoryLocalQa} from './inventory-local-qa/InventoryLocalQa';
import {InventoryEntryButtons} from './inventory-preview/InventoryEntryButtons';
import { PurchaseSession } from './purchase/PurchaseSession';
import { PersistentMemoProvider } from './adapters/PersistentMemo';
import { SyntheticIpcSample } from './SyntheticIpcSample';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { P0Info } from '../protocol';
import { DesktopWidgetLayout } from '../../src/components/dashboard/DesktopWidgetLayout';
import { DashboardToolbar } from '../../src/components/dashboard/DashboardToolbar';
import { WidgetLibraryDrawer } from '../../src/components/dashboard/WidgetLibraryDrawer';
import { AppearancePanel } from '../../src/components/dashboard/AppearancePanel';
import { PresetSelector } from '../../src/components/dashboard/PresetSelector';
import { AppDock } from '../../src/dock/AppDock';
import { DockEditor } from '../../src/dock/DockEditor';
import { MemoWidget } from '../../src/widgets/MemoWidget';
import { WidgetSessionProvider,useWidgetSession } from '../../src/dashboard/WidgetSessionContext';
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
const OfficialDocumentWorkspace=lazy(()=>import('../../src/official-document/OfficialDocumentWorkspace').then(m=>({default:m.OfficialDocumentWorkspace})));
const SchoolAdmin=lazy(()=>import('./school-admin/SchoolAdmin').then(m=>({default:m.SchoolAdmin})));
const FinanceHost=lazy(()=>import('./finance/FinanceHost').then(m=>({default:m.FinanceHost})));
const InventoryHost=lazy(()=>import('./inventory-preview/InventoryHost').then(m=>({default:m.InventoryHost})));
function SurfaceDate(){const {now}=useWidgetSession();return <time dateTime={now.toISOString()}>{new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(now)}</time>;}
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
  return <SchoolProfileProvider><P0Dashboard initial={initial}/></SchoolProfileProvider>;
}
function P0Dashboard({initial}:{readonly initial:{layout:DashboardLayout;dock:DockLayout;info:P0Info}}) {
  const [adminOpen,setAdminOpen]=useState(false);
  const [financeOpen,setFinanceOpen]=useState(false);
  const [aiSettingsOpen,setAiSettingsOpen]=useState(false);
  const [taskRequest,setTaskRequest]=useState<LocalTaskRequest|null>(null);
  const openTasks=(input:Omit<LocalTaskRequest,'key'>={})=>setTaskRequest({...input,key:crypto.randomUUID()});
  const [purchaseOpen,setPurchaseOpen]=useState(false);
  const [purchaseIncoming,setPurchaseIncoming]=useState<InventoryPurchaseRequest|null>(null);
  const [newsletterOpen,setNewsletterOpen]=useState(false);
  const [newsletterLoaded,setNewsletterLoaded]=useState(false);
  const [educationVideoOpen,setEducationVideoOpen]=useState(false);
  const [officialDocumentOpen,setOfficialDocumentOpen]=useState(false);
  const [inventoryOpen,setInventoryOpen]=useState(false);
  const [inventoryQaOpen,setInventoryQaOpen]=useState(false);
  const [inventoryMode,setInventoryMode]=useState<'local'|'preview'>('local');
  const [layout,setLayout] = useState(initial.layout);
  const [dock,setDock] = useState(initial.dock);
  const info=initial.info;
  const [status,setStatus] = useState('불러오는 중');
  const [editing,setEditing] = useState(false), [panel,setPanel] = useState<DashboardEditorPanel>(null);
  const [selected,setSelected] = useState<string | null>(null), [active,setActive] = useState<DesktopActionId>('home');
  const settingsHandoffRef=useRef(false);
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
    if(id==='today-tasks'||id==='inbox'){openTasks();return;}
    if(id==='official-document'){setOfficialDocumentOpen(true);setActive('home');setEditing(false);setPanel(null);setNotice(null);return;}
    if(id==='purchase-helper'){setPurchaseOpen(true);setActive('home');setPanel(null);setNotice(null);return;}
    if(['home','settings','quick-memo','toolbox'].includes(id)){if(id==='settings')settingsHandoffRef.current=false;setActive(id);setPanel(null);setEditing(false);setNotice(null)}else excluded();
  };
  return <WidgetSessionProvider><LocalWorkspaceProvider><PersistentMemoProvider><DesktopPanelProvider notify={setNotice} openInbox={()=>openTasks()} openBogunonTask={async id=>openTasks({id})} openQuickAddEventForDate={date=>openTasks({date})} openQuickAddFromMemo={title=>openTasks({title})} openQuickMemoUrl={async()=>excluded()} runDesktopAction={async id=>navigate(id)} workFolderFavorites={[]} openWorkFolderFavorite={async()=>excluded()}>
    <div hidden={newsletterOpen||educationVideoOpen||officialDocumentOpen||inventoryOpen||financeOpen||adminOpen} style={{display:newsletterOpen||educationVideoOpen||officialDocumentOpen||inventoryOpen||financeOpen||adminOpen?"none":undefined}} className={`app-shell workspace-shell ${editing?'is-edit-mode':'is-view-mode'} bg-${layout.appearance.background} card-${layout.appearance.cardStyle} corner-${layout.appearance.cornerStyle}`}>
      <header className="rose-surface-header"><strong>BOGUNON DESK</strong><SurfaceDate/><span>Electron 전용 로컬 저장 · 운영 서비스·외부 금융 연결 없음</span></header>
      <LocalWorkspaceStatus onOpen={()=>openTasks()}/>
      <DashboardToolbar activePanel={panel} isEditing={editing} onOpenPanel={p=>setPanel(panel===p?null:p)} onOpenQuickAdd={()=>openTasks()} onReset={()=>{if(window.confirm('PoC 배치만 기본값으로 되돌릴까요?'))setLayout(createDefaultDashboardLayout())}} onToggleEdit={()=>{setEditing(!editing);setPanel(null);setSelected(null);setActive('home')}}/>
      <main ref={ref} aria-label="보건실 업무 위젯 작업 공간" className={`dashboard workspace-dashboard${metrics.requiresScroll?' is-scrollable':''}${geometry.dense?' is-dense-desk':''}`}>
        {width!==null&&<DesktopWidgetLayout widgets={geometry.widgets} width={Math.max(320,width)} compact={width<900} editing={editing} selectedId={selected} metrics={metrics} onSelect={setSelected} onHide={id=>setLayout(hideWidget({...layout,widgets:geometry.widgets},id))} onLayoutChange={next=>{if(editing&&width>=900)setLayout(current=>mergeRenderedGridLayout(current,resolveDeskGeometry(current,vw).widgets,next))}}/>}
      </main>
      {editing&&panel==='library'&&<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>setPanel(null)} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>}
      {editing&&panel==='appearance'&&<AppearancePanel appearance={layout.appearance} onClose={()=>setPanel(null)} onUpdate={appearance=>setLayout({...layout,appearance})}/>}
      {editing&&panel==='presets'&&<PresetSelector currentPresetId={layout.presetId} onClose={()=>setPanel(null)} onApply={id=>setLayout(applyPreset(layout,id,window.confirm))}/>}
      {editing&&panel==='dock'&&<DockEditor dockLayout={dock} onClose={()=>setPanel(null)} onUpdate={setDock}/>}
      {active!=='home'&&<SurfaceDialog key={active} modal={active==='settings'} shouldRestoreFocus={()=>active!=='settings'||!settingsHandoffRef.current} title={active==='settings'?'설정':active==='quick-memo'?'빠른 메모':'업무 도구'} onClose={()=>navigate('home')}>
        {active==='quick-memo'?<MemoWidget/>:active==='settings'?<SurfaceSettings school={<SchoolProfileSettings/>} ai={<AiSettings/>} saveStatus={status} appearance={<AppearancePanel appearance={layout.appearance} onClose={()=>navigate('home')} onUpdate={appearance=>setLayout({...layout,appearance})}/>} widgets={<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>navigate('home')} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>} dock={<DockEditor dockLayout={dock} onClose={()=>navigate('home')} onUpdate={setDock}/>} about={<><button type="button" onClick={()=>{settingsHandoffRef.current=true;setActive("home");setNewsletterLoaded(true);setNewsletterOpen(true);}}>보건소식지 제작소</button><SyntheticIpcSample/><p>앱 ID: {info?.appId}</p><p>PoC 저장 위치: {info?.userData}</p><p>소스: {info?.sourceSha}</p><p>Electron: {info?.electron}</p><p>자동 업데이트·운영 데이터 접근 API 없음 · AI API 연결은 별도 설정</p></>}/>:<><div className="p0-tools-grid"><ToolCard icon={BriefcaseBusiness} label="학교 행정 업무 도우미" description="공식 시스템 바로가기·복무 초안·Excel 검토" onClick={()=>{setActive('home');setAdminOpen(true);}}/><ToolCard icon={Wallet} label="MY FINANCE · 암호화 로컬" description="수입·세금·투자·자산 · Windows SQLCipher·DPAPI" onClick={()=>{setActive('home');setFinanceOpen(true);}}/><ToolCard icon={FileText} label="일정·업무 — 로컬 저장" description="업무·마감·완료 관리와 Dashboard 동기화" onClick={()=>{setActive('home');openTasks();}}/><ToolCard icon={ShoppingCart} label="품의 도우미 · 세션 전용" description="품목 계산과 품의문 작성" onClick={()=>{setActive("home");setPurchaseOpen(true);}}/><ToolCard icon={Search} label="교육영상 Finder · 합성 Mock" description="교육영상 검색과 보관함" onClick={()=>{setActive('home');setEducationVideoOpen(true);}}/><ToolCard icon={FileText} label="공문작업실 · 로컬 초안" description="공문 편집과 파일 가져오기·저장" onClick={()=>{setActive('home');setOfficialDocumentOpen(true);}}/>{import.meta.env.DEV&&<ToolCard icon={Database} label="물품관리 — 로컬 QA" description="개발 전용 격리 환경 연결" onClick={()=>{setInventoryOpen(false);setInventoryQaOpen(true);}}/>}<InventoryEntryButtons onSelect={mode=>{setActive('home');setInventoryMode(mode);setInventoryOpen(true);}}/></div></>}
      </SurfaceDialog>}
      {notice&&<div className="p0-notice" role="status">{notice}<button onClick={()=>setNotice(null)}>닫기</button></div>}
      <span className="p0-save" role="status" data-p0-save>{status}</span>
      <div className="dock-zone"><AppDock activeActionId={active} dockLayout={dock} onAction={navigate}/></div>
    </div>
    <SchoolInitialSetup/>
    {aiSettingsOpen&&<SurfaceDialog title="AI 연결" onClose={()=>setAiSettingsOpen(false)}><AiSettings/></SurfaceDialog>}
    {adminOpen&&<Suspense fallback={<p role="status">학교 행정 업무를 불러오는 중…</p>}><SchoolAdmin onClose={()=>setAdminOpen(false)}/></Suspense>}
    {financeOpen&&<Suspense fallback={<p role="status">MY FINANCE를 불러오는 중…</p>}><FinanceHost onClose={()=>setFinanceOpen(false)}/></Suspense>}
    {taskRequest&&<LocalTasksPanel request={taskRequest} onClose={()=>setTaskRequest(null)}/>}
    <PurchaseSession incoming={purchaseIncoming} onIncomingApplied={id=>setPurchaseIncoming(current=>current?.id===id?null:current)} open={purchaseOpen} onClose={()=>setPurchaseOpen(false)}/>
    <div hidden={!newsletterOpen} inert={!newsletterOpen} style={{display:newsletterOpen?undefined:"none"}}>{newsletterLoaded&&<Suspense fallback={<p role="status">소식지 불러오는 중…</p>}><NewsletterStudio renderAiTools={text=><AiAssistant active={newsletterOpen} tool="newsletter" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>setNewsletterOpen(false)}/></Suspense>}</div>
    {educationVideoOpen&&<Suspense fallback={<main role="status">교육영상 Finder를 불러오는 중…</main>}><EducationVideoFinder compatBridge={window.electronWork.educationVideo.compat} searchBridge={window.electronWork.educationVideo.searchProvider} renderAiTools={text=><AiAssistant tool="finder" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>setEducationVideoOpen(false)}/></Suspense>}
    {officialDocumentOpen&&<Suspense fallback={<main role="status">공문작업실을 불러오는 중…</main>}><OfficialDocumentWorkspace renderAiTools={text=><AiAssistant tool="official-document" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>setOfficialDocumentOpen(false)}/></Suspense>}
    {import.meta.env.DEV&&inventoryQaOpen&&<InventoryLocalQa onClose={()=>setInventoryQaOpen(false)}/>}
    {inventoryOpen&&<Suspense fallback={<main role="status">재고 관리를 불러오는 중…</main>}><InventoryHost onPurchase={lines=>{setPurchaseIncoming({id:crypto.randomUUID(),lines});setInventoryOpen(false);setPurchaseOpen(true);}} mode={inventoryMode} onModeChange={setInventoryMode} onClose={()=>setInventoryOpen(false)}/></Suspense>}
  </DesktopPanelProvider></PersistentMemoProvider></LocalWorkspaceProvider></WidgetSessionProvider>;
}
