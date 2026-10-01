import { describe, expect, it, vi } from "vitest";
import {
  createUpdaterService,
  UPDATER_CHECK_ERROR,
  UPDATER_INTEGRITY_ERROR,
} from "./updaterService";
import type { NativeDownloadEvent, NativeUpdate, NativeUpdaterAdapter } from "./updaterTypes";

const nativeUpdate = (overrides: Partial<NativeUpdate> = {}): NativeUpdate => ({
  currentVersion: "0.1.0",
  version: "0.2.0",
  date: "2026-10-01T09:00:00Z",
  body: "업데이트 안내",
  downloadAndInstall: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const adapter = (update: NativeUpdate | null): NativeUpdaterAdapter => ({
  isAvailable: () => true,
  check: vi.fn().mockResolvedValue(update),
});

describe("updater service", () => {
  it("returns up to date when the native check finds no update", async () => {
    const native = adapter(null);

    const result = await createUpdaterService(native).check();

    expect(result).toEqual({ status: "upToDate" });
    expect(native.check).toHaveBeenCalledOnce();
  });

  it("normalizes available update metadata without downloading or installing", async () => {
    const update = nativeUpdate();
    const native = adapter(update);

    const result = await createUpdaterService(native).check();

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.metadata).toEqual({
      currentVersion: "0.1.0",
      version: "0.2.0",
      publishedAt: "2026-10-01T09:00:00Z",
      notes: "업데이트 안내",
    });
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
    expect(update.close).not.toHaveBeenCalled();
  });

  it("maps native failures to a safe message without exposing raw manifest or key material", async () => {
    const rawSecret = "signature=raw-signature private-key=raw-key manifest={sensitive}";
    const native: NativeUpdaterAdapter = {
      isAvailable: () => true,
      check: vi.fn().mockRejectedValue(new Error(rawSecret)),
    };

    const result = await createUpdaterService(native).check();

    expect(result).toEqual({ status: "error", message: UPDATER_CHECK_ERROR });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
    expect(JSON.stringify(result)).not.toContain("signature");
    expect(JSON.stringify(result)).not.toContain("private-key");
  });

  it("normalizes native download progress and installation readiness", async () => {
    const downloadAndInstall = vi.fn(async (onEvent?: (event: NativeDownloadEvent) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
      onEvent?.({ event: "Finished" });
    });
    const result = await createUpdaterService(adapter(nativeUpdate({ downloadAndInstall }))).check();
    if (result.status !== "available") return;
    const progress = vi.fn();

    const installResult = await result.install(progress);

    expect(installResult).toEqual({ status: "completed" });
    expect(progress).toHaveBeenNthCalledWith(1, { phase: "downloading", downloadedBytes: 0, totalBytes: 100 });
    expect(progress).toHaveBeenNthCalledWith(2, { phase: "downloading", downloadedBytes: 40, totalBytes: 100 });
    expect(progress).toHaveBeenNthCalledWith(3, { phase: "installing", downloadedBytes: 40, totalBytes: 100 });
  });

  it("classifies signature failures without exposing the native error", async () => {
    const rawError = "minisign signature rejected: raw-key-material";
    const result = await createUpdaterService(adapter(nativeUpdate({
      downloadAndInstall: vi.fn().mockRejectedValue(new Error(rawError)),
    }))).check();
    if (result.status !== "available") return;

    const installResult = await result.install(vi.fn());

    expect(installResult).toEqual({
      status: "error",
      kind: "integrity",
      message: UPDATER_INTEGRITY_ERROR,
    });
    expect(JSON.stringify(installResult)).not.toContain(rawError);
    expect(JSON.stringify(installResult)).not.toContain("raw-key-material");
  });

  it("returns unavailable outside the Tauri runtime without invoking native IPC", async () => {
    const native: NativeUpdaterAdapter = {
      isAvailable: () => false,
      check: vi.fn(),
    };

    const result = await createUpdaterService(native).check();

    expect(result).toEqual({ status: "unavailable" });
    expect(native.check).not.toHaveBeenCalled();
  });
});
