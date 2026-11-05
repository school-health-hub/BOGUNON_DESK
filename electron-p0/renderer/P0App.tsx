import {LocalCalendarProvider,LocalCalendarStatus} from './local-calendar/LocalCalendarProvider';
import {OfficialAiWorkflow} from './official-document/OfficialAiWorkflow';
import {DesktopUtilities,type UtilityRequest} from './desktop-utilities/DesktopUtilities';
import {runElectronCommand,isElectronCommand} from './desktop-utilities/commands';
import type {CommandId} from '../../src/commands/types';
import {GlobalFileDrop} from './file-drop/GlobalFileDrop';
import type {DropDelivery,DropTarget} from '../file-drop-protocol';
import {useWorkFolders,WorkFoldersContent,openMemoUrl} from './work-folders/WorkFolders';
import {SchoolProfileProvider,SchoolInitialSetup,SchoolProfileSettings} from './school-profile/SchoolProfile';
import {AiSettings,AiAssistant} from './ai/AiTools';
import type {InventoryPurchaseRequest} from './purchase/inventoryPurchase';
import {LocalWorkspaceStatus} from './local-tasks/LocalNotices';
import {LocalWorkspaceProvider} from './adapters/workspace';
import {LocalTasksPanel,type LocalTaskRequest} from './local-tasks/LocalTasksPanel';
import {ShoppingCart,FileText,Search,Database,Wallet,BriefcaseBusiness,FolderOpen,Calculator,Command,Plus,CalendarDays} from 'lucide-react';
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
const RecordHelperHost=lazy(()=>import('./record-helper/RecordHelperHost').then(m=>({default:m.RecordHelperHost})));
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
  const folders=useWorkFolders();
  const [dropped,setDropped]=useState<DropDelivery>();
  const [utility,setUtility]=useState<UtilityRequest|null>(null),utilityRef=useRef<UtilityRequest|null>(null),utilityCaller=useRef<HTMLElement|null>(null);
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
  const [recordOpen,setRecordOpen]=useState(false);
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
  const portalPending=useRef(false),dashboardLive=useRef(true);
  useEffect(()=>{dashboardLive.current=true;return()=>{dashboardLive.current=false;};},[]);
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
  const dropBlocked=(target:DropTarget)=>{
    if(utility||financeOpen||adminOpen||newsletterOpen||educationVideoOpen||inventoryOpen||inventoryQaOpen||aiSettingsOpen||taskRequest||active==='settings'||active==='work-folder')return '현재 작업 화면을 먼저 닫아 주세요. 기존 자료를 자동으로 닫거나 바꾸지 않습니다.';
    if(recordOpen&&target!=='record-helper'||officialDocumentOpen&&target!=='official-document'||purchaseOpen&&target!=='purchase-helper')return '현재 작업실을 먼저 정리하거나 닫아 주세요. 다른 작업은 자동으로 폐기하지 않습니다.';
    return null;
  };
  const clearDropped=()=>{if(dropped)void window.electronWork.fileDrop?.cancel({token:dropped.token});setDropped(undefined);};
  const receiveDrop=(value:DropDelivery)=>{if(dropBlocked(value.target)){void window.electronWork.fileDrop?.cancel({token:value.token});return;}setDropped(value);setActive('home');setPanel(null);setEditing(false);if(value.target==='record-helper')setRecordOpen(true);else if(value.target==='official-document')setOfficialDocumentOpen(true);else setPurchaseOpen(true);};
  const utilityBlocked=()=>financeOpen||adminOpen||newsletterOpen||educationVideoOpen||inventoryOpen||inventoryQaOpen||recordOpen||officialDocumentOpen||purchaseOpen||aiSettingsOpen||!!taskRequest;
  const openUtility=(kind:UtilityRequest['kind'],initial:{date?:string;title?:string}={})=>{
    if(utilityRef.current){if(utilityRef.current.kind===kind)document.querySelector<HTMLElement>('.p0-command-palette input')?.focus();return;}
    if(utilityBlocked()||document.querySelector('[role="dialog"][aria-modal="true"]')){setNotice('현재 대화상자나 작업실을 먼저 닫아 주세요. 기존 입력은 유지합니다.');return;}
    utilityCaller.current=document.activeElement as HTMLElement|null;const next:UtilityRequest=(kind==='quick-add'||kind==='calendar')?{kind,key:crypto.randomUUID(),...initial}:{kind,key:crypto.randomUUID()};utilityRef.current=next;setUtility(next);setActive('home');setPanel(null);setEditing(false);
  };
  const closeUtility=(restore=true)=>{utilityRef.current=null;setUtility(null);if(restore)window.requestAnimationFrame(()=>{if(utilityRef.current||document.querySelector('[role="dialog"][aria-modal="true"]'))return;const previous=utilityCaller.current;if(previous?.isConnected&&!previous.closest('[hidden],[inert]'))previous.focus();else document.querySelector<HTMLElement>('.dock button[data-dock-item="toolbox"]')?.focus();});};
  const command=async(id:CommandId)=>{
    if(utilityRef.current?.kind!=='palette')return;
    // Validate against the fixed registry before retiring the invoking modal.
    if(!isElectronCommand(id))return;
    closeUtility(false);await new Promise<void>(resolve=>window.requestAnimationFrame(()=>resolve()));
    if(utilityBlocked()||document.querySelector('[role="dialog"][aria-modal="true"]')){setNotice('현재 작업 상태가 바뀌어 명령 실행을 중단했습니다.');return;}
    const editor=(target:DashboardEditorPanel)=>{setActive('home');setSelected(null);setEditing(true);setPanel(target);};
    await runElectronCommand(id,{openLocalCalendar:()=>openUtility('calendar'),openQuickAdd:()=>openUtility('quick-add'),runDesktopAction:async action=>{if(action==='calculator')openUtility('calculator');else navigate(action);},openWorkspaceEditor:target=>editor(target==='workspace'?null:target),openWidgetLibrary:()=>editor('library')});
  };
  const excluded=()=>setNotice('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다. 로그인·업무·금융 데이터에 연결하지 않습니다.');
  const navigate=(id:DesktopActionId)=>{
    if(id==='work-portal'){
      if(portalPending.current||utilityBlocked()||utilityRef.current||document.querySelector('[role="dialog"][aria-modal="true"]')){setNotice('현재 작업이나 대화상자를 먼저 정리해 주세요. 기존 입력은 유지됩니다.');return;}
      const api=window.electronWork.admin;if(!api){setNotice('학교 업무 시스템 연결이 없습니다.');return;}
      portalPending.current=true;
      void api.openSystem('portal').then(result=>{if(!dashboardLive.current)return;if(!result.ok){setNotice(result.error.message);return;}if(result.data.status==='needs-configuration'){setActive('home');setAdminOpen(true);setNotice('현재 환경의 업무포털 주소를 확인·적용하거나 직접 등록해 주세요.');return;}setNotice(result.data.status==='launched'?'기본 브라우저에 저장된 업무포털 열기를 요청했습니다. 학교망·공식 로그인은 브라우저에서 확인하세요.':result.data.status==='blocked'?'허용하지 않는 업무포털 이동을 차단했습니다. 주소 설정을 확인하세요.':'업무포털 열기를 취소했습니다.');}).catch(()=>{if(dashboardLive.current)setNotice('업무포털 열기에 실패했습니다. 기존 주소를 유지합니다.');}).finally(()=>{portalPending.current=false;});return;
    }
    if(id==='calculator'){openUtility('calculator');return;}
    if(id==='record-helper'){setActive('home');setRecordOpen(true);return;}
    if(id==='today-tasks'||id==='inbox'){openTasks();return;}
    if(id==='official-document'){setOfficialDocumentOpen(true);setActive('home');setEditing(false);setPanel(null);setNotice(null);return;}
    if(id==='purchase-helper'){setPurchaseOpen(true);setActive('home');setPanel(null);setNotice(null);return;}
    if(['home','settings','quick-memo','toolbox','work-folder'].includes(id)){if(id==='settings')settingsHandoffRef.current=false;setActive(id);setPanel(null);setEditing(false);setNotice(null)}else excluded();
  };
  return <WidgetSessionProvider><LocalCalendarProvider><LocalWorkspaceProvider><PersistentMemoProvider><DesktopPanelProvider notify={setNotice} openInbox={()=>openTasks()} openBogunonTask={async id=>openTasks({id})} openQuickAddEventForDate={date=>openUtility('calendar',{date})} openQuickAddFromMemo={title=>openUtility('quick-add',{title})} openQuickMemoUrl={async url=>{try{await openMemoUrl(url);}catch(e){setNotice(e instanceof Error?e.message:'링크를 열지 못했습니다.');}}} runDesktopAction={async id=>navigate(id)} workFolderFavorites={folders.snapshot?.favorites??[]} openWorkFolderFavorite={async folder=>{const message=await folders.open(folder.id);if(message)setNotice(message);}}>
    <div hidden={recordOpen||newsletterOpen||educationVideoOpen||officialDocumentOpen||inventoryOpen||financeOpen||adminOpen} style={{display:recordOpen||newsletterOpen||educationVideoOpen||officialDocumentOpen||inventoryOpen||financeOpen||adminOpen?"none":undefined}} className={`app-shell workspace-shell ${editing?'is-edit-mode':'is-view-mode'} bg-${layout.appearance.background} card-${layout.appearance.cardStyle} corner-${layout.appearance.cornerStyle}`}>
      <header className="rose-surface-header"><strong>BOGUNON DESK</strong><SurfaceDate/><span>Electron 전용 로컬 업무 저장 · 계정·AI 연결은 별도 설정</span></header>
      <LocalWorkspaceStatus onOpen={()=>openTasks()}/><LocalCalendarStatus onOpen={()=>openUtility('calendar')}/>
      <DashboardToolbar activePanel={panel} isEditing={editing} onOpenPanel={p=>setPanel(panel===p?null:p)} onOpenQuickAdd={()=>openUtility('quick-add')} onReset={()=>{if(window.confirm('PoC 배치만 기본값으로 되돌릴까요?'))setLayout(createDefaultDashboardLayout())}} onToggleEdit={()=>{setEditing(!editing);setPanel(null);setSelected(null);setActive('home')}}/>
      <main ref={ref} aria-label="보건실 업무 위젯 작업 공간" className={`dashboard workspace-dashboard${metrics.requiresScroll?' is-scrollable':''}${geometry.dense?' is-dense-desk':''}`}>
        {width!==null&&<DesktopWidgetLayout widgets={geometry.widgets} width={Math.max(320,width)} compact={width<900} editing={editing} selectedId={selected} metrics={metrics} onSelect={setSelected} onHide={id=>setLayout(hideWidget({...layout,widgets:geometry.widgets},id))} onLayoutChange={next=>{if(editing&&width>=900)setLayout(current=>mergeRenderedGridLayout(current,resolveDeskGeometry(current,vw).widgets,next))}}/>}
      </main>
      {editing&&panel==='library'&&<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>setPanel(null)} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>}
      {editing&&panel==='appearance'&&<AppearancePanel appearance={layout.appearance} onClose={()=>setPanel(null)} onUpdate={appearance=>setLayout({...layout,appearance})}/>}
      {editing&&panel==='presets'&&<PresetSelector currentPresetId={layout.presetId} onClose={()=>setPanel(null)} onApply={id=>setLayout(applyPreset(layout,id,window.confirm))}/>}
      {editing&&panel==='dock'&&<DockEditor dockLayout={dock} onClose={()=>setPanel(null)} onUpdate={setDock}/>}
      {active!=='home'&&<SurfaceDialog key={active} modal={active==='settings'||active==='work-folder'} shouldRestoreFocus={()=>active!=='settings'||!settingsHandoffRef.current} title={active==='settings'?'설정':active==='quick-memo'?'빠른 메모':active==='work-folder'?'업무 폴더':'업무 도구'} onClose={()=>navigate('home')}>
        {active==='work-folder'?<WorkFoldersContent state={folders} onClose={()=>navigate('home')}/>:active==='quick-memo'?<MemoWidget/>:active==='settings'?<SurfaceSettings school={<SchoolProfileSettings/>} ai={<AiSettings/>} saveStatus={status} appearance={<AppearancePanel appearance={layout.appearance} onClose={()=>navigate('home')} onUpdate={appearance=>setLayout({...layout,appearance})}/>} widgets={<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>navigate('home')} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>} dock={<DockEditor dockLayout={dock} onClose={()=>navigate('home')} onUpdate={setDock}/>} about={<><button type="button" onClick={()=>{settingsHandoffRef.current=true;setActive("home");setNewsletterLoaded(true);setNewsletterOpen(true);}}>보건소식지 제작소</button><SyntheticIpcSample/><p>앱 ID: {info?.appId}</p><p>PoC 저장 위치: {info?.userData}</p><p>소스: {info?.sourceSha}</p><p>Electron: {info?.electron}</p><p>자동 업데이트 없음 · BOGUNON 계정은 등록 학교 읽기 · AI 연결은 별도 설정</p></>}/>:<><div className="p0-tools-grid"><ToolCard icon={CalendarDays} label="독립 로컬 일정" description="월간 달력·종일·시간 일정 · 서버 전송 없음" onClick={()=>openUtility('calendar')}/><ToolCard icon={Calculator} label="업무 계산기" description="일반·퍼센트·날짜·단위 변환" onClick={()=>openUtility('calculator')}/><ToolCard icon={Command} label="명령 팔레트" description="지원하는 기능 검색 · Ctrl K" onClick={()=>openUtility('palette')}/><ToolCard icon={Plus} label="빠른 추가 · 로컬 업무" description="제목·수행일·마감일을 이 PC에 저장" onClick={()=>openUtility('quick-add')}/><ToolCard icon={FolderOpen} label="업무 폴더 · 즐겨찾기" description="로컬 폴더 등록·정렬·탐색기 열기" onClick={()=>navigate('work-folder')}/><ToolCard icon={FileText} label="생기부 도우미 · 세션 전용" description="활동보고서·비식별 검토·ChatGPT 초안" onClick={()=>{setActive('home');setRecordOpen(true);}}/><ToolCard icon={BriefcaseBusiness} label="학교 행정 업무 도우미" description="공식 시스템 바로가기·복무 초안·Excel 검토" onClick={()=>{setActive('home');setAdminOpen(true);}}/><ToolCard icon={Wallet} label="MY FINANCE · 암호화 로컬" description="수입·세금·투자·자산 · Windows SQLCipher·DPAPI" onClick={()=>{setActive('home');setFinanceOpen(true);}}/><ToolCard icon={FileText} label="일정·업무 — 로컬 저장" description="업무·마감·완료 관리와 Dashboard 동기화" onClick={()=>{setActive('home');openTasks();}}/><ToolCard icon={ShoppingCart} label="품의 도우미 · 세션 전용" description="품목 계산과 품의문 작성" onClick={()=>{setActive("home");setPurchaseOpen(true);}}/><ToolCard icon={Search} label="교육영상 Finder · 합성 Mock" description="교육영상 검색과 보관함" onClick={()=>{setActive('home');setEducationVideoOpen(true);}}/><ToolCard icon={FileText} label="공문작업실 · 로컬 초안" description="공문 편집과 파일 가져오기·저장" onClick={()=>{setActive('home');setOfficialDocumentOpen(true);}}/>{import.meta.env.DEV&&<ToolCard icon={Database} label="물품관리 — 로컬 QA" description="개발 전용 격리 환경 연결" onClick={()=>{setInventoryOpen(false);setInventoryQaOpen(true);}}/>}<InventoryEntryButtons onSelect={mode=>{setActive('home');setInventoryMode(mode);setInventoryOpen(true);}}/></div></>}
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
    <PurchaseSession dropped={dropped?.target==='purchase-helper'?dropped:undefined} onDropFilesDone={ids=>{if(!dropped)return;const files=dropped.files.filter(f=>!ids.includes(f.id));if(!files.length)void window.electronWork.fileDrop?.cancel({token:dropped.token});setDropped(current=>current?.token===dropped.token?(files.length?{...current,files}:undefined):current);}} incoming={purchaseIncoming} onIncomingApplied={id=>setPurchaseIncoming(current=>current?.id===id?null:current)} open={purchaseOpen} onClose={()=>{if(dropped?.target==='purchase-helper')clearDropped();setPurchaseOpen(false);}}/>
    <div hidden={!newsletterOpen} inert={!newsletterOpen} style={{display:newsletterOpen?undefined:"none"}}>{newsletterLoaded&&<Suspense fallback={<p role="status">소식지 불러오는 중…</p>}><NewsletterStudio renderAiTools={text=><AiAssistant active={newsletterOpen} tool="newsletter" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>setNewsletterOpen(false)}/></Suspense>}</div>
    {recordOpen&&<Suspense fallback={<main role="status">생기부 도우미를 불러오는 중…</main>}><RecordHelperHost dropped={dropped?.target==='record-helper'?dropped:undefined} onDropDone={()=>setDropped(current=>current?.token===dropped?.token?undefined:current)} settingsOpen={aiSettingsOpen} onOpenAiSettings={()=>setAiSettingsOpen(true)} onClose={()=>{if(dropped?.target==='record-helper')clearDropped();setRecordOpen(false);}}/></Suspense>}
    {educationVideoOpen&&<Suspense fallback={<main role="status">교육영상 Finder를 불러오는 중…</main>}><EducationVideoFinder compatBridge={window.electronWork.educationVideo.compat} searchBridge={window.electronWork.educationVideo.searchProvider} renderAiTools={text=><AiAssistant tool="finder" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>setEducationVideoOpen(false)}/></Suspense>}
    {officialDocumentOpen&&<Suspense fallback={<main role="status">공문작업실을 불러오는 중…</main>}><OfficialDocumentWorkspace dropped={dropped?.target==='official-document'?dropped:undefined} onDropDone={()=>setDropped(current=>current?.token===dropped?.token?undefined:current)} renderAiWorkflow={context=><OfficialAiWorkflow key={context.sessionId} context={context} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>{if(dropped?.target==='official-document')clearDropped();setOfficialDocumentOpen(false);}}/></Suspense>}
    {import.meta.env.DEV&&inventoryQaOpen&&<InventoryLocalQa onClose={()=>setInventoryQaOpen(false)}/>}
    {inventoryOpen&&<Suspense fallback={<main role="status">재고 관리를 불러오는 중…</main>}><InventoryHost onPurchase={lines=>{setPurchaseIncoming({id:crypto.randomUUID(),lines});setInventoryOpen(false);setPurchaseOpen(true);}} mode={inventoryMode} onModeChange={setInventoryMode} onClose={()=>setInventoryOpen(false)}/></Suspense>}
    <DesktopUtilities request={utility} onOpen={(kind,initial)=>openUtility(kind,initial)} onClose={()=>closeUtility()} onNotice={setNotice} onCommand={command} favorites={folders.snapshot?.favorites??[]} onFolder={async folder=>{const message=await folders.open(folder.id);if(message){setNotice(message);throw Error(message);}closeUtility();}} blocked={utilityBlocked}/>
    <GlobalFileDrop blocked={dropBlocked} onDeliver={receiveDrop}/>
  </DesktopPanelProvider></PersistentMemoProvider></LocalWorkspaceProvider></LocalCalendarProvider></WidgetSessionProvider>;
}
