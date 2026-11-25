// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { P0App } from '../renderer/P0App';
import { createDefaultDashboardLayout, defaultWidgetLayouts } from '../../src/dashboard/layouts';
import { design07WidgetLayouts } from '../../src/dashboard/design07Layout';
import { createDefaultDockLayout } from '../../src/dock/storage';
import type { P0Settings } from '../protocol';
import type { Layout } from 'react-grid-layout';
import type { DashboardLayout, WidgetLayout } from '../../src/dashboard/types';
import type { DockLayout } from '../../src/dock/types';

type ValidSettings = P0Settings & Readonly<{
  dashboard: DashboardLayout;
  dock: DockLayout;
}>;

type WidgetLayoutProbeProps = Readonly<{
  widgets: readonly WidgetLayout[];
  onLayoutChange: (layout: Layout) => void;
}>;

vi.mock('../../src/components/dashboard/DesktopWidgetLayout', () => ({
  DesktopWidgetLayout: ({ widgets, onLayoutChange }: WidgetLayoutProbeProps) => {
    const first = widgets[0];
    const resized = first ? [{ i: first.id, x: first.x, y: first.y, w: first.w + 1, h: first.h }] : [];
    return <section data-testid="dashboard-widget-ids" data-widget-layouts={JSON.stringify(widgets)}>
      {widgets.map(widget => widget.id).join(',')}
      <button type="button" onClick={() => onLayoutChange(resized)}>합성 위젯 크기 변경</button>
    </section>;
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const validSettings = (): ValidSettings => ({
  version: 1,
  dashboard: createDefaultDashboardLayout(),
  dock: createDefaultDockLayout(),
});

function setup(readSettings: () => Promise<P0Settings | null>, appId = 'kr.sungandi.schoolhealthdesk.electronp0') {
  const writeSettings = vi.fn(async (_settings: P0Settings): Promise<void> => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 1200 }));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('electronP0', {
    info: async () => ({
      appId,
      productName: 'BOGUNON DESK',
      version: '2.0.0-beta.2',
      userData: '/synthetic-profile',
      sourceSha: 'synthetic',
      electron: 'synthetic',
    }),
    readSettings,
    writeSettings,
    onlineHealthRoom: { read: async () => ({ enabled: false, url: "" }), onChanged: () => () => {} },
    onOpenTool: () => () => {},
  });
  vi.stubGlobal('electronWork', {
    purchase: { settings: undefined },
    memo: {
      read: async () => ({ ok: true, data: { version: 1, text: '' } }),
      write: vi.fn(),
    },
    tasks: {
      load: async () => ({ ok: true, data: { document: { version: 1, revision: 0, tasks: [] }, recovered: false } }),
      save: vi.fn(),
    },
  });
  return writeSettings;
}

it('writes first-run settings before mounting the dashboard when settings are absent', async () => {
  // Given
  const writeSettings = setup(async () => null);

  // When
  render(<P0App />);

  // Then
  const dashboard = await screen.findByTestId('dashboard-widget-ids');
  expect(writeSettings).toHaveBeenCalledTimes(1);
  const normalizedBento = defaultWidgetLayouts.map(defaultWidget =>
    design07WidgetLayouts.find(widget => widget.type === defaultWidget.type) ?? defaultWidget);
  expect(dashboard.getAttribute('data-widget-layouts')).toBe(JSON.stringify(normalizedBento));
});

it('preserves saved custom geometry and hidden state instead of applying the Bento default', async () => {
  // Given
  const saved = validSettings();
  const customWidgets = saved.dashboard.widgets.map(widget => widget.type === 'clock'
    ? { ...widget, x: 1 }
    : widget.type === 'meal' ? { ...widget, visible: false } : widget);
  const writeSettings = setup(async () => ({
    ...saved,
    dashboard: { ...saved.dashboard, widgets: customWidgets },
  }));

  // When
  render(<P0App />);
  const dashboard = await screen.findByTestId('dashboard-widget-ids');

  // Then
  expect(dashboard.getAttribute('data-widget-layouts')).toBe(JSON.stringify(customWidgets));
  expect(writeSettings).not.toHaveBeenCalled();
});

it('awaits the first-run write before mounting the dashboard', async () => {
  // Given
  const writeSettings = setup(async () => null);
  let finishWrite: () => void = () => { throw new Error('write was not started'); };
  writeSettings.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));

  // When
  render(<P0App />);
  await waitFor(() => expect(writeSettings).toHaveBeenCalledTimes(1));

  // Then
  expect(screen.queryByTestId('dashboard-widget-ids')).toBeNull();
  finishWrite();
  await screen.findByTestId('dashboard-widget-ids');
});

