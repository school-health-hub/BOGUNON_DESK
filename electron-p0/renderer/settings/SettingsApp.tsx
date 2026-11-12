import { useEffect, useState } from 'react';
import type { P0Info } from '../../protocol';
import type { SettingsSectionId, SurfaceSettingsSnapshot } from '../../desktop-surface-protocol';
import { SurfaceSettings } from '../SurfaceSettings';
import { AccountSettings, SchoolConnectionSettings, SchoolProfileProvider } from '../school-profile/SchoolProfile';
import { AiSettings } from '../ai/AiTools';
import { AppearancePanel } from '../../../src/components/dashboard/AppearancePanel';
import { WidgetLibraryDrawer } from '../../../src/components/dashboard/WidgetLibraryDrawer';
import { DockEditor } from '../../../src/dock/DockEditor';
import { restoreWidget } from '../../../src/dashboard/layoutTransforms';
import { PRODUCT_LOGO_URL, PRODUCT_NAME } from '../../../src/branding';
import electronPackage from '../../package.json';
import { useSurfaceSettings } from '../useSurfaceSettings';

type InitialSettings = Readonly<{snapshot:SurfaceSettingsSnapshot;info:P0Info}>;
type SettingsContentProps = Readonly<{initial:SurfaceSettingsSnapshot;info:P0Info;section:SettingsSectionId;sectionRequest?:number}>;
export function SettingsContent({initial,info,section,sectionRequest=0}:SettingsContentProps) {
  const {layout,setLayout,dock,setDock,status}=useSurfaceSettings(initial);
  const close=()=>{void window.electronSettingsWindow.close();};
  const about=<div className="ux04-about">
    <div className="ux04-about-brand"><img src={PRODUCT_LOGO_URL} alt={`${PRODUCT_NAME} 로고`}/><div><strong>{PRODUCT_NAME}</strong><span>버전 {electronPackage.version}</span></div></div>
    <dl><div><dt>제품</dt><dd>{info.productName}</dd></div><div><dt>Electron</dt><dd>{info.electron}</dd></div><div><dt>앱 ID</dt><dd>{info.appId}</dd></div><div><dt>이 PC의 데이터 위치</dt><dd>{info.userData}</dd></div><div><dt>Source</dt><dd>{info.sourceSha}</dd></div></dl>
    <p>자동 업데이트와 전역 클라우드 동기화는 제공하지 않습니다. 지원이 필요한 경우 위 제품 정보와 Source를 함께 확인해 주세요.</p>
  </div>;
  return <SchoolProfileProvider><SurfaceSettings key={`${section}-${sectionRequest}`} initialCategory={section}
    account={<AccountSettings/>} school={<SchoolConnectionSettings/>} ai={<AiSettings configurationOnly/>}
    appearance={<AppearancePanel embedded appearance={layout.appearance} onClose={close} onUpdate={appearance=>setLayout(current=>({...current,appearance}))}/>}
    widgets={<WidgetLibraryDrawer embedded widgets={layout.widgets} onClose={close} onRestore={type=>setLayout(current=>restoreWidget(current,type))}/>}
    dock={<DockEditor embedded dockLayout={dock} onClose={close} onUpdate={setDock}/>}
    about={about} saveStatus={status}/></SchoolProfileProvider>;
}

export function SettingsApp() {
  const [initial,setInitial]=useState<InitialSettings|null>(null);
  const [destination,setDestination]=useState<Readonly<{section:SettingsSectionId;request:number}>>({section:'account',request:0});
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    const unsubscribe=window.electronSettingsWindow.onSection(section=>setDestination(current=>({section,request:current.request+1})));
    void Promise.all([window.electronSurfaceSettings.read(),window.electronSettingsWindow.info()]).then(([snapshot,info])=>{
      if(active)setInitial({snapshot,info});
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'설정을 불러오지 못했습니다.');});
    return()=>{active=false;unsubscribe();};
  },[]);
  useEffect(()=>{
    if(initial)void window.electronSettingsWindow.ready().catch(reason=>setError(reason instanceof Error?reason.message:'설정 창 준비를 완료하지 못했습니다.'));
  },[initial]);
  return <div className="settings-window">
    <header className="settings-window__actions"><strong>{PRODUCT_NAME} 설정</strong><div><button type="button" onClick={()=>void window.electronSettingsWindow.openWorkspace()}>Workspace 열기</button><button type="button" onClick={()=>void window.electronSettingsWindow.close()}>설정 닫기</button></div></header>
    {error?<main role="alert">설정을 불러오지 못했습니다. 기존 파일은 유지됩니다. {error}</main>:initial?<SettingsContent initial={initial.snapshot} info={initial.info} section={destination.section} sectionRequest={destination.request}/>:<main role="status">설정을 불러오는 중입니다…</main>}
  </div>;
}
