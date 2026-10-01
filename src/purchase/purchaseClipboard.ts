import { purchaseOutputColumnLabels, type PurchaseItem, type PurchaseOutputColumnId } from "./types";
import { resolvePurchaseAmount } from "./purchaseDomain";

const valueFor = (item: PurchaseItem, column: PurchaseOutputColumnId, index: number): string | number => {
  if (column === "number") return index + 1;
  if (column === "amount") return resolvePurchaseAmount(item) ?? "";
  return item[column] ?? "";
};
const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cleanTsv = (value: string): string => value.replace(/\t/g, " ").replace(/\r?\n/g, " ");

export const createPurchaseClipboard = (items: readonly PurchaseItem[], columns: readonly PurchaseOutputColumnId[]) => {
  const selected = items.filter((item) => item.selected);
  const rows = selected.map((item, index) => columns.map((column) => String(valueFor(item, column, index))));
  const header = columns.map((column) => purchaseOutputColumnLabels[column]);
  return {
    text: [header, ...rows].map((row) => row.map(cleanTsv).join("\t")).join("\n"),
    html: `<table><thead><tr>${header.map((value) => `<th>${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  };
};
