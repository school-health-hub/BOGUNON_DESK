import type { PurchaseItem, PurchaseIssue } from "./types";

export const purchaseReviewFilters = ["all", "error", "mismatch", "needsReview"] as const;
export type PurchaseReviewFilter = (typeof purchaseReviewFilters)[number];

export type PurchaseReviewCounts = Readonly<Record<PurchaseReviewFilter, number>>;

export type PurchaseReviewRow = {
  readonly item: PurchaseItem;
  readonly originalIndex: number;
};

const blockingIssues: readonly PurchaseIssue[] = ["missingName", "invalidQuantity", "invalidUnitPrice"];

const hasInputError = (item: PurchaseItem): boolean => item.issues.some((issue) => blockingIssues.includes(issue));
const hasAmountMismatch = (item: PurchaseItem): boolean => item.issues.includes("amountMismatch");
const needsReview = (item: PurchaseItem): boolean => hasInputError(item) || (hasAmountMismatch(item) && !item.amountMismatchReviewed);

const matchesPurchaseReviewFilter = (item: PurchaseItem, filter: PurchaseReviewFilter): boolean => {
  switch (filter) {
    case "all": return true;
    case "error": return hasInputError(item);
    case "mismatch": return hasAmountMismatch(item);
    case "needsReview": return needsReview(item);
  }
};

export const getPurchaseReviewCounts = (items: readonly PurchaseItem[]): PurchaseReviewCounts => ({
  all: items.length,
  error: items.filter(hasInputError).length,
  mismatch: items.filter(hasAmountMismatch).length,
  needsReview: items.filter(needsReview).length,
});

export const filterPurchaseItems = (
  items: readonly PurchaseItem[],
  filter: PurchaseReviewFilter,
): readonly PurchaseReviewRow[] => items.flatMap((item, originalIndex) => (
  matchesPurchaseReviewFilter(item, filter) ? [{ item, originalIndex }] : []
));
