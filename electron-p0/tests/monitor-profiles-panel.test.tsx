// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MonitorProfileView, MonitorSnapshot, MonitorProfilesBridge } from '../monitor-protocol';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { resolveDeskGeometry } from '../../src/dashboard/deskGeometry';
import { MonitorProfilesPanel } from '../renderer/settings/MonitorProfilesPanel';

afterEach(cleanup);
const fallback = createDefaultDashboardLayout();
function profile(id: string, changes: Partial<MonitorProfileView> = {}): MonitorProfileView {
  const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
  return { id, identityKey: id, identityKind: 'device-path', label: id, visible: true,
    connected: true, dormant: false, lastDisplayId: 1, lastBounds: bounds, scaleFactor: 1,
    layoutRef: id, layout: fallback, display: { displayId: 1, label: id, primary: true, bounds,
      workArea: bounds, scaleFactor: 1, identityKey: id, identityKind: 'device-path' }, ...changes };
}
function setup(profiles: readonly MonitorProfileView[] = [profile('one'), profile('two')]) {
  let current: MonitorSnapshot = { revision: 0, profiles, writable: true, error: null };
  const listeners = new Set<(value: MonitorSnapshot) => void>();
  const read = vi.fn(async () => current);
  const write = vi.fn<MonitorProfilesBridge['write']>(async request => {
    current = { ...current, revision: current.revision + 1, profiles: current.profiles.map(item =>
      item.id === request.profileId ? { ...item, layout: request.layout, visible: request.visible } : item) };
    listeners.forEach(listener => listener(current));
    return current;
  });
  const api: MonitorProfilesBridge = { read, write, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  Object.defineProperty(window, 'electronMonitorProfiles', { configurable: true, value: api });
  render(<MonitorProfilesPanel fallbackLayout={fallback} />);
  return { read, write };
}

it('selects a target without saving when another connected monitor is chosen', async () => {
  const api = setup();
  await screen.findByLabelText('대상 모니터');
  fireEvent.change(screen.getByLabelText('대상 모니터'), { target: { value: 'two' } });
  expect(api.write).not.toHaveBeenCalled();
});

it('writes only the selected profile when widget geometry is applied', async () => {
  const api = setup();
  await screen.findByLabelText('대상 모니터');
  fireEvent.change(screen.getByLabelText('대상 모니터'), { target: { value: 'two' } });
  fireEvent.change(screen.getByLabelText('세로 위치'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: '위젯 배치 적용' }));
  await waitFor(() => expect(api.write).toHaveBeenCalledOnce());
  expect(api.write.mock.calls[0]?.[0]).toMatchObject({ revision: 0, profileId: 'two', visible: true });
  expect(screen.getByRole('status').textContent).toContain('저장했습니다');
});

it('preserves other rendered dense coordinates when the first widget is edited', async () => {
  const dense = { ...fallback, gridProfile: 'dense-desk-v2' as const };
  const api = setup([profile('dense', { layout: dense })]);
  await screen.findByLabelText('세로 위치');
  fireEvent.change(screen.getByLabelText('세로 위치'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: '위젯 배치 적용' }));
  await waitFor(() => expect(api.write).toHaveBeenCalledOnce());
  const saved = api.write.mock.calls[0]?.[0].layout;
  expect(saved).toMatchObject({ widgets: expect.arrayContaining(resolveDeskGeometry(dense, 1920).widgets.slice(1)) });
});

it('reloads a rejected stale edit without retrying when Main rejects the write', async () => {
  const api = setup();
  api.write.mockRejectedValueOnce(new Error('stale revision'));
  await screen.findByLabelText('세로 위치');
  fireEvent.change(screen.getByLabelText('세로 위치'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: '위젯 배치 적용' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('최신 설정'));
  expect(api.write).toHaveBeenCalledOnce();
  expect(api.read).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('세로 위치').getAttribute('value')).toBe(String(resolveDeskGeometry(fallback, 1920).widgets[0]?.y));
});

it('does not write when widget dimensions violate registry limits', async () => {
  const api = setup();
  await screen.findByLabelText('너비');
  fireEvent.change(screen.getByLabelText('너비'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '위젯 배치 적용' }));
  expect(screen.getByRole('alert').textContent).toContain('최소');
  expect(api.write).not.toHaveBeenCalled();
});

it('writes widget and monitor visibility together when explicitly applied', async () => {
  const api = setup();
  await screen.findByLabelText('이 모니터에 위젯 표시');
  fireEvent.click(screen.getByLabelText('이 모니터에 위젯 표시'));
  fireEvent.click(screen.getByLabelText('선택한 위젯 표시'));
  expect(api.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '위젯 배치 적용' }));
  await waitFor(() => expect(api.write).toHaveBeenCalledOnce());
  expect(api.write.mock.calls[0]?.[0]).toMatchObject({ profileId: 'one', visible: false,
    layout: { widgets: expect.arrayContaining([expect.objectContaining({ id: 'widget-clock', visible: false })]) } });
});

it('prevents edits when the target is disconnected or has uncertain identity', async () => {
  const api = setup([profile('uncertain', { identityKind: 'uncertain' }), profile('offline', { connected: false, dormant: true, display: null })]);
  await screen.findByLabelText('대상 모니터');
  expect(screen.getByRole('button', { name: '위젯 배치 적용' }).hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('대상 모니터'), { target: { value: 'offline' } });
  expect(screen.getByText(/연결되지 않은 모니터/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '위젯 배치 적용' }).hasAttribute('disabled')).toBe(true);
  expect(api.write).not.toHaveBeenCalled();
});
