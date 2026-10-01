import { accountSettingsRepository, createDefaultAccountSettings } from "./accountSettings";
import { accountSettingsScopeRepository, type AccountSettingsScopeRepository } from "./accountSettingsScope";
import { remoteAccountSettingsRepository, serializeAccountSettings, type RemoteAccountSettingsRepository } from "./remoteAccountSettings";
import type { AccountSettings, AccountSettingsRepository, AccountSyncState } from "./types";

const DEBOUNCE_MS = 750;

type SyncStateListener = (state: AccountSyncState) => void;
type AppliedSettingsListener = (settings: AccountSettings) => void;

type AccountSyncDependencies = {
  readonly local: Pick<AccountSettingsRepository, "load" | "replace">;
  readonly scopes: AccountSettingsScopeRepository;
  readonly createDefaults: () => AccountSettings;
  readonly remote: RemoteAccountSettingsRepository;
  readonly now: () => number;
  readonly schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  readonly cancel: (timer: ReturnType<typeof setTimeout>) => void;
};

export const createAccountSyncService = ({ local, scopes, createDefaults, remote, now, schedule, cancel }: AccountSyncDependencies) => {
  let state: AccountSyncState = { status: "signedOut", lastSyncedAt: null };
  let activeUserId: string | null = null;
  let epoch = 0;
  let localRevision = 0;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let writeInFlight = false;
  let writeRequested = false;
  let lastSyncedFingerprint: string | null = null;
  const stateListeners = new Set<SyncStateListener>();
  const appliedListeners = new Set<AppliedSettingsListener>();

  const publishState = (next: AccountSyncState): void => {
    state = next;
    for (const listener of stateListeners) listener(state);
  };

  const isCurrent = (expectedEpoch: number, userId: string): boolean =>
    expectedEpoch === epoch && activeUserId === userId;

  const fingerprint = (settings: AccountSettings): string =>
    JSON.stringify(serializeAccountSettings(settings));

  const flush = async (expectedEpoch: number, userId: string): Promise<void> => {
    if (!isCurrent(expectedEpoch, userId) || !ready) return;
    if (writeInFlight) {
      writeRequested = true;
      return;
    }
    writeInFlight = true;
    const revisionAtStart = localRevision;
    try {
      const settings = await local.load();
      if (!isCurrent(expectedEpoch, userId)) return;
      scopes.save(userId, settings);
      const nextFingerprint = fingerprint(settings);
      if (nextFingerprint !== lastSyncedFingerprint) {
        publishState({ status: "syncing", lastSyncedAt: state.lastSyncedAt });
        const signal = controller?.signal;
        if (signal === undefined) return;
        await remote.save(userId, settings, signal);
        if (!isCurrent(expectedEpoch, userId)) return;
        lastSyncedFingerprint = nextFingerprint;
      }
      if (revisionAtStart === localRevision && !writeRequested) {
        publishState({ status: "synced", lastSyncedAt: now() });
      }
    } catch (error) {
      if (!isCurrent(expectedEpoch, userId)) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      publishState({ status: "error", lastSyncedAt: state.lastSyncedAt });
    } finally {
      if (!isCurrent(expectedEpoch, userId)) return;
      writeInFlight = false;
      if (writeRequested || revisionAtStart !== localRevision) {
        writeRequested = false;
        timer = schedule(() => void flush(expectedEpoch, userId), DEBOUNCE_MS);
      }
    }
  };

  const scheduleFlush = (): void => {
    if (activeUserId === null || !ready) return;
    if (timer !== null) cancel(timer);
    const expectedEpoch = epoch;
    const userId = activeUserId;
    timer = schedule(() => {
      timer = null;
      void flush(expectedEpoch, userId);
    }, DEBOUNCE_MS);
  };

  const reconcile = async (
    expectedEpoch: number,
    userId: string,
    revisionAtStart: number,
  ): Promise<void> => {
    try {
      let syncedRevision = revisionAtStart;
      const signal = controller?.signal;
      if (signal === undefined) return;
      const currentSettings = await local.load();
      if (!isCurrent(expectedEpoch, userId)) return;
      const scopedSettings = scopes.activate(userId, currentSettings) ?? createDefaults();
      if (revisionAtStart === localRevision && fingerprint(currentSettings) !== fingerprint(scopedSettings)) {
        await local.replace(scopedSettings);
        if (!isCurrent(expectedEpoch, userId)) return;
        for (const listener of appliedListeners) listener(scopedSettings);
      }
      const result = await remote.load(userId, signal);
      if (!isCurrent(expectedEpoch, userId)) return;
      if (result.kind === "invalid") {
        ready = true;
        publishState({ status: "error", lastSyncedAt: null });
        if (revisionAtStart !== localRevision) scheduleFlush();
        return;
      }
      if (result.kind === "found" && revisionAtStart === localRevision) {
        await local.replace(result.settings);
        if (!isCurrent(expectedEpoch, userId)) return;
        scopes.save(userId, result.settings);
        if (revisionAtStart === localRevision) {
          lastSyncedFingerprint = fingerprint(result.settings);
          for (const listener of appliedListeners) listener(result.settings);
        } else {
          const snapshotRevision = localRevision;
          const localSettings = await local.load();
          if (!isCurrent(expectedEpoch, userId)) return;
          await remote.save(userId, localSettings, signal);
          if (!isCurrent(expectedEpoch, userId)) return;
          scopes.save(userId, localSettings);
          lastSyncedFingerprint = fingerprint(localSettings);
          syncedRevision = snapshotRevision;
        }
      } else {
        const snapshotRevision = localRevision;
        const localSettings = await local.load();
        if (!isCurrent(expectedEpoch, userId)) return;
        await remote.save(userId, localSettings, signal);
        if (!isCurrent(expectedEpoch, userId)) return;
        scopes.save(userId, localSettings);
        lastSyncedFingerprint = fingerprint(localSettings);
        syncedRevision = snapshotRevision;
      }
      ready = true;
      publishState({ status: "synced", lastSyncedAt: now() });
      if (syncedRevision !== localRevision) scheduleFlush();
    } catch (error) {
      if (!isCurrent(expectedEpoch, userId)) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      ready = true;
      publishState({ status: "error", lastSyncedAt: null });
      if (revisionAtStart !== localRevision) scheduleFlush();
    }
  };

  return {
    getState: (): AccountSyncState => state,
    subscribe: (listener: SyncStateListener): (() => void) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    subscribeApplied: (listener: AppliedSettingsListener): (() => void) => {
      appliedListeners.add(listener);
      return () => appliedListeners.delete(listener);
    },
    start: (userId: string): void => {
      if (activeUserId === userId) return;
      if (timer !== null) cancel(timer);
      controller?.abort();
      activeUserId = userId;
      epoch += 1;
      ready = false;
      writeInFlight = false;
      writeRequested = false;
      lastSyncedFingerprint = null;
      controller = new AbortController();
      const expectedEpoch = epoch;
      const revisionAtStart = localRevision;
      publishState({ status: "syncing", lastSyncedAt: null });
      void reconcile(expectedEpoch, userId, revisionAtStart);
    },
    stop: (): void => {
      epoch += 1;
      activeUserId = null;
      ready = false;
      writeRequested = false;
      lastSyncedFingerprint = null;
      if (timer !== null) cancel(timer);
      timer = null;
      controller?.abort();
      controller = null;
      publishState({ status: "signedOut", lastSyncedAt: null });
    },
    noteLocalChange: (): void => {
      localRevision += 1;
      if (activeUserId !== null && ready) {
        publishState({ status: "syncing", lastSyncedAt: state.lastSyncedAt });
      }
      scheduleFlush();
    },
  } as const;
};

export const accountSyncService = createAccountSyncService({
  local: accountSettingsRepository,
  scopes: accountSettingsScopeRepository,
  createDefaults: createDefaultAccountSettings,
  remote: remoteAccountSettingsRepository,
  now: Date.now,
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: (timer) => clearTimeout(timer),
});
