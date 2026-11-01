import { getPurchaseOutputReadiness } from "./purchaseDomain";
import { calculatePurchaseSettlementDisplaySummary } from "./purchaseSettlement";
import type { PurchaseItem, PurchaseOutputColumnId, PurchaseSettlement } from "./types";

export type PreviewTable = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly (string | number | null)[])[];
};
export type PurchaseOutputPreviewKind = "clipboard" | "csv" | "xlsx" | "edufine" | "settlement-clipboard" | "settlement-summary" | "settlement-xlsx";
export type PurchaseOutputPreviewSnapshot = {
  readonly kind: PurchaseOutputPreviewKind;
  readonly table: PreviewTable;
  readonly key: string;
  readonly selectedCount: number;
  readonly hiddenCount: number;
  readonly plannedTotal: number;
  readonly guidance: readonly { readonly name: string; readonly value: string }[];
  readonly blocked: readonly string[];
};
export const purchaseOutputPreviewLabels: Readonly<Record<PurchaseOutputPreviewKind, string>> = {
  clipboard: "품의 표 복사", csv: "품의 CSV", xlsx: "품의 XLSX", edufine: "에듀파인 XLSX",
  "settlement-clipboard": "구매결과 표 복사", "settlement-summary": "정산 요약 복사", "settlement-xlsx": "구매결과 XLSX",
};
export const createPreviewContextKey = (
  items: readonly PurchaseItem[],
  columns: readonly PurchaseOutputColumnId[],
  settlement: PurchaseSettlement | null = null,
  dataRevision?: number,
): string => JSON.stringify({ items, columns, settlement, dataRevision });

export const previewBlockReasons = (
  items: readonly PurchaseItem[],
  settlement?: PurchaseSettlement,
  settlementOutput = false,
): readonly string[] => {
  const reasons: string[] = [];
  const readiness = getPurchaseOutputReadiness(items);
  if (!items.some((item) => item.selected)) reasons.push("출력할 품목을 선택해 주세요.");
  if (readiness.blockingCount > 0) reasons.push(`선택 품목 ${readiness.blockingCount}건의 입력 오류를 확인해 주세요.`);
  if (readiness.unreviewedMismatchCount > 0) reasons.push(`금액 불일치 ${readiness.unreviewedMismatchCount}건을 확인해 주세요.`);
  if (settlementOutput && settlement && !calculatePurchaseSettlementDisplaySummary(items, settlement).legacyOutputSafe) {
    reasons.push("별도 부가세가 기존 정산 출력에 반영되지 않아 출력할 수 없습니다.");
  }
  return reasons;
};
