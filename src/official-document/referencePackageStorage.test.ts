import { describe, expect, it, vi } from "vitest";
import { createNativeReferencePackageStorage, ReferencePackageStorageError } from "./referencePackageStorage";

describe("reference package native storage boundary", () => {
  it("uses only fixed package commands without accepting a caller path", async () => {
    const invoke = vi.fn().mockResolvedValue(null);
    const storage = createNativeReferencePackageStorage(invoke, () => true);
    await storage.read();
    await storage.write("synthetic");
    await storage.remove();
    expect(invoke.mock.calls).toEqual([
      ["read_official_reference_package", undefined],
      ["write_official_reference_package", { payload: "synthetic" }],
      ["remove_official_reference_package", undefined],
    ]);
  });

  it("does not access native storage in ordinary browsers", async () => {
    const invoke = vi.fn();
    const storage = createNativeReferencePackageStorage(invoke, () => false);
    await expect(storage.read()).resolves.toBeNull();
    await expect(storage.write("synthetic")).rejects.toBeInstanceOf(ReferencePackageStorageError);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects malformed native results and hides native error contents", async () => {
    const invoke = vi.fn().mockResolvedValue({ unexpected: "synthetic" });
    const storage = createNativeReferencePackageStorage(invoke, () => true);
    await expect(storage.read()).rejects.toBeInstanceOf(ReferencePackageStorageError);
    invoke.mockRejectedValue("sensitive absolute path");
    await expect(storage.remove()).rejects.toThrow("기존 자료를 유지합니다");
  });
});
