import type { PurchaseItem } from "../purchase/types";

export const purchaseBatchStatuses = ["DRAFT", "APPROVED", "ORDERED", "AWAITING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;
export type InventoryPurchaseBatchStatus = typeof purchaseBatchStatuses[number];

export type InventoryPurchaseLineSnapshot = {
  readonly schoolId: string;
  readonly lineId: string;
  readonly itemId: string;
  readonly candidateId: string;
  readonly itemName: string;
  readonly specification: string;
  readonly baseUnit: string;
  readonly purchaseUnit: string;
  readonly baseUnitsPerPurchaseUnit: string;
  readonly requestedPurchaseQuantity: string;
  readonly receivedBaseQuantity: string;
  readonly expectedUnitPrice: string | null;
};

export type InventoryPurchaseBatchSnapshot = {
  readonly schoolId: string;
  readonly batchId: string;
  readonly status: InventoryPurchaseBatchStatus;
  readonly lines: readonly InventoryPurchaseLineSnapshot[];
};

export type PurchaseHelperLineage = {
  readonly helperRowId: string;
  readonly schoolId: string;
  readonly batchId: string;
  readonly lineId: string;
  readonly itemId: string;
  readonly candidateId: string;
  readonly baseUnit: string;
  readonly purchaseUnit: string;
  readonly baseUnitsPerPurchaseUnit: string;
  readonly requestedPurchaseQuantity: string;
  readonly requestedBaseQuantity: string;
  readonly expectedUnitPrice: string | null;
  readonly originalName: string;
  readonly originalSpecification: string;
};

export type PurchaseHelperAdapterSession = {
  readonly sessionId: string;
  readonly schoolId: string;
  readonly batchId: string;
  readonly serverSnapshot: InventoryPurchaseBatchSnapshot;
  readonly helperItems: readonly PurchaseItem[];
  readonly lineage: readonly PurchaseHelperLineage[];
  readonly stockEffect: "NONE";
  readonly receiptCommand: null;
  readonly recovery: {
    readonly serverBatch: "RECOVERABLE";
    readonly unsavedHelperEdits: "NOT_RECOVERABLE";
    readonly downloadedFiles: "EXTERNAL_ONLY";
    readonly confirmedReceipts: "SERVER_RECORDED";
  };
};

export type AdapterIssueCode = "AMBIGUOUS_IDENTITY_EDIT" | "AMBIGUOUS_QUANTITY" | "CROSS_SCHOOL" | "DUPLICATE_HELPER_ROW" | "DUPLICATE_LINE" | "INVALID_DECIMAL" | "INVALID_PRICE" | "INVALID_TEXT" | "LOSSY_HELPER_NUMBER" | "NON_INTEGER_BASE_QUANTITY";
export type AdapterIssue = { readonly code: AdapterIssueCode; readonly field: string; readonly lineId: string | null };
export type ProjectionResult = { readonly kind: "ready"; readonly session: PurchaseHelperAdapterSession } | { readonly kind: "rejected"; readonly issues: readonly AdapterIssue[] };
export type MatchedPurchaseLine = { readonly helperRowId: string; readonly lineId: string; readonly itemId: string };
export type ChangedPurchaseLine = MatchedPurchaseLine & { readonly requestedPurchaseQuantity: string; readonly expectedUnitPrice: string | null; readonly name: string; readonly specification: string };
export type MissingPurchaseLine = { readonly lineId: string; readonly reason: "ROW_REMOVED" | "ROW_DESELECTED" };
export type AddedPurchaseLine = { readonly helperRowId: string; readonly reason: "UNKNOWN_HELPER_ROW" };
export type ReconciliationResult = {
  readonly kind: "ready" | "review_required" | "rejected";
  readonly matched: readonly MatchedPurchaseLine[];
  readonly changed: readonly ChangedPurchaseLine[];
  readonly missing: readonly MissingPurchaseLine[];
  readonly added: readonly AddedPurchaseLine[];
  readonly issues: readonly AdapterIssue[];
  readonly stockEffect: "NONE";
  readonly receiptCommand: null;
};
export type ReconciliationInput = { readonly session: PurchaseHelperAdapterSession; readonly helperItems: readonly PurchaseItem[]; readonly activeSchoolId: string };
