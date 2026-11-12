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

const usePaletteInputRouting = (): void => {
  const interactive = useRef(false);
  useEffect(() => {
    const set = (value: boolean) => {
      if (interactive.current === value) return;
      interactive.current = value;
      void window.electronPalette.setInteractive(value);
    };
    const move = (event: MouseEvent) => set(event.target instanceof Element && event.target.closest('[data-widget-type]') !== null);
    const focusIn = (event: FocusEvent) => set(event.target instanceof Element && event.target.closest('[data-widget-type]') !== null);
    const focusOut = () => window.requestAnimationFrame(() => set(document.activeElement instanceof Element && document.activeElement.closest('[data-widget-type]') !== null));
    document.addEventListener('mousemove', move);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    void window.electronPalette.setInteractive(false);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('focusin', focusIn); document.removeEventListener('focusout', focusOut); void window.electronPalette.setInteractive(false); };
  }, []);
};

export function PaletteApp() {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [error, setError] = useState(false);
  usePaletteInputRouting();
  useEffect(() => {
    let active = true;
    void window.electronPalette.readSettings().then((settings) => {
      const parsed = settings ? parseDashboardLayoutValue(settings.dashboard) : createDefaultDashboardLayout();
      if (!parsed) throw new Error('Invalid palette layout');
      if (active) setLayout(parsed);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!layout) return;
    const publish = () => {
      const regions = [...document.querySelectorAll<HTMLElement>('[data-widget-type]')].map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
      void window.electronPalette.setHitRegions(regions);
    };
    const observer = new ResizeObserver(publish);
    observer.observe(document.documentElement);
    publish();
    return () => observer.disconnect();
  }, [layout]);
  if (error) return <main className="palette-status" role="alert">위젯 배치를 읽지 못했습니다. 기존 배치는 변경하지 않았습니다.</main>;
  if (!layout) return <main className="palette-status" role="status">위젯을 불러오는 중…</main>;
  const geometry = resolveDeskGeometry(layout, window.innerWidth);
  const visible = geometry.widgets.filter((widget) => widget.visible);
  const rows = visible.reduce((max, widget) => Math.max(max, widget.y + widget.h), 1);
  const metrics = calculateDashboardGridMetrics(window.innerHeight, rows, geometry.dense ? geometry : undefined);
  const openWorkspace = async () => { await window.electronPalette.openWorkspace(); };
  return <WidgetSessionProvider><LocalCalendarProvider><LocalWorkspaceProvider><PersistentMemoProvider>
    <DesktopPanelProvider notify={() => undefined} openInbox={openWorkspace} openBogunonTask={async () => openWorkspace()} openQuickAddEventForDate={() => void openWorkspace()} openQuickAddFromMemo={() => void openWorkspace()} openQuickMemoUrl={async () => openWorkspace()} runDesktopAction={async () => openWorkspace()} workFolderFavorites={[]} openWorkFolderFavorite={async () => openWorkspace()}>
      <main className="desktop-palette" aria-label="BOGUNON 데스크톱 위젯">
        <DesktopWidgetLayout widgets={geometry.widgets} width={Math.max(320, window.innerWidth)} compact={false} editing={false} selectedId={null} metrics={metrics} onLayoutChange={() => undefined} onHide={() => undefined} onSelect={() => undefined}/>
      </main>
    </DesktopPanelProvider>
  </PersistentMemoProvider></LocalWorkspaceProvider></LocalCalendarProvider></WidgetSessionProvider>;
}
