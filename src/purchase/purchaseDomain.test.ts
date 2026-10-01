import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem, getPurchaseIssues, normalizePurchaseOutputColumns, resolvePurchaseAmount, selectedPurchaseTotal, withPurchaseIssues } from "./purchaseDomain";

describe("purchase domain", () => {
  it("prefers computed rounded amount and totals selected rows", () => {
    const first = withPurchaseIssues({ ...createEmptyPurchaseItem("1"), name: "마스크", quantity: 2, unitPrice: 1250.4, importedAmount: 9999 });
    const second = withPurchaseIssues({ ...createEmptyPurchaseItem("2"), name: "장갑", importedAmount: 3000, selected: false });
    expect(resolvePurchaseAmount(first)).toBe(2501);
    expect(selectedPurchaseTotal([first, second])).toBe(2501);
  });
  it("reports missing and invalid values plus imported mismatch", () => {
    expect(getPurchaseIssues({ ...createEmptyPurchaseItem("1"), quantity: 0, unitPrice: -1, importedAmount: 3 })).toEqual(["missingName", "invalidQuantity", "invalidUnitPrice", "amountMismatch"]);
  });
  it("normalizes unknown and duplicate columns while restoring name", () => {
    expect(normalizePurchaseOutputColumns(["amount", "amount", "unknown"])).toEqual(["amount", "name"]);
  });
});
