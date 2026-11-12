import { desktopActionIds, desktopModuleIds, settingsSectionIds, type DesktopActionRequestId, type DesktopEntry, type DesktopModuleId, type SettingsSectionId } from '../desktop-surface-protocol.js';

const isModule = (value: unknown): value is DesktopModuleId => desktopModuleIds.some(id => id === value);
const isAction = (value: unknown): value is DesktopActionRequestId => desktopActionIds.some(id => id === value);
export function parseDesktopEntry(value: unknown): DesktopEntry {
  if (typeof value !== 'object' || value === null || !('kind' in value)) throw new Error('Invalid Desktop destination');
  if (value.kind === 'module' && 'moduleId' in value && isModule(value.moduleId) && Object.keys(value).length === 2) return { kind: 'module', moduleId: value.moduleId };
  if (value.kind === 'action' && 'actionId' in value && isAction(value.actionId) && Object.keys(value).length === 2) return { kind: 'action', actionId: value.actionId };
  throw new Error('Invalid Desktop destination');
}
export function parseSettingsSection(value: unknown): SettingsSectionId {
  const section = settingsSectionIds.find(id => id === value);
  if (!section) throw new Error('Invalid Settings section');
  return section;
}

export class DesktopNavigationQueue {
  private rendererReady = false;
  private pending: DesktopEntry | undefined;
  constructor(private readonly show: () => void, private readonly send: (entry: DesktopEntry) => void) {}
  request(entry?: DesktopEntry): void {
    this.show();
    if (!entry) return;
    if (this.rendererReady) this.send(entry);
    else this.pending ??= entry;
  }
  ready(): void {
    this.rendererReady = true;
    if (this.pending) { const entry = this.pending; this.pending = undefined; this.send(entry); }
  }
  reset(): void { this.rendererReady = false; this.pending = undefined; }
}
