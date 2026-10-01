import { defaultPurchaseOutputColumns, type PurchaseOutputColumnId } from "./types";
import { normalizePurchaseOutputColumns } from "./purchaseDomain";

const KEY = "school-health-desk.purchase-output-columns";
export const loadPurchaseOutputColumns = (): readonly PurchaseOutputColumnId[] => {
  try { return normalizePurchaseOutputColumns(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return defaultPurchaseOutputColumns; }
};
export const savePurchaseOutputColumns = (columns: readonly PurchaseOutputColumnId[]): void => localStorage.setItem(KEY, JSON.stringify(normalizePurchaseOutputColumns(columns)));
