import { purchaseImportFieldIds, type PurchaseColumnMapping, type PurchaseHeaderOption, type PurchaseImportFieldId, type PurchaseRecognitionConfidence } from "./types";

export const purchaseConfidenceLabels: Readonly<Record<PurchaseRecognitionConfidence, string>> = {
  automatic: "자동 인식 가능", review: "확인 권장", manual: "직접 지정 필요",
};
export type PurchaseMappingDraft = {
  readonly mapping: PurchaseColumnMapping;
  readonly touched: readonly PurchaseImportFieldId[];
  readonly revision: number;
};
export const createPurchaseMappingDraft = (option: PurchaseHeaderOption): PurchaseMappingDraft => ({
  mapping: { ...option.recommendation?.mapping }, touched: [], revision: 0,
});
export const editPurchaseMappingDraft = (draft: PurchaseMappingDraft, field: PurchaseImportFieldId, index: number | undefined): PurchaseMappingDraft => {
  const mapping = { ...draft.mapping };
  if (index === undefined) delete mapping[field];
  else mapping[field] = index;
  return { mapping, touched: draft.touched.includes(field) ? draft.touched : [...draft.touched, field], revision: draft.revision + 1 };
};
export const reapplyPurchaseMappingRecommendation = (draft: PurchaseMappingDraft, option: PurchaseHeaderOption): PurchaseMappingDraft => {
  const mapping = { ...draft.mapping };
  for (const field of purchaseImportFieldIds) {
    if (draft.touched.includes(field)) continue;
    const index = option.recommendation?.mapping[field];
    if (index === undefined) delete mapping[field];
    else mapping[field] = index;
  }
  return { ...draft, mapping, revision: draft.revision + 1 };
};
export const getPurchaseMappingErrors = (mapping: PurchaseColumnMapping, columnCount: number): readonly string[] => {
  const errors: string[] = [];
  if (mapping.name === undefined) errors.push("품명에 연결할 원본 열을 선택해 주세요.");
  const used = new Set<number>();
  for (const field of purchaseImportFieldIds) {
    const index = mapping[field];
    if (index === undefined) continue;
    if (!Number.isInteger(index) || index < 0 || index >= columnCount) errors.push("원본에 없는 열이 연결되어 있습니다. 다시 선택해 주세요.");
    if (used.has(index)) errors.push("같은 원본 열을 여러 항목에 연결할 수 없습니다.");
    used.add(index);
  }
  return [...new Set(errors)];
};
export const describePurchaseSourceColumn = (headers: readonly string[], index: number | undefined): string =>
  index === undefined ? "연결 안 함" : `${index + 1}열 · ${headers[index] || "이름 없는 열"}`;

export const purchaseRecognitionText = (text: string): string => /[가-힣]/u.test(text) ? text : "원본 내용을 확인해 주세요.";
