import type { P0Settings } from '../protocol.js';
import type { SurfaceSettingsSnapshot, SurfaceSettingsWrite } from '../desktop-surface-protocol.js';
import { validateSettings } from './settings.js';

type Store = { readonly read: () => Promise<P0Settings | null>; readonly write: (value: P0Settings) => Promise<void> };

export class SurfaceSettingsAuthority {
  private revision = 0;
  private value: P0Settings | null = null;
  private loaded: Promise<void> | undefined;
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly store: Store, private readonly publish: (snapshot: SurfaceSettingsSnapshot) => void) {}
  private load(): Promise<void> {
    this.loaded ??= this.store.read().then(value => { this.value = value; });
    return this.loaded;
  }
  async read(): Promise<SurfaceSettingsSnapshot> {
    await this.queue;
    await this.load();
    return { revision: this.revision, value: this.value === null ? null : validateSettings(this.value) };
  }
  write(request: SurfaceSettingsWrite): Promise<SurfaceSettingsSnapshot> {
    const value = validateSettings(request.value);
    const operation = this.queue.then(async () => {
      await this.load();
      if (!Number.isSafeInteger(request.revision) || request.revision !== this.revision) throw new Error('다른 창에서 설정이 변경됐습니다. 최신 설정을 확인하고 다시 시도해 주세요.');
      await this.store.write(value);
      this.value = value;
      const snapshot = { revision: ++this.revision, value: validateSettings(value) };
      this.publish(snapshot);
      return snapshot;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
