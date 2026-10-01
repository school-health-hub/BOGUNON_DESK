import { describe, expect, it, vi } from "vitest";
import { createUpdaterController } from "./updaterController";
import type { UpdateCheckResult, UpdateInstallProgress, UpdaterService } from "./updaterTypes";

const metadata = {
  currentVersion: "0.1.0",
  version: "0.2.0",
  publishedAt: "2026-10-01T09:00:00Z",
  notes: "더 안정적인 업무 환경을 제공합니다.",
} as const;

const availableResult = (
  install: (onProgress: (progress: UpdateInstallProgress) => void) => Promise<"completed" | "failed"> = async () => "completed",
): Extract<UpdateCheckResult, { readonly status: "available" }> => ({
  status: "available",
  metadata,
  install: async (onProgress) => {
    const result = await install(onProgress);
    return result === "completed"
      ? { status: "completed" }
      : { status: "error", kind: "general", message: "업데이트를 설치하지 못했습니다. 현재 앱은 계속 사용할 수 있습니다." };
  },
  release: vi.fn().mockResolvedValue(undefined),
});

const setup = (results: readonly UpdateCheckResult[], lastCheckedAt: number | null = null) => {
  const check = vi.fn<UpdaterService["check"]>();
  for (const result of results) check.mockResolvedValueOnce(result);
  const saveLastCheckedAt = vi.fn();
  const controller = createUpdaterController({
    service: { check },
    storage: { loadLastCheckedAt: () => lastCheckedAt, saveLastCheckedAt },
    now: () => Date.UTC(2026, 8, 29, 13, 0),
  });
  return { check, controller, saveLastCheckedAt };
};

describe("desktop updater controller", () => {
  it("skips startup checks inside the 24-hour throttle window", async () => {
    const now = Date.UTC(2026, 8, 29, 13, 0);
    const { check, controller } = setup([], now - 1_000);

    await controller.startupCheck();

    expect(check).not.toHaveBeenCalled();
    expect(controller.getState().status).toBe("idle");
  });

  it("runs an eligible startup check and records the attempt time", async () => {
    const { check, controller, saveLastCheckedAt } = setup([{ status: "upToDate" }]);

    await controller.startupCheck();

    expect(check).toHaveBeenCalledOnce();
    expect(saveLastCheckedAt).toHaveBeenCalledWith(Date.UTC(2026, 8, 29, 13, 0));
    expect(controller.getState().status).toBe("upToDate");
  });

  it("manual checks bypass the throttle and expose friendly results", async () => {
    const now = Date.UTC(2026, 8, 29, 13, 0);
    const { check, controller } = setup([{ status: "upToDate" }], now);

    await controller.manualCheck();

    expect(check).toHaveBeenCalledOnce();
    expect(controller.getState().status).toBe("upToDate");
  });

  it("keeps startup failures silent while manual failures remain actionable", async () => {
    const failure: UpdateCheckResult = { status: "error", message: "업데이트 정보를 확인하지 못했습니다." };
    const { controller } = setup([failure, failure]);

    await controller.startupCheck();
    expect(controller.getState().status).toBe("idle");

    await controller.manualCheck();
    expect(controller.getState()).toMatchObject({ status: "error", operation: "check" });
  });

  it("shows an available update, dismisses it for the session, and does not install during check", async () => {
    const install = vi.fn().mockResolvedValue("completed");
    const result = availableResult(install);
    const { controller } = setup([result]);

    await controller.startupCheck();
    expect(controller.getState()).toMatchObject({ status: "available", metadata });
    expect(install).not.toHaveBeenCalled();

    await controller.dismissAvailable();
    expect(controller.getState().status).toBe("idle");
    expect(result.release).toHaveBeenCalledOnce();
  });

  it("requires confirmation before install and reports progress", async () => {
    const install = vi.fn(async (onProgress: (progress: UpdateInstallProgress) => void) => {
      onProgress({ phase: "downloading", downloadedBytes: 25, totalBytes: 100 });
      onProgress({ phase: "installing", downloadedBytes: 100, totalBytes: 100 });
      return "completed" as const;
    });
    const { controller } = setup([availableResult(install)]);
    await controller.manualCheck();

    controller.requestInstall();
    expect(controller.getState().status).toBe("confirming");
    controller.cancelInstall();
    expect(controller.getState().status).toBe("available");
    expect(install).not.toHaveBeenCalled();

    controller.requestInstall();
    const states: string[] = [];
    const unsubscribe = controller.subscribe(() => states.push(controller.getState().status));
    await controller.confirmInstall();
    unsubscribe();

    expect(install).toHaveBeenCalledOnce();
    expect(states).toContain("downloading");
    expect(states).toContain("installing");
  });

  it("keeps install failures recoverable and retries with a fresh check", async () => {
    const first = availableResult(async () => "failed");
    const second = availableResult();
    const { check, controller } = setup([first, second]);
    await controller.manualCheck();
    controller.requestInstall();

    await controller.confirmInstall();
    expect(controller.getState()).toMatchObject({ status: "error", operation: "install" });

    await controller.retry();
    expect(check).toHaveBeenCalledTimes(2);
    expect(controller.getState().status).toBe("available");
  });

  it("prevents duplicate checks and ignores stale completion after cancellation", async () => {
    let resolveCheck: (result: UpdateCheckResult) => void = () => undefined;
    const check = vi.fn(() => new Promise<UpdateCheckResult>((resolve) => { resolveCheck = resolve; }));
    const controller = createUpdaterController({
      service: { check },
      storage: { loadLastCheckedAt: () => null, saveLastCheckedAt: vi.fn() },
      now: () => 1_796_000_000_000,
    });

    const first = controller.manualCheck();
    const duplicate = controller.manualCheck();
    await Promise.resolve();
    expect(check).toHaveBeenCalledOnce();

    controller.cancelPending();
    resolveCheck(availableResult());
    await Promise.all([first, duplicate]);

    expect(controller.getState().status).toBe("idle");
  });
});
