import { describe, expect, it } from "vitest";
import { normalizePurchaseImportTemplates } from "./purchaseImportSettings";

describe("normalizePurchaseImportTemplates", () => {
  it("returns empty defaults for missing settings", () => expect(normalizePurchaseImportTemplates(undefined)).toEqual([]));
  it("normalizes mappings, removes duplicates, and caps at twenty", () => {
    const raw = Array.from({ length: 22 }, (_, index) => ({ id: `id-${index}`, name: ` 양식 ${index} `, headerSignature: index < 2 ? ["상품", "수량"] : [`상품${index}`], mapping: { name: 0, quantity: 1, bad: 9 } }));
    const result = normalizePurchaseImportTemplates(raw);
    expect(result).toHaveLength(20); expect(result[0]?.name).toBe("양식 0"); expect(result[0]?.mapping).toEqual({ name: 0, quantity: 1 });
  });
  it("rejects missing names and duplicate source columns", () => expect(normalizePurchaseImportTemplates([{ id: "x", name: "x", headerSignature: ["a"], mapping: { name: 0, quantity: 0 } }])).toEqual([]));
});
