// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PaletteBridge, PaletteProjection } from '../palette-protocol';
import type { DashboardLayout, WidgetLayout } from '../../src/dashboard/types';
import type { DockLayout } from '../../src/dock/types';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { createDefaultDockLayout } from '../../src/dock/storage';
import { PaletteApp } from '../renderer/palette/PaletteApp';

// Isolate projection transport from operational widget owners and their local stores.
vi.mock('../../src/components/dashboard/DesktopWidgetLayout', () => ({ DesktopWidgetLayout: ({ widgets }: Readonly<{ widgets: readonly WidgetLayout[] }>) => <output data-testid="projected-widgets">{JSON.stringify(widgets)}</output> }));
vi.mock('../renderer/palette/PaletteDock', () => ({ PaletteDock: ({ layout }: Readonly<{ layout: DockLayout }>) => <output data-testid="projected-dock">{JSON.stringify(layout)}</output> }));
vi.mock('../../src/components/desktop/DesktopPanelContext', () => ({ DesktopPanelProvider: ({ children }: Readonly<{ children: ReactNode }>) => children }));
vi.mock('../../src/dashboard/WidgetSessionContext', () => ({ WidgetSessionProvider: ({ children }: Readonly<{ children: ReactNode }>) => children }));
vi.mock('../renderer/local-calendar/LocalCalendarProvider', () => ({ LocalCalendarProvider: ({ children }: Readonly<{ children: ReactNode }>) => children }));
vi.mock('../renderer/adapters/workspace', () => ({ LocalWorkspaceProvider: ({ children }: Readonly<{ children: ReactNode }>) => children }));
vi.mock('../renderer/adapters/PersistentMemo', () => ({ PersistentMemoProvider: ({ children }: Readonly<{ children: ReactNode }>) => children }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function monitorLayout(y: number): DashboardLayout {
  const original = createDefaultDashboardLayout();
  return { ...original, presetId: undefined, widgets: original.widgets.map(widget => ({ ...widget, y })) };
}

function setup(initial: PaletteProjection) {
  const listeners = new Set<(projection: PaletteProjection) => void>();
  const writeGlobal = vi.fn(), writeProfiles = vi.fn();
  const readSettings = vi.fn(async () => null);
  const readProjection = vi.fn(async () => initial);
  const api: PaletteBridge = {
    readSettings, readProjection, setInteractive: vi.fn(async () => undefined),
    setHitRegions: vi.fn(async () => undefined), openWorkspace: vi.fn(async () => undefined),
    openSettings: vi.fn(async () => undefined), ready: vi.fn(async () => undefined),
    onSettingsChanged: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  vi.stubGlobal('electronPalette', api);
  vi.stubGlobal('electronSurfaceSettings', { write: writeGlobal });
  vi.stubGlobal('electronMonitorProfiles', { write: writeProfiles });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  render(<PaletteApp />);
  return { readSettings, readProjection, writeGlobal, writeProfiles,
    publish: (projection: PaletteProjection) => act(() => listeners.forEach(listener => listener(projection))) };
}

it('uses the monitor layout with default Dock when global settings are absent', async () => {
  const layout = monitorLayout(20);
  const api = setup({ revision: 1, value: null, monitorLayout: layout });
  await waitFor(() => expect(screen.getByTestId('projected-widgets').textContent).toBe(JSON.stringify(layout.widgets)));
  expect(screen.getByTestId('projected-dock').textContent).toBe(JSON.stringify(createDefaultDockLayout()));
  expect(api.readProjection).toHaveBeenCalledOnce();
  expect(api.readSettings).not.toHaveBeenCalled();
  expect(api.writeGlobal).not.toHaveBeenCalled();
  expect(api.writeProfiles).not.toHaveBeenCalled();
});

it('updates only from newer projection revisions without writing received monitor layouts', async () => {
  const first = monitorLayout(18), second = monitorLayout(22);
  const dock = { ...createDefaultDockLayout(), items: createDefaultDockLayout().items.map(item => ({ ...item, visible: false })) };
  const value = { version: 1 as const, dashboard: createDefaultDashboardLayout(), dock };
  const api = setup({ revision: 3, value, monitorLayout: first });
  await screen.findByTestId('projected-widgets');
  api.publish({ revision: 4, value, monitorLayout: second });
  expect(screen.getByTestId('projected-widgets').textContent).toBe(JSON.stringify(second.widgets));
  api.publish({ revision: 3, value, monitorLayout: first });
  expect(screen.getByTestId('projected-widgets').textContent).toBe(JSON.stringify(second.widgets));
  expect(screen.getByTestId('projected-dock').textContent).toBe(JSON.stringify(dock));
  expect(api.writeGlobal).not.toHaveBeenCalled();
  expect(api.writeProfiles).not.toHaveBeenCalled();
});
