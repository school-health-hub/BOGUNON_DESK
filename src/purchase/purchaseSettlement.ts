import { resolvePurchaseAmount, selectedPurchaseTotal } from "./purchaseDomain";
import type {
  PurchaseItem,
  PurchaseSettlement,
  PurchaseSettlementExportRow,
  PurchaseSettlementItem,
  PurchaseSettlementSummary,
  PurchaseSettlementStatus,
} from "./types";

export const purchaseSettlementStatusLabels: Readonly<Record<PurchaseSettlementStatus, string>> = {
  pending: "구매대기",
  purchased: "구매완료",
  partial: "일부구매",
  cancelled: "취소",
};

const createSettlementItem = (item: PurchaseItem): PurchaseSettlementItem => ({
  purchaseItemId: item.id,
  status: "purchased",
  actualQuantity: item.quantity,
  actualUnitPrice: item.unitPrice,
  note: "",
});

export const createPurchaseSettlement = (items: readonly PurchaseItem[]): PurchaseSettlement => ({
  items: items.filter((item) => item.selected).map(createSettlementItem),
  shippingFee: 0,
  discountAmount: 0,
  adjustmentNote: "",
});

export const reconcilePurchaseSettlement = (
  settlement: PurchaseSettlement,
  items: readonly PurchaseItem[],
): PurchaseSettlement => {
  const known = new Set(settlement.items.map((item) => item.purchaseItemId));
  const added = items.filter((item) => item.selected && !known.has(item.id)).map(createSettlementItem);
  return added.length === 0 ? settlement : { ...settlement, items: [...settlement.items, ...added] };
};

export const updatePurchaseSettlementItem = (
  settlement: PurchaseSettlement,
  purchaseItemId: string,
  patch: Partial<Omit<PurchaseSettlementItem, "purchaseItemId">>,
): PurchaseSettlement => ({
  ...settlement,
  items: settlement.items.map((item) => item.purchaseItemId === purchaseItemId ? { ...item, ...patch } : item),
});

export const updatePurchaseSettlementOrder = (
  settlement: PurchaseSettlement,
  patch: Partial<Pick<PurchaseSettlement, "shippingFee" | "discountAmount" | "adjustmentNote">>,
): PurchaseSettlement => ({ ...settlement, ...patch });

export const resolveSettlementItemAmount = (item: PurchaseSettlementItem): number | null => {
  if (item.status === "pending" || item.status === "cancelled") return null;
  if (item.actualQuantity === null || item.actualUnitPrice === null) return null;
  if (!Number.isFinite(item.actualQuantity) || !Number.isFinite(item.actualUnitPrice)) return null;
  return Math.round(item.actualQuantity * item.actualUnitPrice);
};

export const calculatePurchaseSettlementSummary = (
  items: readonly PurchaseItem[],
  settlement: PurchaseSettlement,
): PurchaseSettlementSummary => {
  const selectedIds = new Set(items.filter((item) => item.selected).map((item) => item.id));
  const actualSubtotal = settlement.items
    .filter((item) => selectedIds.has(item.purchaseItemId))
    .reduce((sum, item) => sum + (resolveSettlementItemAmount(item) ?? 0), 0);
  const shippingFee = Number.isFinite(settlement.shippingFee) ? Math.max(0, settlement.shippingFee) : 0;
  const discountAmount = Number.isFinite(settlement.discountAmount) ? Math.max(0, settlement.discountAmount) : 0;
  const finalActual = Math.round(actualSubtotal + shippingFee - discountAmount);
  const plannedTotal = selectedPurchaseTotal(items);
  return { plannedTotal, actualSubtotal, shippingFee, discountAmount, finalActual, difference: finalActual - plannedTotal };
};

