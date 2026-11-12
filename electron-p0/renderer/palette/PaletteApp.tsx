import { useEffect, useRef, useState } from 'react';
import { DesktopWidgetLayout } from '../../../src/components/dashboard/DesktopWidgetLayout';
import { DesktopPanelProvider } from '../../../src/components/desktop/DesktopPanelContext';
import { WidgetSessionProvider } from '../../../src/dashboard/WidgetSessionContext';
import { createDefaultDashboardLayout } from '../../../src/dashboard/layouts';
import { parseDashboardLayoutValue } from '../../../src/dashboard/storage';
import { resolveDeskGeometry } from '../../../src/dashboard/deskGeometry';
import { calculateDashboardGridMetrics } from '../../../src/components/dashboard/dashboardCanvasSupport';
import { LocalCalendarProvider } from '../local-calendar/LocalCalendarProvider';
import { LocalWorkspaceProvider } from '../adapters/workspace';
import { PersistentMemoProvider } from '../adapters/PersistentMemo';
import type { DashboardLayout } from '../../../src/dashboard/types';
import {createDefaultDockLayout,parseDockLayoutValue} from '../../../src/dock/storage';
import type {DockLayout} from '../../../src/dock/types';
import type {P0Settings} from '../../protocol';
import {PaletteDock} from './PaletteDock';

const usePaletteInputRouting = (): void => {
  const interactive = useRef(false);
  useEffect(() => {
    const set = (value: boolean) => {
      if (interactive.current === value) return;
      interactive.current = value;
      void window.electronPalette.setInteractive(value);
    };
    const move = (event: MouseEvent) => set(event.target instanceof Element && event.target.closest('[data-widget-type],[data-palette-interactive]') !== null);
    const focusIn = (event: FocusEvent) => set(event.target instanceof Element && event.target.closest('[data-widget-type],[data-palette-interactive]') !== null);
    const focusOut = () => window.requestAnimationFrame(() => set(document.activeElement instanceof Element && document.activeElement.closest('[data-widget-type],[data-palette-interactive]') !== null));
    document.addEventListener('mousemove', move);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    void window.electronPalette.setInteractive(false);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('focusin', focusIn); document.removeEventListener('focusout', focusOut); void window.electronPalette.setInteractive(false); };
  }, []);
};

export function PaletteApp() {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [dock,setDock]=useState<DockLayout|null>(null);
  const [error, setError] = useState(false);
  usePaletteInputRouting();
  useEffect(() => {
    let active = true;
    let revision=-1;
    const apply=(settings:P0Settings|null,monitorLayout:unknown|null=null)=>{
      const parsed = monitorLayout?parseDashboardLayoutValue(monitorLayout):settings ? parseDashboardLayoutValue(settings.dashboard) : createDefaultDashboardLayout();
      const parsedDock=settings?parseDockLayoutValue(settings.dock):createDefaultDockLayout();
      if(!parsed||!parsedDock){if(active)setError(true);return;}
      if(active){setLayout(parsed);setDock(parsedDock);setError(false);}
    };
    const unsubscribe=window.electronPalette.onSettingsChanged(snapshot=>{
      if(snapshot.revision<=revision)return;
      revision=snapshot.revision;apply(snapshot.value,snapshot.monitorLayout);
    });
    void window.electronPalette.readProjection().then(snapshot=>{if(revision<0){revision=snapshot.revision;apply(snapshot.value,snapshot.monitorLayout);}}).catch(()=>{if(active)setError(true);});
    return () => { active = false;unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!error&&(!layout||!dock)) return;
    let active=true;
    const publish = async () => {
      const regions = [...document.querySelectorAll<HTMLElement>('[data-widget-type],[data-palette-interactive]')].map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }).filter(region=>region.width>0&&region.height>0);
      try{await window.electronPalette.setHitRegions(regions);if(active&&!error)await window.electronPalette.ready();}
      catch{if(active)setError(true);}
    };
    const observer = new ResizeObserver(()=>void publish());
    const mutation=new MutationObserver(()=>void publish());
    mutation.observe(document.querySelector('.desktop-palette')??document.documentElement,{childList:true,subtree:true});
    observer.observe(document.documentElement);
    void publish();
    return () => {active=false;observer.disconnect();mutation.disconnect();};
  }, [layout,dock,error]);
  if (error) return <main className="palette-status" role="alert" data-palette-interactive>위젯 배치를 읽지 못했습니다. 기존 배치는 변경하지 않았습니다.<button type="button" onClick={()=>void window.electronPalette.openWorkspace()}>업무 화면 열기</button></main>;
  if (!layout||!dock) return <main className="palette-status" role="status">위젯을 불러오는 중…</main>;
  const geometry = resolveDeskGeometry(layout, window.innerWidth);
  const visible = geometry.widgets.filter((widget) => widget.visible);
  const rows = visible.reduce((max, widget) => Math.max(max, widget.y + widget.h), 1);
  const metrics = calculateDashboardGridMetrics(window.innerHeight, rows, geometry.dense ? geometry : undefined);
  const openWorkspace = async () => { await window.electronPalette.openWorkspace(); };
  return <WidgetSessionProvider><LocalCalendarProvider><LocalWorkspaceProvider><PersistentMemoProvider>
    <DesktopPanelProvider notify={() => undefined} openInbox={openWorkspace} openBogunonTask={async () => openWorkspace()} openQuickAddEventForDate={() => void openWorkspace()} openQuickAddFromMemo={() => void openWorkspace()} openQuickMemoUrl={async () => openWorkspace()} runDesktopAction={async () => openWorkspace()} workFolderFavorites={[]} openWorkFolderFavorite={async () => openWorkspace()}>
      <main className="desktop-palette" data-card-style={layout.appearance.cardStyle} data-corner-style={layout.appearance.cornerStyle} aria-label="BOGUNON 데스크톱 위젯">
        <DesktopWidgetLayout widgets={geometry.widgets} width={Math.max(320, window.innerWidth)} compact={false} editing={false} selectedId={null} metrics={metrics} onLayoutChange={() => undefined} onHide={() => undefined} onSelect={() => undefined}/>
        <PaletteDock layout={dock} openWorkspace={entry=>void window.electronPalette.openWorkspace(entry)} openSettings={()=>void window.electronPalette.openSettings()}/>
      </main>
    </DesktopPanelProvider>
  </PersistentMemoProvider></LocalWorkspaceProvider></LocalCalendarProvider></WidgetSessionProvider>;
}
