import { ClipboardCopy, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calculatePurchaseSettlementSummary,
  createPurchaseSettlementClipboard,
  createPurchaseSettlementExportRows,
  createPurchaseSettlementSummaryText,
  getPurchaseSettlementWarnings,
  getSettlementItemWarnings,
  purchaseSettlementStatusLabels,
  resolveSettlementItemAmount,
  updatePurchaseSettlementItem,
  updatePurchaseSettlementOrder,
} from "../../purchase/purchaseSettlement";
import { resolvePurchaseAmount } from "../../purchase/purchaseDomain";
import { purchaseRepository } from "../../purchase/purchaseRepository";
import { purchaseSettlementStatuses, type PurchaseItem, type PurchaseSettlement, type PurchaseSettlementItem, type PurchaseSettlementStatus } from "../../purchase/types";

type Props = {
  readonly items: readonly PurchaseItem[];
  readonly outputReady: boolean;
  readonly settlement: PurchaseSettlement;
  readonly onChange: (settlement: PurchaseSettlement) => void;
  readonly onNotice: (message: string) => void;
};

const numberValue = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const settlementStatusValue = (value: string): PurchaseSettlementStatus => {
  switch (value) {
    case "pending": return "pending";
    case "purchased": return "purchased";
    case "partial": return "partial";
    case "cancelled": return "cancelled";
    default: return "pending";
  }
};
const formatMoney = (value: number): string => `${value.toLocaleString("ko-KR")}원`;

const writeClipboard = async (content: { readonly text: string; readonly html: string }): Promise<void> => {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write !== undefined) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/plain": new Blob([content.text], { type: "text/plain" }),
      "text/html": new Blob([content.html], { type: "text/html" }),
    })]);
    return;
  }
  await navigator.clipboard.writeText(content.text);
};