export const getSettlementItemWarnings = (
  planned: PurchaseItem,
  actual: PurchaseSettlementItem,
): readonly string[] => {
  const warnings: string[] = [];
  if (actual.status === "purchased" || actual.status === "partial") {
    if (actual.actualQuantity === null || !Number.isFinite(actual.actualQuantity) || actual.actualQuantity <= 0) warnings.push("실제 수량을 확인해 주세요.");
    if (actual.actualUnitPrice === null || !Number.isFinite(actual.actualUnitPrice) || actual.actualUnitPrice < 0) warnings.push("실제 단가를 확인해 주세요.");
    if (actual.actualQuantity !== null && planned.quantity !== null && actual.actualQuantity > planned.quantity) warnings.push("품의 수량보다 실제 수량이 많습니다.");
  }
  return warnings;
};

export const getPurchaseSettlementWarnings = (
  items: readonly PurchaseItem[],
  settlement: PurchaseSettlement,
): readonly string[] => {
  const selectedItems = items.filter((item) => item.selected);
  const byId = new Map(selectedItems.map((item) => [item.id, item]));
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const warnings = settlement.items.filter((actual) => selectedIds.has(actual.purchaseItemId)).flatMap((actual) => {
    const planned = byId.get(actual.purchaseItemId);
    return planned === undefined ? [] : getSettlementItemWarnings(planned, actual);
  });
  const summary = calculatePurchaseSettlementSummary(items, settlement);
  if (summary.finalActual < 0) warnings.push("최종 결제금액이 0원보다 작습니다.");
  if (summary.difference > 0) warnings.push(`품의금액보다 ${summary.difference.toLocaleString("ko-KR")}원 많습니다.`);
  return [...new Set(warnings)];
};

export const createPurchaseSettlementExportRows = (
  items: readonly PurchaseItem[],
  settlement: PurchaseSettlement,
): readonly PurchaseSettlementExportRow[] => {
  const actualById = new Map(settlement.items.map((item) => [item.purchaseItemId, item]));
  return items.filter((item) => item.selected).map((planned, index) => {
    const actual = actualById.get(planned.id) ?? createSettlementItem(planned);
    const plannedAmount = resolvePurchaseAmount(planned);
    const actualAmount = resolveSettlementItemAmount(actual);
    return {
      number: index + 1,
      name: planned.name,
      plannedQuantity: planned.quantity,
      actualQuantity: actual.actualQuantity,
      plannedUnitPrice: planned.unitPrice,
      actualUnitPrice: actual.actualUnitPrice,
      plannedAmount,
      actualAmount,
      difference: plannedAmount === null || actualAmount === null ? null : actualAmount - plannedAmount,
      status: purchaseSettlementStatusLabels[actual.status],
      note: actual.note,
    };
  });
};

const cleanTsv = (value: string): string => value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const settlementHeaders = ["품명", "품의수량", "실제수량", "품의단가", "실제단가", "실제금액", "비고"] as const;

export const createPurchaseSettlementClipboard = (
  items: readonly PurchaseItem[],
  settlement: PurchaseSettlement,
): { readonly text: string; readonly html: string } => {
  const rows = createPurchaseSettlementExportRows(items, settlement).map((row) => [row.name, row.plannedQuantity ?? "", row.actualQuantity ?? "", row.plannedUnitPrice ?? "", row.actualUnitPrice ?? "", row.actualAmount ?? "", row.note].map(String));
  return {
    text: [settlementHeaders, ...rows].map((row) => row.map(cleanTsv).join("\t")).join("\n"),
    html: `<table><thead><tr>${settlementHeaders.map((value) => `<th>${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  };
};

export const createPurchaseSettlementSummaryText = (summary: PurchaseSettlementSummary): string => [
  `품의금액: ${summary.plannedTotal.toLocaleString("ko-KR")}원`,
  `상품 실제금액: ${summary.actualSubtotal.toLocaleString("ko-KR")}원`,
  `배송비: ${summary.shippingFee.toLocaleString("ko-KR")}원`,
  `할인: ${summary.discountAmount.toLocaleString("ko-KR")}원`,
  `최종 결제금액: ${summary.finalActual.toLocaleString("ko-KR")}원`,
  `품의금액 대비: ${summary.difference > 0 ? "+" : ""}${summary.difference.toLocaleString("ko-KR")}원`,
].join("\n");
