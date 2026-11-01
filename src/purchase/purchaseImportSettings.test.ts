import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPurchaseImportTemplates, normalizePurchaseImportTemplates, preservePurchaseImportTemplates, purchaseAnalysisTemplates, readPurchaseImportTemplatesForDisplay, PurchaseImportTemplateStorageError, savePurchaseImportTemplates } from "./purchaseImportSettings";

afterEach(() => vi.unstubAllGlobals());

describe("normalizePurchaseImportTemplates", () => {
  it("returns empty defaults for missing settings", () => expect(normalizePurchaseImportTemplates(undefined)).toEqual([]));
  it("normalizes mappings, removes duplicates, and caps at twenty", () => {
    const raw = Array.from({ length: 22 }, (_, index) => ({ id: `id-${index}`, name: ` 양식 ${index} `, headerSignature: index < 2 ? ["상품", "수량"] : [`상품${index}`], mapping: { name: 0, quantity: 1, bad: 9 } }));
    const result = normalizePurchaseImportTemplates(raw);
    expect(result).toHaveLength(20); expect(result[0]?.name).toBe("양식 0"); expect(result[0]?.mapping).toEqual({ name: 0, quantity: 1 });
  });
  it("rejects missing names and duplicate source columns", () => expect(normalizePurchaseImportTemplates([{ id: "x", name: "x", headerSignature: ["a"], mapping: { name: 0, quantity: 0 } }])).toEqual([]));
  it("preserves middle blank columns and their original indices", () => {
    const result = normalizePurchaseImportTemplates([{ id: "x", name: "x", headerSignature: ["품명", "", "수량", "", "  "], mapping: { name: 0, quantity: 2 } }]);
    expect(result[0]?.headerSignature).toEqual(["품명", "", "수량"]);
    expect(result[0]?.mapping).toEqual({ name: 0, quantity: 2 });
  });
  it("retains safe out-of-range integer indices so the analyzer can reject them rather than hiding the error", () => {
    const result = normalizePurchaseImportTemplates([{ id: "old", name: "old", headerSignature: ["품명", "수량"], mapping: { name: 0, quantity: 9 } }]);
    expect(result[0]?.mapping).toEqual({ name: 0, quantity: 9 });
  });
  it.each([-1, "1", 1.5, null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("rejects the whole template when a provided known index is invalid: %s", (index) => {
    expect(normalizePurchaseImportTemplates([{ id: "old", name: "old", headerSignature: ["품명", "수량", "단가"], mapping: { name: 0, quantity: index, unitPrice: 2 } }])).toEqual([]);
  });
  it("does not turn an invalid quantity mapping into a valid-looking partial template", () => {
    expect(normalizePurchaseImportTemplates([{ id: "old", name: "old", headerSignature: ["품명", "수량", "단가"], mapping: { name: 0, quantity: -1, unitPrice: 2 } }])).toEqual([]);
  });
  it("does not hide a malformed amount mapping by dropping the original-amount column", () => {
    expect(normalizePurchaseImportTemplates([{ id: "old", name: "old", headerSignature: ["품명", "수량", "단가", "금액"], mapping: { name: 0, quantity: 1, unitPrice: 2, amount: -1 } }])).toEqual([]);
  });
  it("keeps omitted optional mappings optional and ignores unknown legacy extras", () => {
    expect(normalizePurchaseImportTemplates([{ id: "old", name: "old", headerSignature: ["품명", "수량"], mapping: { name: 0, legacyExtra: "unused" } }])[0]?.mapping).toEqual({ name: 0 });
  });
  it("does not shift positions around malformed non-string header entries", () => {
    expect(normalizePurchaseImportTemplates([{ id: "x", name: "x", headerSignature: ["품명", null, "수량"], mapping: { name: 0, quantity: 2 } }])).toEqual([]);
  });
  it("keeps ordered signatures distinct without guessing a reordered mapping", () => {
    const first = { id: "first", name: "first", headerSignature: ["품명", "수량"], mapping: { name: 0, quantity: 1 } };
    const second = { id: "second", name: "second", headerSignature: ["수량", "품명"], mapping: { name: 1, quantity: 0 } };
    expect(normalizePurchaseImportTemplates([first, second])).toEqual([first, second]);
  });
  it("loads legacy raw bytes without saving, repairing or deleting persisted data", () => {
    const raw = JSON.stringify([{ id: "old", name: "old", headerSignature: ["품명", "", "수량"], mapping: { name: 0, quantity: 8 } }]);
    const getItem = vi.fn(() => raw); const setItem = vi.fn(); const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem, setItem, removeItem });
    expect(loadPurchaseImportTemplates()[0]?.mapping.quantity).toBe(8);
    expect(getItem).toHaveBeenCalledExactlyOnceWith("school-health-desk.purchase-import-templates.v1");
    expect(setItem).not.toHaveBeenCalled(); expect(removeItem).not.toHaveBeenCalled();
    expect(raw).toBe(JSON.stringify([{ id: "old", name: "old", headerSignature: ["품명", "", "수량"], mapping: { name: 0, quantity: 8 } }]));
  });
  it("preserves invalid numeric mappings without repairing or deleting persisted bytes", () => {
    const raw = JSON.stringify([{ id: "old", name: "old", headerSignature: ["품명", "수량", "단가", "금액"], mapping: { name: 0, quantity: 1, unitPrice: 2, amount: -1 } }]);
    const persisted = new Map([["school-health-desk.purchase-import-templates.v1", raw]]);
    const setItem = vi.fn((key: string, value: string) => persisted.set(key, value));
    const removeItem = vi.fn((key: string) => persisted.delete(key));
    vi.stubGlobal("localStorage", { getItem: (key: string) => persisted.get(key) ?? null, setItem, removeItem });
    expect(loadPurchaseImportTemplates()[0]?.mapping.amount).toBe(-1);
    expect(persisted.get("school-health-desk.purchase-import-templates.v1")).toBe(raw);
    expect(setItem).not.toHaveBeenCalled(); expect(removeItem).not.toHaveBeenCalled();
  });
  it("round-trips existing-schema records without repairing names, positions, invalid numbers, duplicates or limits", () => {
    const templates = Array.from({ length: 22 }, () => ({ id: " old ", name: " old ", headerSignature: [" 품명 ", "", "수량", ""], mapping: { name: 0, quantity: 0, amount: -1, unitPrice: 1.5 } }));
    const persisted = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => persisted.get(key) ?? null, setItem: (key: string, value: string) => persisted.set(key, value) });
    savePurchaseImportTemplates(templates);
    expect(loadPurchaseImportTemplates()).toEqual(templates);
    expect(preservePurchaseImportTemplates(templates)).toBe(templates);
    expect(normalizePurchaseImportTemplates(loadPurchaseImportTemplates())).toEqual([]);
  });
  it.each(["not json", JSON.stringify([{ id: "old", name: "old", headerSignature: ["품명"], mapping: { name: "0" } }])])("fails closed without replacing unrepresentable persisted records: %s", (raw) => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem });
    expect(() => loadPurchaseImportTemplates()).toThrow(PurchaseImportTemplateStorageError);
    expect(() => savePurchaseImportTemplates([])).toThrow(PurchaseImportTemplateStorageError);
    expect(setItem).not.toHaveBeenCalled();
  });
  it("does not re-save unchanged template values or rewrite their original JSON formatting", () => {
    const templates = [{ id: " old ", name: " old ", headerSignature: ["품명", "", "수량", ""], mapping: { name: 0, quantity: 1, amount: -1 } }];
    const raw = JSON.stringify(templates, null, 2);
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem });
    savePurchaseImportTemplates(templates);
    expect(setItem).not.toHaveBeenCalled();
    expect(loadPurchaseImportTemplates()).toEqual(templates);
  });
  it("keeps unknown legacy properties on disk and refuses to turn them into synchronizable metadata", () => {
    const raw = JSON.stringify([{ id: "old", name: "old", headerSignature: ["품명"], mapping: { name: 0 }, sampleRows: [["합성 데이터"]] }]);
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem });
    expect(() => loadPurchaseImportTemplates()).toThrow(PurchaseImportTemplateStorageError);
    expect(() => savePurchaseImportTemplates([])).toThrow(PurchaseImportTemplateStorageError);
    expect(setItem).not.toHaveBeenCalled();
  });
  it("keeps all eligible conflicts and records beyond twenty visible to the analyzer", () => {
    const templates = Array.from({ length: 22 }, (_, index) => ({ id: `old-${index}`, name: `old-${index}`, headerSignature: ["품명", "수량"], mapping: { name: index % 2, quantity: (index + 1) % 2 } }));
    expect(purchaseAnalysisTemplates(templates)).toEqual(templates);
  });
  it("offers an empty analysis-only display with a warning while persistence remains blocked", () => {
    const raw = JSON.stringify([{ id: "old", name: "old", headerSignature: ["품명"], mapping: { name: "0" } }]);
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem });
    const display = readPurchaseImportTemplatesForDisplay(loadPurchaseImportTemplates);
    expect(display.templates).toEqual([]);
    expect(display.warning).toContain("원본");
    expect(() => loadPurchaseImportTemplates()).toThrow(PurchaseImportTemplateStorageError);
    expect(() => savePurchaseImportTemplates(display.templates)).toThrow(PurchaseImportTemplateStorageError);
    expect(setItem).not.toHaveBeenCalled();
  });
});
