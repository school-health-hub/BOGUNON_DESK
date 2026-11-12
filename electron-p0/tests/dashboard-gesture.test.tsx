// @vitest-environment jsdom
import type { ReactNode } from 'react';
import type { GridLayoutProps, Layout } from 'react-grid-layout';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { P0App } from '../renderer/P0App';
import { parseDashboardLayoutValue } from '../../src/dashboard/storage';
import type { P0Settings } from '../protocol';
import type { SurfaceSettingsBridge, SurfaceSettingsSnapshot } from '../desktop-surface-protocol';

let grid: GridLayoutProps;
vi.mock('../../src/workspace-data/WorkspaceDataContext', () => ({ useWorkspaceData: () => ({ state: { status: 'signedOut' } }) }));
vi.mock('react-grid-layout', () => ({
  GridLayout: (props: GridLayoutProps) => {
    grid = props;
    return <div>{props.children}<span className="react-resizable-handle" data-testid="resize-grip" /></div>;
  },
}));
vi.mock('../renderer/purchase/PurchaseSession', () => ({ PurchaseSession: () => null }));
vi.mock('../../src/components/dashboard/WidgetFrame', () => ({ WidgetFrame: () => null }));
vi.mock('../renderer/school-profile/SchoolProfile', () => ({
  SchoolProfileProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SchoolInitialSetup: () => null,
  SchoolProfileSettings: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1400, 900));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const save = vi.fn(async (_document: P0Settings) => {});
  vi.stubGlobal('electronP0', {
    info: async () => ({ appId: 'kr.sungandi.schoolhealthdesk.electronp0' }),
  });
  let snapshot: SurfaceSettingsSnapshot = { revision: 0, value: null };
  vi.stubGlobal('electronSurfaceSettings', {
    read: async () => snapshot,
    write: async request => {
      await save(request.value);
      snapshot = { revision: request.revision + 1, value: request.value };
      return snapshot;
    },
    subscribe: () => () => undefined,
  } satisfies SurfaceSettingsBridge);
  vi.stubGlobal('electronDesktopNavigation', {
    ready: async () => undefined,
    onEntry: () => () => undefined,
    openSettings: async () => undefined,
  });
  vi.stubGlobal('electronWork', {
    memo: { read: async () => ({ ok: true, data: { version: 1, text: '' } }) },
    tasks: { load: async () => ({ ok: true, data: { document: { version: 1, revision: 0, tasks: [] }, recovered: false } }) },
  });
  const app = render(<P0App />);
  await screen.findByText('설정 저장됨');
  save.mockClear();
  fireEvent.click(screen.getByRole('button', { name: '화면 꾸미기' }));
  return { app, save };
}

function gesture(kind: 'drag' | 'resize') {
  const callbacks = grid;
  const baseline = callbacks.layout ?? [];
  const oldItem = baseline.find(item => item.i === 'widget-clock');
  if (!oldItem) throw Error('Clock fixture missing');
  const item = kind === 'drag' ? { ...oldItem, y: oldItem.y + 3 } : { ...oldItem, h: oldItem.h + 1 };
  const next: Layout = baseline.map(widget => widget === oldItem ? item : widget);
  const target = document.createElement('div');
  const start = kind === 'drag' ? callbacks.onDragStart : callbacks.onResizeStart;
  const move = kind === 'drag' ? callbacks.onDrag : callbacks.onResize;
  const stop = kind === 'drag' ? callbacks.onDragStop : callbacks.onResizeStop;
  act(() => start?.(baseline, oldItem, oldItem, null, new MouseEvent('mousedown'), target));
  return {
    baseline, next,
    move: () => act(() => {
      move?.(next, oldItem, item, item, new MouseEvent('mousemove'), target);
      callbacks.onLayoutChange?.(next);
    }),
    stop: (button = 0) => act(() => {
      stop?.(next, oldItem, item, null, new MouseEvent('mouseup', { button }), target);
      callbacks.onLayoutChange?.(next);
    }),
  };
}

