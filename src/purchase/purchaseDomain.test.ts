import { describe, expect, it } from "vitest";
import {
  appendPurchaseItemsWithSessionIds,
  createEmptyPurchaseItem,
  getPurchaseIssues,
  getPurchaseOutputReadiness,
  normalizePurchaseOutputColumns,
  resolvePurchaseAmount,
  selectedPurchaseTotal,
  updatePurchaseItem,
  withPurchaseIssues,
} from "./purchaseDomain";

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
  it("treats missing quantity and unit price as blocking output issues", () => {
    const missingNumbers = withPurchaseIssues({ ...createEmptyPurchaseItem("missing-numbers"), name: "합성 품목" });

    expect(missingNumbers.issues).toEqual(["invalidQuantity", "invalidUnitPrice"]);
    expect(getPurchaseOutputReadiness([missingNumbers])).toEqual({
      ready: false,
      blockingCount: 1,
      unreviewedMismatchCount: 0,
    });
  });
  it("normalizes unknown and duplicate columns while restoring name", () => {
    expect(normalizePurchaseOutputColumns(["amount", "amount", "unknown"])).toEqual(["amount", "name"]);
  });

  it("assigns unique session ids across independent and repeated imports", () => {
    let sequence = 0;
    const nextId = (): string => `session-${sequence++}`;
    const imported = withPurchaseIssues({ ...createEmptyPurchaseItem("purchase-0-0"), name: "합성 품목" });
    const first = appendPurchaseItemsWithSessionIds([], [imported], nextId);
    const second = appendPurchaseItemsWithSessionIds(first, [imported], nextId);

    expect(second.map((item) => item.id)).toEqual(["session-0", "session-1"]);
    expect(new Set(second.map((item) => item.id)).size).toBe(second.length);
  });

  it("isolates edits and deletes after colliding native ids are replaced", () => {
    let sequence = 0;
    const imported = withPurchaseIssues({ ...createEmptyPurchaseItem("purchase-0-0"), name: "합성 품목" });
    const items = appendPurchaseItemsWithSessionIds(
      appendPurchaseItemsWithSessionIds([], [imported], () => `session-${sequence++}`),
      [imported],
      () => `session-${sequence++}`,
    );
    const edited = items.map((item) => item.id === "session-0" ? updatePurchaseItem(item, { name: "수정됨" }) : item);
    const remaining = edited.filter((item) => item.id !== "session-0");

    expect(edited.map((item) => item.name)).toEqual(["수정됨", "합성 품목"]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("session-1");
  });

  it("blocks invalid selected rows and requires explicit amount mismatch review", () => {
    const invalid = withPurchaseIssues({ ...createEmptyPurchaseItem("invalid"), quantity: 0, unitPrice: -1 });
    const mismatch = withPurchaseIssues({ ...createEmptyPurchaseItem("mismatch"), name: "마스크", quantity: 2, unitPrice: 1_000, importedAmount: 2_500 });

    expect(getPurchaseOutputReadiness([invalid, mismatch])).toEqual({
      ready: false,
      blockingCount: 1,
      unreviewedMismatchCount: 1,
    });
    expect(getPurchaseOutputReadiness([
      { ...invalid, selected: false },
      { ...mismatch, amountMismatchReviewed: true },
    ])).toEqual({ ready: true, blockingCount: 0, unreviewedMismatchCount: 0 });
  });

  it("invalidates amount review only when amount inputs actually change", () => {
    const reviewed = withPurchaseIssues({
      ...createEmptyPurchaseItem("mismatch"),
      name: "마스크",
      quantity: 2,
      unitPrice: 1_000,
      importedAmount: 2_500,
      amountMismatchReviewed: true,
    });

    expect(updatePurchaseItem(reviewed, { note: "확인함" }).amountMismatchReviewed).toBe(true);
    expect(updatePurchaseItem(reviewed, { quantity: 2 }).amountMismatchReviewed).toBe(true);
    expect(updatePurchaseItem(reviewed, { quantity: 3 }).amountMismatchReviewed).toBe(false);
    expect(updatePurchaseItem(reviewed, { unitPrice: 1_250 }).issues).not.toContain("amountMismatch");
  });
});
