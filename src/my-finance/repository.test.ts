import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFinanceSnapshot } from "./repository";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => mocks);

describe("local finance IPC boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("refuses browser persistence instead of using a plaintext fallback", async () => {
    mocks.isTauri.mockReturnValue(false);
    await expect(loadFinanceSnapshot()).rejects.toThrow("Windows 앱");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("loads only through the dedicated finance command", async () => {
    const snapshot = { identity: { schemaVersion: 2, datasetId: "synthetic", revision: 1, history: ["synthetic"] }, income: [] };
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockResolvedValue(snapshot);
    await expect(loadFinanceSnapshot()).resolves.toEqual(snapshot);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith("my_finance_load_snapshot");
  });
  it("propagates native failure without creating an empty replacement", async () => {
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockRejectedValue(new Error("synthetic key failure"));
    await expect(loadFinanceSnapshot()).rejects.toThrow("synthetic key failure");
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
