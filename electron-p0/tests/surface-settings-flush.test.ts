import { afterEach, expect, it, vi } from 'vitest';
import { SurfaceSettingsFlush } from '../main/surface-settings-flush';
afterEach(() => vi.useRealTimers());
it('waits for the exact renderer and request before shutdown', async () => {
  const flush = new SurfaceSettingsFlush(); let request = 0;
  const pending = flush.request(7, id => { request = id; });
  expect(() => flush.resolve(8, request, true)).toThrow();
  expect(() => flush.resolve(7, request, 'true')).toThrow();
  flush.resolve(7, request, true); await pending;
  expect(() => flush.resolve(7, request, true)).toThrow();
});
it('fails closed for renderer failure or timeout', async () => {
  vi.useFakeTimers(); const flush = new SurfaceSettingsFlush(20); let id = 0;
  const rejected = expect(flush.request(1, next => { id = next; })).rejects.toThrow();
  flush.resolve(1, id, false); await rejected;
  const timeout = expect(flush.request(2, () => {})).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(20); await timeout;
});
