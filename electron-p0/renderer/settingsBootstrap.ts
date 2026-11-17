import { createDesign07DashboardLayout } from '../../src/dashboard/design07Layout';
import type { DashboardLayout } from '../../src/dashboard/types';
import { createDefaultDockLayout, parseDockLayoutValue } from '../../src/dock/storage';
import type { DockLayout } from '../../src/dock/types';
import type { P0Bridge, P0Settings } from '../protocol';
import { parseDashboardLayoutValue } from '../../src/dashboard/storage';

export type BootstrappedSettings = Readonly<{
  layout: DashboardLayout;
  dock: DockLayout;
}>;

const pendingBootstraps = new WeakMap<P0Bridge, Promise<BootstrappedSettings>>();

function parseSettings(settings: P0Settings): BootstrappedSettings {
  const layout = parseDashboardLayoutValue(settings.dashboard);
  const dock = parseDockLayoutValue(settings.dock);
  if (!layout || !dock) throw new Error('Invalid saved PoC layout');
  return { layout, dock };
}

async function bootstrapSettings(bridge: P0Bridge): Promise<BootstrappedSettings> {
  const saved = await bridge.readSettings();
  if (saved) return parseSettings(saved);

  const settings: P0Settings = {
    version: 1,
    dashboard: createDesign07DashboardLayout(),
    dock: createDefaultDockLayout(),
  };
  const parsed = parseSettings(settings);
  await bridge.writeSettings(settings);
  return parsed;
}

export function loadBootstrappedSettings(bridge: P0Bridge): Promise<BootstrappedSettings> {
  const pending = pendingBootstraps.get(bridge);
  if (pending) return pending;
  const created = bootstrapSettings(bridge);
  pendingBootstraps.set(bridge, created);
  return created;
}
