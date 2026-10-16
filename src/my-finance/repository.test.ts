import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFinanceSnapshot, listFinanceIncome, createFinanceIncome, updateFinanceIncome, deleteFinanceIncome, exportFinanceBackup, selectFinanceBackup, inspectFinanceBackup, restoreFinanceBackup, cancelFinanceBackup } from "./repository";
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

describe("finance CRUD conflict boundary", () => {
  const identity = { schemaVersion: 2 as const, datasetId: "synthetic", revision: 2, history: ["synthetic-a", "synthetic-b"] };
  const entry = { id: "synthetic", sourceName: "synthetic", incomeKind: "lecture" as const, contractLabel: "", taxCategory: "unverified" as const, taxCategoryVerified: false, earnedOn: "2026-10-16", paidOn: null, grossKrw: 100, deductions: [], netKrw: 100, notes: "" };
  beforeEach(() => { vi.resetAllMocks(); mocks.isTauri.mockReturnValue(true); });
  it("passes the complete expected identity to each native mutation", async () => {
    await listFinanceIncome();
    expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_list_income");
    await createFinanceIncome(identity, entry);
    expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_create_income", { expected: identity, entry });
    await updateFinanceIncome(identity, entry);
    expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_update_income", { expected: identity, entry });
    await deleteFinanceIncome(identity, entry.id);
    expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_delete_income", { expected: identity, id: entry.id });
  });
  it("propagates conflict without retrying or refreshing the identity automatically", async () => {
    mocks.invoke.mockRejectedValue(new Error("synthetic conflict"));
    await expect(updateFinanceIncome(identity, entry)).rejects.toThrow("synthetic conflict");
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("rejects every browser CRUD call before invoking native code", async () => {
    mocks.isTauri.mockReturnValue(false);
    for (const action of [() => listFinanceIncome(), () => createFinanceIncome(identity, entry), () => updateFinanceIncome(identity, entry), () => deleteFinanceIncome(identity, entry.id)]) {
      await expect(action()).rejects.toThrow("Windows 앱");
    }
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});


describe("finance backup IPC boundary", () => {
  const expected = { schemaVersion: 2 as const, datasetId: "synthetic", revision: 1, history: ["synthetic"] };
  beforeEach(() => { vi.resetAllMocks(); mocks.isTauri.mockReturnValue(true); });
  it("uses only native dialog commands and an opaque single-use restore ticket", async () => {
    await exportFinanceBackup(expected, "synthetic-password-123");
    expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_export_backup", { expected, password: "synthetic-password-123" });
    await selectFinanceBackup(); expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_select_backup");
    await inspectFinanceBackup("synthetic-ticket", "synthetic-password-123");
    expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_inspect_backup", { token: "synthetic-ticket", password: "synthetic-password-123" });
    await restoreFinanceBackup("synthetic-ticket"); expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_restore_backup", { token: "synthetic-ticket" });
    await cancelFinanceBackup("synthetic-ticket"); expect(mocks.invoke).toHaveBeenLastCalledWith("my_finance_cancel_backup", { token: "synthetic-ticket" });
  });
  it("refuses all backup operations in a browser without invoking any native command", async () => {
    mocks.isTauri.mockReturnValue(false);
    for (const task of [() => exportFinanceBackup(expected, "synthetic-password-123"), selectFinanceBackup, () => inspectFinanceBackup("synthetic-ticket", "synthetic-password-123"), () => restoreFinanceBackup("synthetic-ticket"), () => cancelFinanceBackup("synthetic-ticket")]) {
      await expect(task()).rejects.toThrow("Windows 앱");
    }
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
