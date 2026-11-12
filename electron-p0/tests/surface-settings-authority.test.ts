import { describe, expect, it } from 'vitest';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { createDefaultDockLayout } from '../../src/dock/storage';
import { SurfaceSettingsAuthority } from '../main/surface-settings-authority';
import type { P0Settings } from '../protocol';

const settings = (): P0Settings => ({ version: 1, dashboard: createDefaultDashboardLayout(), dock: createDefaultDockLayout() });

describe('single surface settings authority', () => {
  it('rejects stale revisions without overwriting a committed other-surface edit', async () => {
    // Given two surfaces read the same revision.
    const writes: P0Settings[] = [];
    const authority = new SurfaceSettingsAuthority({ read: async () => null, write: async value => { writes.push(value); } }, () => undefined);
    const first = await authority.read();
    const second = await authority.read();
    await authority.write({ revision: first.revision, value: settings() });
    // When the other surface attempts its stale write.
    const stale = authority.write({ revision: second.revision, value: settings() });
    // Then the first write remains authoritative.
    await expect(stale).rejects.toThrow('다른 창');
    expect(writes).toHaveLength(1);
    expect((await authority.read()).revision).toBe(1);
  });

  it('does not advance or publish when atomic persistence fails', async () => {
    // Given a failed disk write.
    const published: unknown[] = [];
    const authority = new SurfaceSettingsAuthority({ read: async () => null, write: async () => { throw new Error('disk unavailable'); } }, value => { published.push(value); });
    // When saving a valid change.
    const result = authority.write({ revision: 0, value: settings() });
    // Then no false success is visible to another surface.
    await expect(result).rejects.toThrow('disk unavailable');
    expect(published).toEqual([]);
    expect((await authority.read()).revision).toBe(0);
  });

  it('publishes the exact validated persisted snapshot only once', async () => {
    // Given a fresh shared authority.
    const published: unknown[] = [];
    const authority = new SurfaceSettingsAuthority({ read: async () => null, write: async () => undefined }, value => { published.push(value); });
    // When one surface commits.
    const committed = await authority.write({ revision: 0, value: settings() });
    // Then every observer receives its one committed revision.
    expect(published).toEqual([committed]);
    expect(committed.revision).toBe(1);
    expect(committed.value?.dock).toMatchObject({ version: 2 });
  });
});