it('blocks a wrong app identity before settings can be read or written', async () => {
  // Given
  const readSettings = vi.fn(async () => null);
  const writeSettings = setup(readSettings, 'synthetic.wrong.app');

  // When
  render(<P0App />);

  // Then
  await screen.findByRole('alert');
  expect(readSettings).not.toHaveBeenCalled();
  expect(writeSettings).not.toHaveBeenCalled();
  expect(screen.queryByTestId('dashboard-widget-ids')).toBeNull();
});

it('does not write settings while mounting a valid saved dashboard', async () => {
  // Given
  const writeSettings = setup(async () => validSettings());

  // When
  render(<P0App />);

  // Then
  await screen.findByTestId('dashboard-widget-ids');
  expect(writeSettings).not.toHaveBeenCalled();
});

it('does not show a meaningless settings-ready status after a saved dashboard mounts', async () => {
  // Given
  setup(async () => validSettings());

  // When
  render(<P0App />);
  await screen.findByTestId('dashboard-widget-ids');

  // Then
  expect(document.querySelector('[data-p0-save]')).toBeNull();
});

it('performs the first-run write once under StrictMode', async () => {
  // Given
  const readSettings = vi.fn(async () => null);
  const writeSettings = setup(readSettings);

  // When
  render(<StrictMode><P0App /></StrictMode>);

  // Then
  await screen.findByTestId('dashboard-widget-ids');
  expect(readSettings).toHaveBeenCalledTimes(1);
  expect(writeSettings).toHaveBeenCalledTimes(1);
});

it('blocks invalid settings without writing', async () => {
  // Given
  const writeSettings = setup(async () => ({ version: 1, dashboard: null, dock: null }));

  // When
  render(<P0App />);

  // Then
  await screen.findByRole('alert');
  expect(writeSettings).not.toHaveBeenCalled();
});

it('blocks a settings read failure without writing', async () => {
  // Given
  const writeSettings = setup(async () => { throw new Error('synthetic read failure'); });

  // When
  render(<P0App />);

  // Then
  await screen.findByRole('alert');
  expect(writeSettings).not.toHaveBeenCalled();
});

it('does not mount the dashboard when the first-run write fails', async () => {
  // Given
  const writeSettings = setup(async () => null);
  writeSettings.mockRejectedValueOnce(new Error('synthetic write failure'));

  // When
  render(<P0App />);

  // Then
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.queryByTestId('dashboard-widget-ids')).toBeNull());
  expect(writeSettings).toHaveBeenCalledTimes(1);
});

it('writes a later user reset through the existing bridge', async () => {
  // Given
  const writeSettings = setup(async () => validSettings());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<P0App />);
  fireEvent.click(await screen.findByRole('button', { name: '화면 꾸미기' }));
  const reset = await screen.findByRole('button', { name: '기본 데스크형으로 초기화' });

  // When
  fireEvent.click(reset);

  // Then
  await waitFor(() => expect(writeSettings).toHaveBeenCalledTimes(1));
});

it('does not persist a viewport-only resize', async () => {
  // Given
  const writeSettings = setup(async () => validSettings());
  render(<P0App />);
  await screen.findByTestId('dashboard-widget-ids');

  // When
  fireEvent(window, new Event('resize'));

  // Then
  await waitFor(() => expect(writeSettings).not.toHaveBeenCalled());
});

it('persists a user-driven widget resize', async () => {
  // Given
  const writeSettings = setup(async () => validSettings());
  render(<P0App />);
  fireEvent.click(await screen.findByRole('button', { name: '화면 꾸미기' }));

  // When
  fireEvent.click(screen.getByRole('button', { name: '합성 위젯 크기 변경' }));

  // Then
  await waitFor(() => expect(writeSettings).toHaveBeenCalledTimes(1));
});