describe('Electron dashboard gesture persistence', () => {
  it.each(['drag', 'resize'] as const)('restores the entire layout and ignores late %s input after Esc', async kind => {
    const { save } = await setup();
    const pending = gesture(kind);
    pending.move();
    expect(save).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    pending.move();
    pending.stop();
    expect(grid.layout).toEqual(pending.baseline);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['drag', 'resize'] as const)('saves a completed %s exactly once', async kind => {
    const { save } = await setup();
    const pending = gesture(kind);
    pending.move();
    expect(save).not.toHaveBeenCalled();
    pending.stop();
    pending.stop();
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const clock = pending.next.find(widget => widget.i === 'widget-clock');
    expect(parseDashboardLayoutValue(save.mock.calls[0]?.[0].dashboard)?.widgets.find(widget => widget.id === 'widget-clock'))
      .toMatchObject({ y: clock?.y, h: clock?.h });
  });


  it('blocks native text selection only while an edit grip pointer is held through Esc', async () => {
    const { save } = await setup();
    const pointerEvent = (type: string, pointerId: number) => Object.assign(
      new MouseEvent(type, { bubbles: true, button: 0 }),
      { pointerId, isPrimary: true },
    );
    const selectText = () => fireEvent(document.body, new Event('selectstart', { bubbles: true, cancelable: true }));
    expect(selectText()).toBe(true);
    fireEvent(screen.getByTestId('resize-grip'), pointerEvent('pointerdown', 1));
    const pending = gesture('resize');
    expect(selectText()).toBe(false);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    pending.move();
    expect(selectText()).toBe(false);
    fireEvent(document.body, pointerEvent('pointerup', 2));
    expect(selectText()).toBe(false);
    fireEvent(document.body, pointerEvent('pointerup', 1));
    pending.stop();
    expect(selectText()).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('blocks Chromium native drag on a grid grip without blocking other content', async () => {
    await setup();
    expect(fireEvent.dragStart(screen.getByTestId('resize-grip'))).toBe(false);
    expect(fireEvent.dragStart(document.body)).toBe(true);
  });
  it('does not commit on a secondary mouse button release', async () => {
    const { save } = await setup();
    const pending = gesture('drag');
    pending.stop(2);
    pending.stop();
    expect(grid.layout).toEqual(pending.baseline);
    expect(save).not.toHaveBeenCalled();
  });
  it('ignores the retired grid callbacks during a fresh edit', async () => {
    const { save } = await setup();
    const old = gesture('drag');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    const current = gesture('resize');
    old.move();
    old.stop();
    expect(save).not.toHaveBeenCalled();
    current.stop();
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(parseDashboardLayoutValue(save.mock.calls[0]?.[0].dashboard)?.widgets.find(widget => widget.id === 'widget-clock'))
      .toMatchObject({ y: current.next.find(widget => widget.i === 'widget-clock')?.y, h: current.next.find(widget => widget.i === 'widget-clock')?.h });
  });

  it('accepts a new drag after cancellation', async () => {
    const { save } = await setup();
    gesture('resize');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    gesture('drag').stop();
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
  });

  it.each(['pointercancel', 'unmount'] as const)('discards the active edit on %s', async reason => {
    const { app, save } = await setup();
    const pending = gesture('resize');
    pending.move();
    if (reason === 'pointercancel') fireEvent.pointerCancel(document.body);
    if (reason === 'unmount') app.unmount();
    pending.stop();
    expect(save).not.toHaveBeenCalled();
  });

  it('blocks navigation during an active edit and ignores late stop after Escape', async () => {
    const { save } = await setup();
    const pending = gesture('resize');
    pending.move();
    fireEvent.click(screen.getByRole('button', { name: '일정·업무' }));
    expect(screen.getByText(/화면 꾸미기를 먼저 완료/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '홈' }).getAttribute('aria-current')).toBe('page');
    expect(save).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    pending.stop();
    expect(grid.layout).toEqual(pending.baseline);
    expect(save).not.toHaveBeenCalled();
  });

  it('leaves text input and dialog Escape to their existing handlers', async () => {
    const { save } = await setup();
    const pending = gesture('drag');
    const dialog = document.createElement('div');
    const input = document.createElement('input');
    dialog.setAttribute('role', 'dialog');
    dialog.append(input);
    document.body.append(dialog);
    const escape = vi.fn();
    dialog.addEventListener('keydown', escape);
    try {
      expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(true);
      expect(escape).toHaveBeenCalledOnce();
    } finally {
      dialog.remove();
    }
    pending.stop();
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(fireEvent.keyDown(document.body, { key: 'Escape' })).toBe(true);
  });

  it('leaves a completed write in flight and reports its failure honestly', async () => {
    const { save } = await setup();
    let rejectWrite: (reason: Error) => void = () => { throw Error('Write not started'); };
    save.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectWrite = reject; }));
    gesture('drag').stop();
    expect(save).toHaveBeenCalledOnce();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await act(async () => rejectWrite(Error('Synthetic disk failure')));
    expect(screen.getByText('저장하지 못한 변경을 지우고 최신 설정을 다시 불러왔습니다. 변경 내용을 확인한 뒤 다시 시도해 주세요.')).toBeTruthy();
    expect(screen.queryByText('설정 저장됨')).toBeNull();
    expect(save).toHaveBeenCalledOnce();
  });
});
