export const purchaseOutputColumnIds = ["number", "name", "specification", "quantity", "unitPrice", "amount", "vendor", "note", "budgetItem"] as const;
export type PurchaseOutputColumnId = (typeof purchaseOutputColumnIds)[number];
export const purchaseImportFieldIds = ["name", "specification", "quantity", "unitPrice", "amount", "vendor", "note", "budgetItem"] as const;
export type PurchaseImportFieldId = (typeof purchaseImportFieldIds)[number];
export const purchaseImportFieldLabels: Readonly<Record<PurchaseImportFieldId, string>> = {
  name: "품명", specification: "규격", quantity: "수량", unitPrice: "단가", amount: "금액", vendor: "구매처", note: "비고", budgetItem: "예산항목",
};
export type PurchaseColumnMapping = Readonly<Partial<Record<PurchaseImportFieldId, number>>>;
export type PurchaseImportTemplate = { readonly id: string; readonly name: string; readonly headerSignature: readonly string[]; readonly mapping: PurchaseColumnMapping };
export const purchaseDraftDetailFieldIds = ["summary", "amount", "vendor", "budgetItem"] as const;
export type PurchaseDraftDetailFieldId = (typeof purchaseDraftDetailFieldIds)[number];
export type PurchaseDraftTemplate = {
  readonly id: string;
  readonly name: string;
  readonly titlePattern: string;
  readonly introPattern: string;
  readonly detailFieldOrder: readonly PurchaseDraftDetailFieldId[];
  readonly attachmentPhrase: string;
  readonly includeAttachment: boolean;
};
export type PurchaseDraft = {
  readonly title: string;
  readonly purpose: string;
  readonly purchaseSummary: string;
  readonly vendor: string;
  readonly budgetItem: string;
  readonly note: string;
  readonly includeAttachment: boolean;
  readonly templateId: string;
  readonly titlePattern: string;
  readonly introPattern: string;
  readonly detailFieldOrder: readonly PurchaseDraftDetailFieldId[];
  readonly attachmentPhrase: string;
};

export const purchaseSettlementStatuses = ["pending", "purchased", "partial", "cancelled"] as const;
export type PurchaseSettlementStatus = (typeof purchaseSettlementStatuses)[number];
export type PurchaseSettlementItem = {
  readonly purchaseItemId: string;
  readonly status: PurchaseSettlementStatus;
  readonly actualQuantity: number | null;
  readonly actualUnitPrice: number | null;
  readonly note: string;
};
export type PurchaseSettlement = {
  readonly items: readonly PurchaseSettlementItem[];
  readonly shippingFee: number;
  readonly discountAmount: number;
  readonly adjustmentNote: string;
};
export type PurchaseSettlementSummary = {
  readonly plannedTotal: number;
  readonly actualSubtotal: number;
  readonly shippingFee: number;
  readonly discountAmount: number;
  readonly finalActual: number;
  readonly difference: number;
};
export type PurchaseSettlementExportRow = {
  readonly number: number;
  readonly name: string;
  readonly plannedQuantity: number | null;
  readonly actualQuantity: number | null;
  readonly plannedUnitPrice: number | null;
  readonly actualUnitPrice: number | null;
  readonly plannedAmount: number | null;
  readonly actualAmount: number | null;
  readonly difference: number | null;
  readonly status: string;
  readonly note: string;
};
export type PurchaseHeaderOption = { readonly rowIndex: number; readonly headers: readonly string[]; readonly signature: readonly string[]; readonly recommended: boolean };
export type PurchaseMappingCandidate = { readonly id: string; readonly sourceName: string; readonly sheetName: string; readonly rows: readonly (readonly string[])[]; readonly headerOptions: readonly PurchaseHeaderOption[] };

export const defaultPurchaseOutputColumns: readonly PurchaseOutputColumnId[] = ["number", "name", "specification", "quantity", "unitPrice", "amount", "note"];

export const purchaseOutputColumnLabels: Readonly<Record<PurchaseOutputColumnId, string>> = {
  number: "번호", name: "품명", specification: "규격", quantity: "수량", unitPrice: "단가", amount: "금액", vendor: "구매처", note: "비고", budgetItem: "예산항목",
};

export type PurchaseIssue = "missingName" | "invalidQuantity" | "invalidUnitPrice" | "amountMismatch";

export type PurchaseItem = {
  readonly id: string;
  readonly selected: boolean;
  readonly name: string;
  readonly specification: string;
  readonly quantity: number | null;
  readonly unitPrice: number | null;
  readonly importedAmount: number | null;
  readonly vendor: string;
  readonly note: string;
  readonly budgetItem: string;
  readonly sourceName: string | null;
  readonly issues: readonly PurchaseIssue[];
  readonly amountMismatchReviewed: boolean;
};

export type PurchaseOutputReadiness = {
  readonly ready: boolean;
  readonly blockingCount: number;
  readonly unreviewedMismatchCount: number;
};

export type PurchaseSourceSummary = { readonly sourceName: string; readonly status: "success" | "needsMapping" | "unsupported" | "error"; readonly rowCount: number; readonly message: string | null; readonly candidateId?: string };
export type PurchaseAnalysisResult = { readonly items: readonly PurchaseItem[]; readonly sources: readonly PurchaseSourceSummary[]; readonly candidates: readonly PurchaseMappingCandidate[] };
export type PurchaseAnalysisRequestResult = { readonly generation: number; readonly started: boolean };
export type PurchaseAnalysisEvent = { readonly generation: number; readonly result: PurchaseAnalysisResult };
export type PurchaseAnalysisErrorEvent = { readonly generation: number; readonly message: string };
