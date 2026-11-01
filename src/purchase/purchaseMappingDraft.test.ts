import { describe, expect, it } from "vitest";
import { createPurchaseMappingDraft, editPurchaseMappingDraft, getPurchaseMappingErrors, reapplyPurchaseMappingRecommendation } from "./purchaseMappingDraft";
import type { PurchaseHeaderOption } from "./types";

const option: PurchaseHeaderOption = {
  rowIndex: 0, headers: ["품명", "수량", "수량"], signature: ["품명", "수량", "수량"], recommended: true,
  recommendation: { mapping: { name: 0, quantity: 1 }, confidence: "review", fields: [], warnings: [] },
};
describe("purchase mapping drafts", () => {
  it("keeps manually cleared fields when recommendation is explicitly reapplied", () => {
    const draft = editPurchaseMappingDraft(createPurchaseMappingDraft(option), "quantity", undefined);
    const result = reapplyPurchaseMappingRecommendation(draft, option);
    expect(result.mapping).toEqual({ name: 0 });
    expect(result.touched).toContain("quantity");
  });
  it("keeps manually selected duplicate-label columns by their original index", () => {
    const draft = editPurchaseMappingDraft(createPurchaseMappingDraft(option), "quantity", 2);
    expect(reapplyPurchaseMappingRecommendation(draft, option).mapping.quantity).toBe(2);
  });
  it("starts with no assignments when legacy candidates have no recommendation", () => {
    const legacy = { rowIndex: 0, headers: ["상품"], signature: ["상품"], recommended: true };
    expect(createPurchaseMappingDraft(legacy).mapping).toEqual({});
  });
  it("rejects missing required fields", () => {
    expect(getPurchaseMappingErrors({ quantity: 1 }, 3)).toContain("품명에 연결할 원본 열을 선택해 주세요.");
  });
  it("rejects duplicate source assignments even when supplied outside selectors", () => {
    expect(getPurchaseMappingErrors({ name: 0, quantity: 0 }, 3)).toContain("같은 원본 열을 여러 항목에 연결할 수 없습니다.");
  });
  it("rejects out of bounds and fractional indices", () => {
    expect(getPurchaseMappingErrors({ name: 3, quantity: 0.5 }, 3)).toHaveLength(1);
  });
});
