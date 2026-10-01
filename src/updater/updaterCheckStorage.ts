const UPDATER_STORAGE_KEY = "school-health-desk.updater.v1";

export type UpdaterCheckStorage = {
  readonly loadLastCheckedAt: () => number | null;
  readonly saveLastCheckedAt: (timestamp: number) => void;
};

const parseTimestamp = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export const createUpdaterCheckStorage = (storage: Storage): UpdaterCheckStorage => ({
  loadLastCheckedAt: () => {
    try {
      const raw = storage.getItem(UPDATER_STORAGE_KEY);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || !("lastUpdateCheckAt" in parsed)) return null;
      return parseTimestamp(parsed.lastUpdateCheckAt);
    } catch (error: unknown) {
      if (error instanceof SyntaxError || error instanceof DOMException) return null;
      throw error;
    }
  },
  saveLastCheckedAt: (timestamp) => {
    try {
      storage.setItem(UPDATER_STORAGE_KEY, JSON.stringify({ lastUpdateCheckAt: timestamp }));
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) throw error;
    }
  },
});

const unavailableStorage: UpdaterCheckStorage = {
  loadLastCheckedAt: () => null,
  saveLastCheckedAt: () => undefined,
};

const createDefaultUpdaterCheckStorage = (): UpdaterCheckStorage => {
  if (typeof window === "undefined") return unavailableStorage;
  try {
    return createUpdaterCheckStorage(window.localStorage);
  } catch (error: unknown) {
    if (error instanceof DOMException) return unavailableStorage;
    throw error;
  }
};

export const updaterCheckStorage = createDefaultUpdaterCheckStorage();
