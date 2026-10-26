import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";
import { filterPurchaseItems, getPurchaseReviewCounts } from "./purchaseReview";

describe("purchase review filters", () => {
  it("classifies input errors separately from amount mismatches", () => {
    const error = createEmptyPurchaseItem("error");
    const mismatch = withPurchaseIssues({
      ...createEmptyPurchaseItem("mismatch"),
      name: "미확인 불일치",
      quantity: 1,
      unitPrice: 1_000,
      importedAmount: 1_500,
    });
    const valid = withPurchaseIssues({ ...createEmptyPurchaseItem("valid"), name: "정상", quantity: 1, unitPrice: 2_000 });

    expect(getPurchaseReviewCounts([error, mismatch, valid])).toEqual({ all: 3, error: 1, mismatch: 1, needsReview: 2 });
  });

  it("keeps reviewed mismatches in mismatch but removes them from needs-review", () => {
    const reviewed = withPurchaseIssues({
      ...createEmptyPurchaseItem("reviewed"),
      name: "확인 완료",
      quantity: 1,
      unitPrice: 1_000,
      importedAmount: 1_500,
      amountMismatchReviewed: true,
    });

    expect(getPurchaseReviewCounts([reviewed])).toEqual({ all: 1, error: 0, mismatch: 1, needsReview: 0 });
  });

  it("returns visible rows with their original indexes without changing selection", () => {
    const first = withPurchaseIssues({ ...createEmptyPurchaseItem("first"), name: "첫째", quantity: 1, unitPrice: 1_000 });
    const error = withPurchaseIssues({ ...createEmptyPurchaseItem("error"), selected: false, name: "오류", quantity: 0, unitPrice: 500 });
    const last = withPurchaseIssues({ ...createEmptyPurchaseItem("last"), name: "마지막", quantity: 1, unitPrice: 2_000 });

    expect(filterPurchaseItems([first, error, last], "error")).toEqual([{ item: error, originalIndex: 1 }]);
    expect([first, error, last].map((item) => item.selected)).toEqual([true, false, true]);
  });
});
