import {WorkspaceShell,WorkspaceDisclosure} from './ui/WorkspaceShell';
import{WorkspaceBoundary}from'./WorkspaceBoundary';
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
import {SurfaceDialog} from './SurfaceDialog';
import {QuickMemoSurface} from './QuickMemoSurface';
import {SurfaceSettings} from './SurfaceSettings';
import {InventoryLocalQa} from './inventory-local-qa/InventoryLocalQa';
import { PurchaseSession } from './purchase/PurchaseSession';
import { PersistentMemoProvider } from './adapters/PersistentMemo';
import { ProductAbout } from './ProductAbout';
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
import { loadBootstrappedSettings } from './settingsBootstrap';
import { hideWidget, restoreWidget } from '../../src/dashboard/layoutTransforms';
import { isCanonicalDeskLayout, mergeRenderedGridLayout, resolveDeskGeometry } from '../../src/dashboard/deskGeometry';
import { applyPreset, calculateDashboardGridMetrics, useElementWidth, useViewportHeight, useViewportWidth } from '../../src/components/dashboard/dashboardCanvasSupport';
import type { DashboardLayout } from '../../src/dashboard/types';
import type { DockLayout } from '../../src/dock/types';
import type { DesktopActionId } from '../../src/desktop/types';
import type { DashboardEditorPanel } from '../../src/components/dashboard/useDesktopNavigation';
import { BrandLogo } from '../../src/branding/BrandLogo';
import { ToolboxMenu } from './toolbox/ToolboxMenu';
import type { ToolId } from './toolbox/toolDefinitions';
const WorkspaceProductHost=lazy(()=>import('./WorkspaceProductHost'));
const School04Entry=import.meta.env.DEV&&import.meta.env.ELECTRON_P0_PUBLIC_SCHOOL04_LOCAL==='1'?lazy(()=>import('./school-workspace-dev/School04Entry')):null;
const School03Entry=import.meta.env.DEV&&import.meta.env.ELECTRON_P0_PUBLIC_SCHOOL03_LOCAL==='1'?lazy(()=>import('./school-workspace-dev/School03Entry')):null;
const School02Entry=import.meta.env.DEV&&import.meta.env.ELECTRON_P0_PUBLIC_SCHOOL02_LOCAL==='1'?lazy(()=>import('./school-workspace-dev/School02Entry')):null;
const SchoolWorkspaceDevEntry=import.meta.env.DEV&&import.meta.env.ELECTRON_P0_PUBLIC_SCHOOL01C_DEV==='1'?lazy(()=>import('./school-workspace-dev/SchoolWorkspaceDevEntry')):null;
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
    void window.electronP0.info().then(info=>{
      if(info.appId!=='kr.sungandi.schoolhealthdesk.electronp0')throw Error('Wrong PoC identity');
      return loadBootstrappedSettings(window.electronP0).then(settings=>({info,settings}));
    }).then(({info,settings})=>{
      if(!active)return;
      setInitial({...settings,info});
    }).catch(()=>{if(active)setError(true)});
    return ()=>{active=false};
  },[]);
  if(error)return <main role="alert">앱 설정을 읽지 못했습니다. 기존 파일을 보존하고 앱을 다시 열어 주세요.</main>;
  if(!initial)return <main role="status">BOGUNON DESK를 불러오는 중입니다…</main>;
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
  const [workspaceOpen,setWorkspaceOpen]=useState(false);
  const [dock,setDock] = useState(initial.dock);
  const info=initial.info;
  const [status,setStatus] = useState('설정 준비됨');
  const [editing,setEditing] = useState(false), [panel,setPanel] = useState<DashboardEditorPanel>(null);
  const [selected,setSelected] = useState<string | null>(null), [active,setActive] = useState<DesktopActionId>('home');
  const settingsHandoffRef=useRef(false);
  const initialPersistence=useRef({layout:initial.layout,dock:initial.dock});
  const [notice,setNotice] = useState<string | null>(null);
  const portalPending=useRef(false),dashboardLive=useRef(true);
  useEffect(()=>{dashboardLive.current=true;return()=>{dashboardLive.current=false;};},[]);
  const {ref,width} = useElementWidth(); const vh=useViewportHeight(), vw=useViewportWidth();
  const geometry=resolveDeskGeometry(layout,vw);
  const visible=geometry.widgets.filter(w=>w.visible);
  const rows=visible.reduce((max,w)=>Math.max(max,w.y+w.h),1);
  const metrics=calculateDashboardGridMetrics(vh,rows,geometry.dense?geometry:undefined);
  useEffect(()=>{
    if(layout===initialPersistence.current.layout&&dock===initialPersistence.current.dock)return;
    let active=true;setStatus('저장 중');
    void window.electronP0.writeSettings({version:1,dashboard:layout,dock}).then(()=>{if(active)setStatus('설정 저장됨')}).catch(()=>{if(active)setStatus('저장 실패 — 현재 배치를 유지하고 다시 시도해 주세요')});
    return ()=>{active=false};
  },[layout,dock]);
  const dropBlocked=(target:DropTarget)=>{
    if(utility||financeOpen||adminOpen||newsletterOpen||educationVideoOpen||inventoryOpen||inventoryQaOpen||aiSettingsOpen||taskRequest||active==='settings'||active==='work-folder')return '현재 작업 화면을 먼저 닫아 주세요. 기존 자료를 자동으로 닫거나 바꾸지 않습니다.';
    if(recordOpen&&target!=='record-helper'||officialDocumentOpen&&target!=='official-document'||purchaseOpen&&target!=='purchase-helper')return '현재 작업실을 먼저 정리하거나 닫아 주세요. 다른 작업은 자동으로 폐기하지 않습니다.';
    return null;
  };
  const clearDropped=()=>{if(dropped)void window.electronWork.fileDrop?.cancel({token:dropped.token});setDropped(undefined);};
  const receiveDrop=(value:DropDelivery)=>{if(dropBlocked(value.target)){void window.electronWork.fileDrop?.cancel({token:value.token});return;}setDropped(value);setActive('home');setPanel(null);setEditing(false);if(value.target==='record-helper')setRecordOpen(true);else if(value.target==='official-document')setOfficialDocumentOpen(true);else setPurchaseOpen(true);};
  const utilityBlocked=()=>workspaceOpen||financeOpen||adminOpen||newsletterOpen||educationVideoOpen||inventoryOpen||inventoryQaOpen||recordOpen||officialDocumentOpen||purchaseOpen||aiSettingsOpen||!!taskRequest;
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
  const excluded=()=>setNotice('이 기능은 현재 베타 버전에서 사용할 수 없습니다. 로그인·업무·금융 데이터에 연결하지 않습니다.');
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
  const openNewsletter=()=>{setActive('home');setNewsletterLoaded(true);setNewsletterOpen(true);};
  const openDashboardEditor=(target:Exclude<DashboardEditorPanel,null>)=>{setActive('home');setSelected(null);setEditing(true);setPanel(target);};
  const hideWidgetType=(type:DashboardLayout['widgets'][number]['type'])=>setLayout(current=>{
    const rendered=resolveDeskGeometry(current,vw).widgets;
    const target=rendered.find(widget=>widget.type===type);
    return target===undefined?current:hideWidget({...current,widgets:rendered},target.id);
  });
  const runTool=(id:ToolId)=>{
    switch(id){
      case 'school-health-room':setWorkspaceOpen(true);return;
      case 'newsletter':openNewsletter();return;
      case 'inventory-local':setActive('home');setInventoryMode('local');setInventoryOpen(true);return;
      case 'inventory-preview':setActive('home');setInventoryMode('preview');setInventoryOpen(true);return;
      case 'inventory-qa':setInventoryOpen(false);setInventoryQaOpen(true);return;
      case 'education-video':setActive('home');setEducationVideoOpen(true);return;
      case 'official-document':setActive('home');setOfficialDocumentOpen(true);return;
      case 'purchase-helper':setActive('home');setPurchaseOpen(true);return;
      case 'school-admin':setActive('home');setAdminOpen(true);return;
      case 'record-helper':setActive('home');setRecordOpen(true);return;
      case 'local-calendar':openUtility('calendar');return;
      case 'local-tasks':setActive('home');openTasks();return;
      case 'quick-add':openUtility('quick-add');return;
      case 'work-folder':navigate('work-folder');return;
      case 'calculator':openUtility('calculator');return;
      case 'command-palette':openUtility('palette');return;
      case 'finance':setActive('home');setFinanceOpen(true);return;
    }
  };
  return <WidgetSessionProvider><LocalCalendarProvider><LocalWorkspaceProvider><PersistentMemoProvider><DesktopPanelProvider notify={setNotice} openInbox={()=>openTasks()} openBogunonTask={async id=>openTasks({id})} openQuickAddEventForDate={date=>openUtility('calendar',{date})} openQuickAddFromMemo={title=>openUtility('quick-add',{title})} openQuickMemoUrl={async url=>{try{await openMemoUrl(url);}catch(e){setNotice(e instanceof Error?e.message:'링크를 열지 못했습니다.');}}} runDesktopAction={async id=>navigate(id)} workFolderFavorites={folders.snapshot?.favorites??[]} openWorkFolderFavorite={async folder=>{const message=await folders.open(folder.id);if(message)setNotice(message);}}>
    <div inert={workspaceOpen} hidden={recordOpen||newsletterOpen||educationVideoOpen||officialDocumentOpen||inventoryOpen||financeOpen||adminOpen} style={{display:recordOpen||newsletterOpen||educationVideoOpen||officialDocumentOpen||inventoryOpen||financeOpen||adminOpen?"none":undefined}} className={`app-shell workspace-shell ${isCanonicalDeskLayout(layout)?'is-floating-b':''} ${editing?'is-edit-mode':'is-view-mode'} bg-${layout.appearance.background} card-${layout.appearance.cardStyle} corner-${layout.appearance.cornerStyle}`}>
      <header className="rose-surface-header"><BrandLogo/><SurfaceDate/><span>Electron 전용 로컬 업무 저장 · 계정·AI 연결은 별도 설정</span></header>
      {School04Entry&&<Suspense fallback={null}><School04Entry/></Suspense>}
      {!School04Entry&&School03Entry&&<Suspense fallback={null}><School03Entry/></Suspense>}
      {!School04Entry&&!School03Entry&&School02Entry&&<Suspense fallback={null}><School02Entry/></Suspense>}
      {!School04Entry&&!School03Entry&&!School02Entry&&SchoolWorkspaceDevEntry&&<Suspense fallback={null}><SchoolWorkspaceDevEntry/></Suspense>}
      <LocalWorkspaceStatus onOpen={()=>openTasks()}/><LocalCalendarStatus onOpen={()=>openUtility('calendar')}/>
      <DashboardToolbar activePanel={panel} isEditing={editing} onOpenPanel={p=>setPanel(panel===p?null:p)} onOpenQuickAdd={()=>openUtility('quick-add')} onReset={()=>{if(window.confirm('현재 화면 배치만 기본값으로 되돌릴까요?'))setLayout(createDefaultDashboardLayout())}} onToggleEdit={()=>{setEditing(!editing);setPanel(null);setSelected(null);setActive('home')}}/>
      <main ref={ref} aria-label="보건실 업무 위젯 작업 공간" className={`dashboard workspace-dashboard${metrics.requiresScroll?' is-scrollable':''}${geometry.dense?' is-dense-desk':''}`}>
        {width!==null&&<DesktopWidgetLayout widgets={geometry.widgets} width={Math.max(320,width)} compact={width<900} editing={editing} selectedId={selected} metrics={metrics} onSelect={setSelected} onHide={id=>setLayout(hideWidget({...layout,widgets:geometry.widgets},id))} onLayoutChange={next=>{if(editing&&width>=900)setLayout(current=>mergeRenderedGridLayout(current,resolveDeskGeometry(current,vw).widgets,next))}}/>}
      </main>
      {editing&&panel==='library'&&<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>setPanel(null)} onHide={hideWidgetType} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>}
      {editing&&panel==='appearance'&&<AppearancePanel appearance={layout.appearance} onClose={()=>setPanel(null)} onUpdate={appearance=>setLayout({...layout,appearance})}/>}
      {editing&&panel==='presets'&&<PresetSelector currentPresetId={layout.presetId} onClose={()=>setPanel(null)} onApply={id=>setLayout(applyPreset(layout,id,window.confirm))}/>}
      {editing&&panel==='dock'&&<DockEditor dockLayout={dock} onClose={()=>setPanel(null)} onUpdate={setDock}/>}
      {active==='quick-memo'&&<QuickMemoSurface onClose={()=>navigate('home')}><MemoWidget/></QuickMemoSurface>}
      {active!=='home'&&active!=='quick-memo'&&<SurfaceDialog key={active} modal={active==='settings'||active==='work-folder'} shouldRestoreFocus={()=>active!=='settings'||!settingsHandoffRef.current} title={active==='settings'?'설정':active==='work-folder'?'업무 폴더':'업무 도구'} onClose={()=>navigate('home')}>
        {active==='work-folder'?<WorkFoldersContent state={folders} onClose={()=>navigate('home')}/>:active==='settings'?<SurfaceSettings school={<SchoolProfileSettings/>} ai={<AiSettings/>} saveStatus={status} appearance={<AppearancePanel appearance={layout.appearance} onClose={()=>navigate('home')} onUpdate={appearance=>setLayout({...layout,appearance})}/>} widgets={<WidgetLibraryDrawer widgets={layout.widgets} onClose={()=>navigate('home')} onHide={hideWidgetType} onRestore={type=>setLayout(restoreWidget({...layout,widgets:geometry.widgets},type))}/>} dock={<DockEditor dockLayout={dock} onClose={()=>navigate('home')} onUpdate={setDock}/>} about={<ProductAbout info={info} onOpenNewsletter={()=>{settingsHandoffRef.current=true;openNewsletter();}}/>}/>:<ToolboxMenu onRun={runTool} onOpenWorkspaceEditor={openDashboardEditor}/>}
      </SurfaceDialog>}
      {notice&&<div className="p0-notice" role="status">{notice}<button onClick={()=>setNotice(null)}>닫기</button></div>}
      <span className="p0-save" role="status" data-p0-save>{status}</span>
      <div className="dock-zone"><AppDock activeActionId={active} dockLayout={dock} onAction={navigate}/></div>
    </div>
    <SchoolInitialSetup/>
    {aiSettingsOpen&&<SurfaceDialog title="AI 연결" onClose={()=>setAiSettingsOpen(false)}><AiSettings/></SurfaceDialog>}
    {adminOpen&&<Suspense fallback={<p role="status">학교 행정 업무를 불러오는 중…</p>}><WorkspaceShell name="school-admin"><SchoolAdmin onClose={()=>setAdminOpen(false)}/></WorkspaceShell></Suspense>}
    {financeOpen&&<Suspense fallback={<p role="status">MY FINANCE를 불러오는 중…</p>}><WorkspaceShell name="finance"><FinanceHost onClose={()=>setFinanceOpen(false)}/></WorkspaceShell></Suspense>}
    {taskRequest&&<LocalTasksPanel request={taskRequest} onClose={()=>setTaskRequest(null)}/>}
    <WorkspaceShell name="purchase" overlay><PurchaseSession dropped={dropped?.target==='purchase-helper'?dropped:undefined} onDropFilesDone={ids=>{if(!dropped)return;const files=dropped.files.filter(f=>!ids.includes(f.id));if(!files.length)void window.electronWork.fileDrop?.cancel({token:dropped.token});setDropped(current=>current?.token===dropped.token?(files.length?{...current,files}:undefined):current);}} incoming={purchaseIncoming} onIncomingApplied={id=>setPurchaseIncoming(current=>current?.id===id?null:current)} open={purchaseOpen} onClose={()=>{if(dropped?.target==='purchase-helper')clearDropped();setPurchaseOpen(false);}}/></WorkspaceShell>
    <div hidden={!newsletterOpen} inert={!newsletterOpen} style={{display:newsletterOpen?undefined:"none"}}>{newsletterLoaded&&<Suspense fallback={<p role="status">소식지 불러오는 중…</p>}><WorkspaceShell name="newsletter"><NewsletterStudio renderAiTools={text=><AiAssistant active={newsletterOpen} tool="newsletter" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onOpenAiSettings={()=>setAiSettingsOpen(true)} onClose={()=>setNewsletterOpen(false)}/></WorkspaceShell></Suspense>}</div>
    {recordOpen&&<Suspense fallback={<main role="status">생기부 도우미를 불러오는 중…</main>}><RecordHelperHost dropped={dropped?.target==='record-helper'?dropped:undefined} onDropDone={()=>setDropped(current=>current?.token===dropped?.token?undefined:current)} settingsOpen={aiSettingsOpen} onOpenAiSettings={()=>setAiSettingsOpen(true)} onClose={()=>{if(dropped?.target==='record-helper')clearDropped();setRecordOpen(false);}}/></Suspense>}
    {educationVideoOpen&&<Suspense fallback={<main role="status">교육영상 Finder를 불러오는 중…</main>}><WorkspaceShell name="finder"><EducationVideoFinder compatBridge={window.electronWork.educationVideo.compat} searchBridge={window.electronWork.educationVideo.searchProvider} renderAiTools={text=><AiAssistant tool="finder" source={text} onSettings={()=>setAiSettingsOpen(true)}/>} onClose={()=>setEducationVideoOpen(false)}/></WorkspaceShell></Suspense>}
    {officialDocumentOpen&&<Suspense fallback={<main role="status">공문작업실을 불러오는 중…</main>}><WorkspaceShell name="official"><OfficialDocumentWorkspace dropped={dropped?.target==='official-document'?dropped:undefined} onDropDone={()=>setDropped(current=>current?.token===dropped?.token?undefined:current)} renderAiWorkflow={context=><WorkspaceDisclosure title="AI 초안·수정·요약 — 전송 전 내용 검토"><OfficialAiWorkflow key={context.sessionId} context={context} onSettings={()=>setAiSettingsOpen(true)}/></WorkspaceDisclosure>} onClose={()=>{if(dropped?.target==='official-document')clearDropped();setOfficialDocumentOpen(false);}}/></WorkspaceShell></Suspense>}
    {import.meta.env.DEV&&inventoryQaOpen&&<InventoryLocalQa onClose={()=>setInventoryQaOpen(false)}/>}
    {inventoryOpen&&<Suspense fallback={<main role="status">재고 관리를 불러오는 중…</main>}><WorkspaceShell name="inventory"><InventoryHost onPurchase={lines=>{setPurchaseIncoming({id:crypto.randomUUID(),lines});setInventoryOpen(false);setPurchaseOpen(true);}} mode={inventoryMode} onModeChange={setInventoryMode} onClose={()=>setInventoryOpen(false)}/></WorkspaceShell></Suspense>}
    {workspaceOpen&&<div className="s05-overlay" role="dialog" aria-modal="true" aria-label="우리 보건실"><WorkspaceBoundary onClose={()=>setWorkspaceOpen(false)}><Suspense fallback={<p role="status">공동 공간을 불러오는 중…</p>}><WorkspaceShell name="school"><WorkspaceProductHost onClose={()=>setWorkspaceOpen(false)}/></WorkspaceShell></Suspense></WorkspaceBoundary></div>}
    <DesktopUtilities request={utility} onOpen={(kind,initial)=>openUtility(kind,initial)} onClose={()=>closeUtility()} onNotice={setNotice} onCommand={command} favorites={folders.snapshot?.favorites??[]} onFolder={async folder=>{const message=await folders.open(folder.id);if(message){setNotice(message);throw Error(message);}closeUtility();}} blocked={utilityBlocked}/>
    <GlobalFileDrop blocked={dropBlocked} onDeliver={receiveDrop}/>
  </DesktopPanelProvider></PersistentMemoProvider></LocalWorkspaceProvider></LocalCalendarProvider></WidgetSessionProvider>;
}
