import { shouldRunStartupCheck } from "./updaterCheckPolicy";
import type { UpdaterCheckStorage } from "./updaterCheckStorage";
import type {
  DesktopUpdaterState,
  UpdateCheckResult,
  UpdaterService,
} from "./updaterTypes";

type AvailableUpdate = Extract<UpdateCheckResult, { readonly status: "available" }>;
type Listener = () => void;

export type UpdaterController = {
  readonly getState: () => DesktopUpdaterState;
  readonly subscribe: (listener: Listener) => () => void;
  readonly startupCheck: () => Promise<void>;
  readonly manualCheck: () => Promise<void>;
  readonly requestInstall: () => void;
  readonly cancelInstall: () => void;
  readonly confirmInstall: () => Promise<void>;
  readonly dismissAvailable: () => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly cancelPending: () => void;
};

type UpdaterControllerDependencies = {
  readonly service: UpdaterService;
  readonly storage: UpdaterCheckStorage;
  readonly now: () => number;
};

const releaseSafely = async (update: AvailableUpdate | null): Promise<void> => {
  if (update === null) return;
  try {
    await update.release();
  } catch {
    // no-excuse-ok: catch -- native resource cleanup is best effort during dismissal/unmount.
  }
};

export const createUpdaterController = (
  dependencies: UpdaterControllerDependencies,
): UpdaterController => {
  const listeners = new Set<Listener>();
  let state: DesktopUpdaterState = {
    status: "idle",
    lastCheckedAt: dependencies.storage.loadLastCheckedAt(),
  };
  let availableUpdate: AvailableUpdate | null = null;
  let operation: Promise<void> | null = null;
  let generation = 0;

  const publish = (next: DesktopUpdaterState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  const runCheck = (source: "startup" | "manual"): Promise<void> => {
    if (operation !== null) return operation;
    const attemptedAt = dependencies.now();
    const previousCheck = state.lastCheckedAt;
    if (source === "startup" && !shouldRunStartupCheck(previousCheck, attemptedAt)) {
      return Promise.resolve();
    }

    const token = ++generation;
    publish({ status: "checking", source, lastCheckedAt: previousCheck });
    dependencies.storage.saveLastCheckedAt(attemptedAt);

    operation = (async () => {
      await releaseSafely(availableUpdate);
      availableUpdate = null;
      const result = await dependencies.service.check();
      if (token !== generation) {
        if (result.status === "available") await releaseSafely(result);
        return;
      }
      switch (result.status) {
        case "unavailable":
          publish({ status: "unavailable", lastCheckedAt: attemptedAt });
          break;
        case "upToDate":
          publish({ status: "upToDate", lastCheckedAt: attemptedAt });
          break;
        case "available":
          availableUpdate = result;
          publish({ status: "available", metadata: result.metadata, lastCheckedAt: attemptedAt });
          break;
        case "error":
          publish(source === "startup"
            ? { status: "idle", lastCheckedAt: attemptedAt }
            : { status: "error", operation: "check", message: result.message, lastCheckedAt: attemptedAt });
          break;
      }
    })().finally(() => {
      if (token === generation) operation = null;
    });
    return operation;
  };

  const requestInstall = (): void => {
    if (state.status !== "available" || availableUpdate === null) return;
    publish({ status: "confirming", metadata: state.metadata, lastCheckedAt: state.lastCheckedAt });
  };

  const cancelInstall = (): void => {
    if (state.status !== "confirming" || availableUpdate === null) return;
    publish({ status: "available", metadata: state.metadata, lastCheckedAt: state.lastCheckedAt });
  };

  const confirmInstall = (): Promise<void> => {
    if (state.status !== "confirming" || availableUpdate === null || operation !== null) {
      return Promise.resolve();
    }
    const update = availableUpdate;
    const metadata = state.metadata;
    const lastCheckedAt = state.lastCheckedAt;
    const token = ++generation;
    publish({
      status: "downloading",
      metadata,
      progress: { phase: "downloading", downloadedBytes: 0, totalBytes: null },
      lastCheckedAt,
    });
    operation = (async () => {
      const result = await update.install((progress) => {
        if (token !== generation) return;
        publish(progress.phase === "installing"
          ? { status: "installing", metadata, lastCheckedAt }
          : { status: "downloading", metadata, progress, lastCheckedAt });
      });
      if (token !== generation) return;
      if (result.status === "completed") {
        publish({ status: "installing", metadata, lastCheckedAt });
        return;
      }
      await releaseSafely(update);
      availableUpdate = null;
      publish({ status: "error", operation: "install", message: result.message, lastCheckedAt });
    })().finally(() => {
      if (token === generation) operation = null;
    });
    return operation;
  };

  const dismissAvailable = async (): Promise<void> => {
    if (state.status !== "available") return;
    const lastCheckedAt = state.lastCheckedAt;
    const update = availableUpdate;
    availableUpdate = null;
    await releaseSafely(update);
    publish({ status: "idle", lastCheckedAt });
  };

  const cancelPending = (): void => {
    generation += 1;
    operation = null;
    const update = availableUpdate;
    availableUpdate = null;
    void releaseSafely(update);
    publish({ status: "idle", lastCheckedAt: state.lastCheckedAt });
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startupCheck: () => runCheck("startup"),
    manualCheck: () => runCheck("manual"),
    requestInstall,
    cancelInstall,
    confirmInstall,
    dismissAvailable,
    retry: () => runCheck("manual"),
    cancelPending,
  };
};
