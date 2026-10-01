import { isTauri } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import type {
  NativeUpdate,
  NativeUpdaterAdapter,
  UpdateCheckResult,
  UpdateInstallProgress,
  UpdateInstallResult,
  UpdaterService,
} from "./updaterTypes";

export const UPDATER_CHECK_ERROR = "업데이트 정보를 확인하지 못했습니다.";
export const UPDATER_INSTALL_ERROR = "업데이트를 설치하지 못했습니다. 현재 앱은 계속 사용할 수 있습니다.";
export const UPDATER_INTEGRITY_ERROR = "업데이트 파일의 무결성을 확인하지 못해 설치하지 않았습니다.";

const nativeUpdaterAdapter: NativeUpdaterAdapter = {
  isAvailable: isTauri,
  check,
};

const isIntegrityFailure = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes("signature")
    || normalized.includes("minisign")
    || normalized.includes("public key");
};

const installUpdate = async (
  update: NativeUpdate,
  onProgress: (progress: UpdateInstallProgress) => void,
): Promise<UpdateInstallResult> => {
  let downloadedBytes = 0;
  let totalBytes: number | null = null;
  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          totalBytes = event.data.contentLength ?? null;
          onProgress({ phase: "downloading", downloadedBytes, totalBytes });
          break;
        case "Progress":
          downloadedBytes += event.data.chunkLength;
          onProgress({ phase: "downloading", downloadedBytes, totalBytes });
          break;
        case "Finished":
          onProgress({ phase: "installing", downloadedBytes, totalBytes });
          break;
      }
    });
    return { status: "completed" };
  } catch (error: unknown) {
    return isIntegrityFailure(error)
      ? { status: "error", kind: "integrity", message: UPDATER_INTEGRITY_ERROR }
      : { status: "error", kind: "general", message: UPDATER_INSTALL_ERROR };
  }
};

const availableResult = (update: NativeUpdate): UpdateCheckResult => ({
  status: "available",
  metadata: {
    currentVersion: update.currentVersion,
    version: update.version,
    publishedAt: update.date ?? null,
    notes: update.body ?? null,
  },
  install: (onProgress) => installUpdate(update, onProgress),
  release: () => update.close(),
});

export const createUpdaterService = (
  adapter: NativeUpdaterAdapter = nativeUpdaterAdapter,
): UpdaterService => ({
  check: async () => {
    if (!adapter.isAvailable()) return { status: "unavailable" };
    try {
      const update = await adapter.check();
      return update === null ? { status: "upToDate" } : availableResult(update);
    } catch {
      return { status: "error", message: UPDATER_CHECK_ERROR };
    }
  },
});

export const updaterService = createUpdaterService();