export function PurchaseSettlementEditor({ items, outputReady, settlement, onChange, onNotice }: Props) {
  const [busy, setBusy] = useState(false);
  const selected = items.filter((item) => item.selected);
  const actualById = useMemo(() => new Map(settlement.items.map((item) => [item.purchaseItemId, item])), [settlement.items]);
  const summary = useMemo(() => calculatePurchaseSettlementSummary(items, settlement), [items, settlement]);
  const warnings = useMemo(() => getPurchaseSettlementWarnings(items, settlement), [items, settlement]);
  const updateItem = (purchaseItemId: string, patch: Partial<Omit<PurchaseSettlementItem, "purchaseItemId">>): void => {
    onChange(updatePurchaseSettlementItem(settlement, purchaseItemId, patch));
  };
  const copyTable = async (): Promise<void> => {
    if (!outputReady) { onNotice("입력 오류와 금액 불일치를 먼저 확인해 주세요."); return; }
    try {
      await writeClipboard(createPurchaseSettlementClipboard(items, settlement));
      onNotice("구매결과 표를 복사했습니다.");
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
      onNotice("구매결과 표를 복사하지 못했습니다.");
    }
  };
  const copySummary = async (): Promise<void> => {
    if (!outputReady) { onNotice("입력 오류와 금액 불일치를 먼저 확인해 주세요."); return; }
    try {
      await navigator.clipboard.writeText(createPurchaseSettlementSummaryText(summary));
      onNotice("정산 요약을 복사했습니다.");
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
      onNotice("정산 요약을 복사하지 못했습니다.");
    }
  };
  const exportXlsx = async (): Promise<void> => {
    if (!outputReady) { onNotice("입력 오류와 금액 불일치를 먼저 확인해 주세요."); return; }
    setBusy(true);
    try {
      if (await purchaseRepository.exportSettlement(createPurchaseSettlementExportRows(items, settlement), summary)) onNotice("구매결과 XLSX 파일을 저장했습니다.");
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
      onNotice("구매결과 파일을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const differenceLabel = summary.difference === 0 ? "차액 없음" : summary.difference < 0 ? `${formatMoney(Math.abs(summary.difference))} 절감` : `${formatMoney(summary.difference)} 초과`;
  return (
    <div className="purchase-settlement-editor">
      <section className="purchase-settlement-summary" aria-label="구매 정산 요약">
        <div><span>품의금액</span><strong>{formatMoney(summary.plannedTotal)}</strong></div>
        <div><span>상품 실제금액</span><strong>{formatMoney(summary.actualSubtotal)}</strong></div>
        <div><span>최종 결제예상액</span><strong>{formatMoney(summary.finalActual)}</strong></div>
        <div className={summary.difference > 0 ? "is-warning" : ""}><span>품의금액 대비</span><strong>{differenceLabel}</strong></div>
      </section>
      <section className="purchase-settlement-adjustments" aria-label="주문 단위 조정">
        <label>배송비<input aria-label="배송비" inputMode="numeric" value={settlement.shippingFee} onChange={(event) => onChange(updatePurchaseSettlementOrder(settlement, { shippingFee: Math.max(0, numberValue(event.target.value) ?? 0) }))} /></label>
        <label>할인 금액<input aria-label="할인 금액" inputMode="numeric" value={settlement.discountAmount} onChange={(event) => onChange(updatePurchaseSettlementOrder(settlement, { discountAmount: Math.max(0, numberValue(event.target.value) ?? 0) }))} /></label>
        <label>조정 메모<input aria-label="조정 메모" value={settlement.adjustmentNote} onChange={(event) => onChange(updatePurchaseSettlementOrder(settlement, { adjustmentNote: event.target.value }))} /></label>
      </section>
      {warnings.length > 0 && <div className="purchase-settlement-warnings" role="status">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
      <div className="purchase-settlement-table-wrap">
        <table className="purchase-settlement-table"><thead><tr><th>상태</th><th>품명</th><th>품의수량</th><th>실제수량</th><th>품의단가</th><th>실제단가</th><th>품의금액</th><th>실제금액</th><th>차액</th><th>비고</th></tr></thead><tbody>
          {selected.length === 0 ? <tr><td colSpan={10} className="purchase-helper-empty">선택한 품목이 없습니다.</td></tr> : selected.map((planned, index) => {
            const actual = actualById.get(planned.id);
            if (actual === undefined) return null;
            const plannedAmount = resolvePurchaseAmount(planned);
            const actualAmount = resolveSettlementItemAmount(actual);
            const difference = plannedAmount === null || actualAmount === null ? null : actualAmount - plannedAmount;
            const itemWarnings = getSettlementItemWarnings(planned, actual);
            return <tr key={planned.id} className={itemWarnings.length > 0 ? "has-issue" : ""}>
              <td><select aria-label={`${index + 1}행 구매 상태`} value={actual.status} onChange={(event) => updateItem(planned.id, { status: settlementStatusValue(event.target.value) })}>{purchaseSettlementStatuses.map((status) => <option key={status} value={status}>{purchaseSettlementStatusLabels[status]}</option>)}</select></td>
              <td><strong>{planned.name}</strong>{itemWarnings.length > 0 && <small title={itemWarnings.join(" ")}>{itemWarnings.join(" · ")}</small>}</td>
              <td>{planned.quantity ?? "-"}</td>
              <td><input aria-label={`${index + 1}행 실제 수량`} inputMode="decimal" value={actual.actualQuantity ?? ""} onChange={(event) => updateItem(planned.id, { actualQuantity: numberValue(event.target.value) })} /></td>
              <td>{planned.unitPrice?.toLocaleString("ko-KR") ?? "-"}</td>
              <td><input aria-label={`${index + 1}행 실제 단가`} inputMode="decimal" value={actual.actualUnitPrice ?? ""} onChange={(event) => updateItem(planned.id, { actualUnitPrice: numberValue(event.target.value) })} />{planned.unitPrice !== null && actual.actualUnitPrice !== null && actual.actualUnitPrice !== planned.unitPrice && <small className={actual.actualUnitPrice > planned.unitPrice ? "is-up" : "is-down"}>{actual.actualUnitPrice - planned.unitPrice > 0 ? "+" : ""}{(actual.actualUnitPrice - planned.unitPrice).toLocaleString("ko-KR")}</small>}</td>
              <td>{plannedAmount?.toLocaleString("ko-KR") ?? "-"}</td><td>{actualAmount?.toLocaleString("ko-KR") ?? "-"}</td>
              <td className={difference !== null && difference > 0 ? "is-up" : "is-down"}>{difference === null ? "-" : `${difference > 0 ? "+" : ""}${difference.toLocaleString("ko-KR")}`}</td>
              <td><input aria-label={`${index + 1}행 구매 비고`} value={actual.note} onChange={(event) => updateItem(planned.id, { note: event.target.value })} /></td>
            </tr>;
          })}
        </tbody></table>
      </div>
      <footer className="purchase-settlement-actions"><p>실제 구매 수량·금액은 현재 실행 중에만 유지됩니다.</p><div><button type="button" disabled={selected.length === 0 || !outputReady} onClick={() => void copyTable()}><ClipboardCopy size={14} /> 구매결과 표 복사</button><button type="button" disabled={selected.length === 0 || !outputReady} onClick={() => void copySummary()}><ClipboardCopy size={14} /> 정산 요약 복사</button><button type="button" disabled={selected.length === 0 || busy || !outputReady} onClick={() => void exportXlsx()}><FileSpreadsheet size={14} /> 구매결과 XLSX</button></div></footer>
    </div>
  );
}
