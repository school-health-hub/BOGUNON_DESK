import type { P0Settings, IpcResult, MemoDocument } from './protocol.js';
import type { EventLoad, LocalEventDraft } from './local-events.js';
import type { LocalTaskDocument, LocalTaskLoad } from './local-tasks.js';

export interface PaletteBridge {
  readonly readSettings: () => Promise<P0Settings | null>;
  readonly setInteractive: (interactive: boolean) => Promise<void>;
  readonly setHitRegions: (regions: readonly PaletteHitRegion[]) => Promise<void>;
  readonly openWorkspace: () => Promise<void>;
}

export interface PaletteHitRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PaletteWorkBridge {
  readonly events: {
    readonly load: () => Promise<IpcResult<EventLoad>>;
    readonly save: (event: LocalEventDraft, expectedRevision: number, expectedUpdatedAt: string | null) => Promise<IpcResult<EventLoad>>;
    readonly remove: (id: string, expectedRevision: number, expectedUpdatedAt: string, confirmed: true) => Promise<IpcResult<EventLoad>>;
  };
  readonly tasks: {
    readonly load: () => Promise<IpcResult<LocalTaskLoad>>;
    readonly save: (document: LocalTaskDocument, expectedRevision: number) => Promise<IpcResult<LocalTaskLoad>>;
  };
  readonly memo: {
    readonly read: () => Promise<IpcResult<MemoDocument>>;
    readonly write: (document: MemoDocument) => Promise<IpcResult<MemoDocument>>;
  };
}
