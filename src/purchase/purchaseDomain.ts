import {
  defaultPurchaseOutputColumns,
  purchaseOutputColumnIds,
  type PurchaseItem,
  type PurchaseIssue,
  type PurchaseOutputColumnId,
  type PurchaseOutputReadiness,
} from "./types";

export const resolvePurchaseAmount = (item: Pick<PurchaseItem, "quantity" | "unitPrice" | "importedAmount">): number | null => {
  if (item.quantity !== null && item.unitPrice !== null && Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice)) return Math.round(item.quantity * item.unitPrice);
  return item.importedAmount !== null && Number.isFinite(item.importedAmount) ? item.importedAmount : null;
};

export const getPurchaseIssues = (item: Omit<PurchaseItem, "issues">): readonly PurchaseIssue[] => {
  const issues: PurchaseIssue[] = [];
  if (item.name.trim() === "") issues.push("missingName");
  if (item.quantity === null || !Number.isFinite(item.quantity) || item.quantity <= 0) issues.push("invalidQuantity");
  if (item.unitPrice === null || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) issues.push("invalidUnitPrice");
  if (item.quantity !== null && item.unitPrice !== null && item.importedAmount !== null && Math.abs(Math.round(item.quantity * item.unitPrice) - item.importedAmount) >= 1) issues.push("amountMismatch");
  return issues;
};

export const withPurchaseIssues = (item: Omit<PurchaseItem, "issues">): PurchaseItem => {
  const issues = getPurchaseIssues(item);
  return {
    ...item,
    issues,
    amountMismatchReviewed: issues.includes("amountMismatch") && item.amountMismatchReviewed,
  };
};
export const selectedPurchaseTotal = (items: readonly PurchaseItem[]): number => items.filter((item) => item.selected).reduce((sum, item) => sum + (resolvePurchaseAmount(item) ?? 0), 0);

export const appendPurchaseItemsWithSessionIds = (
  current: readonly PurchaseItem[],
  incoming: readonly PurchaseItem[],
  nextId: () => string,
): readonly PurchaseItem[] => [
  ...current,
  ...incoming.map((item) => ({ ...item, id: nextId(), amountMismatchReviewed: false })),
];

export const updatePurchaseItem = (
  item: PurchaseItem,
  patch: Partial<Omit<PurchaseItem, "id" | "issues">>,
): PurchaseItem => {
  const amountInputChanged = (patch.quantity !== undefined && patch.quantity !== item.quantity)
    || (patch.unitPrice !== undefined && patch.unitPrice !== item.unitPrice)
    || (patch.importedAmount !== undefined && patch.importedAmount !== item.importedAmount);
  return withPurchaseIssues({
    ...item,
    ...patch,
    amountMismatchReviewed: amountInputChanged ? false : (patch.amountMismatchReviewed ?? item.amountMismatchReviewed),
  });
};

const blockingPurchaseIssues: readonly PurchaseIssue[] = ["missingName", "invalidQuantity", "invalidUnitPrice"];

export const getPurchaseOutputReadiness = (items: readonly PurchaseItem[]): PurchaseOutputReadiness => {
  const selected = items.filter((item) => item.selected);
  const blockingCount = selected.filter((item) => item.issues.some((issue) => blockingPurchaseIssues.includes(issue))).length;
  const unreviewedMismatchCount = selected.filter((item) => item.issues.includes("amountMismatch") && !item.amountMismatchReviewed).length;
  return {
    ready: blockingCount === 0 && unreviewedMismatchCount === 0,
    blockingCount,
    unreviewedMismatchCount,
  };
};

export const normalizePurchaseOutputColumns = (value: unknown): readonly PurchaseOutputColumnId[] => {
  if (!Array.isArray(value)) return defaultPurchaseOutputColumns;
  const result = value.filter((entry, index): entry is PurchaseOutputColumnId => typeof entry === "string" && purchaseOutputColumnIds.includes(entry as PurchaseOutputColumnId) && value.indexOf(entry) === index);
  if (!result.includes("name")) result.splice(Math.min(1, result.length), 0, "name");
  return result.length === 0 ? defaultPurchaseOutputColumns : result;
};

export const createEmptyPurchaseItem = (id: string): PurchaseItem => withPurchaseIssues({ id, selected: true, name: "", specification: "", quantity: null, unitPrice: null, importedAmount: null, vendor: "", note: "", budgetItem: "", sourceName: null, amountMismatchReviewed: false });
