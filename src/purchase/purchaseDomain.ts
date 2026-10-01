import { defaultPurchaseOutputColumns, purchaseOutputColumnIds, type PurchaseItem, type PurchaseIssue, type PurchaseOutputColumnId } from "./types";

export const resolvePurchaseAmount = (item: Pick<PurchaseItem, "quantity" | "unitPrice" | "importedAmount">): number | null => {
  if (item.quantity !== null && item.unitPrice !== null && Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice)) return Math.round(item.quantity * item.unitPrice);
  return item.importedAmount !== null && Number.isFinite(item.importedAmount) ? item.importedAmount : null;
};

export const getPurchaseIssues = (item: Omit<PurchaseItem, "issues">): readonly PurchaseIssue[] => {
  const issues: PurchaseIssue[] = [];
  if (item.name.trim() === "") issues.push("missingName");
  if (item.quantity !== null && (!Number.isFinite(item.quantity) || item.quantity <= 0)) issues.push("invalidQuantity");
  if (item.unitPrice !== null && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0)) issues.push("invalidUnitPrice");
  if (item.quantity !== null && item.unitPrice !== null && item.importedAmount !== null && Math.abs(Math.round(item.quantity * item.unitPrice) - item.importedAmount) >= 1) issues.push("amountMismatch");
  return issues;
};

export const withPurchaseIssues = (item: Omit<PurchaseItem, "issues">): PurchaseItem => ({ ...item, issues: getPurchaseIssues(item) });
export const selectedPurchaseTotal = (items: readonly PurchaseItem[]): number => items.filter((item) => item.selected).reduce((sum, item) => sum + (resolvePurchaseAmount(item) ?? 0), 0);

export const normalizePurchaseOutputColumns = (value: unknown): readonly PurchaseOutputColumnId[] => {
  if (!Array.isArray(value)) return defaultPurchaseOutputColumns;
  const result = value.filter((entry, index): entry is PurchaseOutputColumnId => typeof entry === "string" && purchaseOutputColumnIds.includes(entry as PurchaseOutputColumnId) && value.indexOf(entry) === index);
  if (!result.includes("name")) result.splice(Math.min(1, result.length), 0, "name");
  return result.length === 0 ? defaultPurchaseOutputColumns : result;
};

export const createEmptyPurchaseItem = (id: string): PurchaseItem => withPurchaseIssues({ id, selected: true, name: "", specification: "", quantity: null, unitPrice: null, importedAmount: null, vendor: "", note: "", budgetItem: "", sourceName: null });
