import { hashReferencePackageRow } from "./referencePackage";
import { OFFICIAL_DOCUMENT_REFERENCE_HEADERS as headers } from "./referenceRepository";
import { describe, expect, it, vi } from "vitest";
import { createReferencePackageService, ReferencePackageRestoreError } from "./referencePackageService";
import type { ReferencePackageValidation, ValidatedReferencePackage } from "./referencePackageTypes";
import type { ReferencePackageStorage } from "./referencePackageStorage";

const fixture = (id: string): ValidatedReferencePackage => ({
  metadata: { schemaVersion: 1, packageId: id, packageVersion: "1.0.0", publishedAt: "2026-10-22", source: "synthetic", usageTerms: "synthetic", redistribution: "synthetic", review: { reviewer: "synthetic", reviewedAt: "2026-10-22" } },
  references: [], serialized: id, contentHash: id,
});
const report = { totalRows: 0, acceptedRows: 0, excludedRows: 0, errorCount: 0, warningCount: 0, issues: [] };
const validate = async (text: string): Promise<ReferencePackageValidation> => text === "invalid"
  ? { status: "error", message: "synthetic invalid", report }
  : { status: "valid", package: fixture(text), report };
const memory = (initial: string | null = null) => {
  let text = initial;
  const storage: ReferencePackageStorage = {
    read: vi.fn(async () => text),
    write: vi.fn(async (next) => { text = next; }),
    remove: vi.fn(async () => { text = null; }),
  };
  return { storage, contents: () => text };
};

describe("reference package session and persistent replacement", () => {
  it("keeps a session-only package out of disk and retains saved package identity", async () => {
    const { storage, contents } = memory("previous");
    const service = createReferencePackageService({ storage, validate });
    await service.initialize();
    await service.activate(fixture("session"), "session");
    expect(service.snapshot()).toMatchObject({ mode: "session", active: { metadata: { packageId: "session" } }, savedMetadata: { packageId: "previous" } });
    expect(storage.write).not.toHaveBeenCalled();
    expect(contents()).toBe("previous");
  });

  it("retains active and saved packages on failed replacement", async () => {
    const { storage, contents } = memory("previous");
    const service = createReferencePackageService({ storage, validate });
    await service.initialize();
    vi.mocked(storage.write).mockRejectedValue(new Error("synthetic failure"));
    await expect(service.activate(fixture("next"), "persistent")).rejects.toThrow("synthetic failure");
    expect(service.snapshot().active?.metadata.packageId).toBe("previous");
    expect(contents()).toBe("previous");
  });

  it("revalidates saved JSON and never deletes invalid stored data automatically", async () => {
    const { storage, contents } = memory("invalid");
    const service = createReferencePackageService({ storage, validate });
    await expect(service.initialize()).rejects.toBeInstanceOf(ReferencePackageRestoreError);
    expect(service.snapshot().active).toBeNull();
    expect(service.snapshot().saved).toBe(true);
    expect(contents()).toBe("invalid");
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("serializes slow restore before user replacement and initializes only once", async () => {
    const { storage } = memory("previous");
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(storage.read).mockImplementation(async () => { await gate; return "previous"; });
    const service = createReferencePackageService({ storage, validate });
    const restore = service.initialize();
    const replace = service.activate(fixture("next"), "persistent");
    release?.();
    await Promise.all([restore, replace, service.initialize()]);
    expect(service.snapshot().active?.metadata.packageId).toBe("next");
    expect(storage.read).toHaveBeenCalledTimes(1);
  });

  it("deletes saved package only explicitly and clears browsing state", async () => {
    const { storage, contents } = memory("previous");
    const service = createReferencePackageService({ storage, validate });
    await service.initialize();
    await service.remove();
    expect(contents()).toBeNull();
    expect(service.snapshot()).toEqual({ active: null, mode: null,
 saved: false, savedMetadata: null, error: null });
    await expect(service.repository.list()).resolves.toEqual({ status: "notConnected" });
  });

  it("rejects a modified preview before saving or exposing it", async () => {
    const { storage } = memory();
    const service = createReferencePackageService({ storage, validate });
    await expect(service.activate({ ...fixture("next"), contentHash: "changed" }, "persistent")).rejects.toBeInstanceOf(ReferencePackageRestoreError);
    expect(storage.write).not.toHaveBeenCalled();
    expect(service.snapshot().active).toBeNull();
  });
  it("does not repeat a stale restore error after explicit deletion or replacement", async () => {
    const { storage } = memory("invalid");
    const service = createReferencePackageService({ storage, validate });
    await expect(service.initialize()).rejects.toBeInstanceOf(ReferencePackageRestoreError);
    await service.remove();
    await expect(service.initialize()).resolves.toBeUndefined();
    expect(service.snapshot().error).toBeNull();
    const second = createReferencePackageService({ storage: memory("invalid").storage, validate });
    await expect(second.initialize()).rejects.toBeInstanceOf(ReferencePackageRestoreError);
    await second.activate(fixture("repaired"), "persistent");
    await expect(second.initialize()).resolves.toBeUndefined();
    expect(second.snapshot().active?.metadata.packageId).toBe("repaired");
  });

  it("never overwrites an imported session when initialization is called later", async () => {
    const { storage } = memory("previous");
    const service = createReferencePackageService({ storage, validate });
    await service.activate(fixture("session"), "session");
    await service.initialize();
    expect(service.snapshot().active?.metadata.packageId).toBe("session");
    expect(service.snapshot().savedMetadata?.packageId).toBe("previous");
  });

  it("offers explicit removal after native integrity rejection without exposing content", async () => {
    const { storage } = memory();
    vi.mocked(storage.read).mockRejectedValue(new Error("synthetic corrupt envelope"));
    const service = createReferencePackageService({ storage, validate });
    await expect(service.initialize()).rejects.toThrow();
    expect(service.snapshot()).toMatchObject({ saved: true, active: null, savedMetadata: null });
    expect(service.snapshot().error).not.toContain("synthetic corrupt envelope");
    await service.remove();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it("persists accepted rows only and revalidates them with the real validator on restart", async () => {
    const row = (no: string, description: string) => headers.map((header) => {
      const fields: Readonly<Record<string, string>> = { No: no, 사용여부: "TRUE", 비식별여부: "TRUE", 자료명: "합성 자료", 설명: description };
      return fields[header] ?? "";
    });
    const rows = [row("1", "합성 참고용"), row("2", "합성초등학교 안내")];
    const source = JSON.stringify({
      schemaVersion: 1, packageId: "synthetic", packageVersion: "1.0.0", publishedAt: "2026-10-22",
      source: "합성 자료", usageTerms: "검증 전용", redistribution: "제한", headers, rows,
      review: { reviewer: "합성 검토자", reviewedAt: "2026-10-22", approvedRows: await Promise.all(rows.map(async (values) => ({ sourceNo: values[0], sha256: await hashReferencePackageRow(headers, values) }))) },
    });
    const { storage, contents } = memory();
    const service = createReferencePackageService({ storage });
    const result = await service.prepare(source);
    expect(result).toMatchObject({ status: "valid", report: { acceptedRows: 1, excludedRows: 1 } });
    if (result.status !== "valid") throw new ReferencePackageRestoreError();
    await service.activate(result.package, "persistent");
    expect(contents()).not.toContain("합성초등학교");
    const restarted = createReferencePackageService({ storage });
    await restarted.initialize();
    expect(restarted.snapshot().active?.references).toHaveLength(1);
    expect(restarted.snapshot().active?.contentHash).toBe(result.package.contentHash);
  });

});
