export const inventoryLotStatuses = ["available", "quarantined", "unavailable", "depleted"] as const;
export type InventoryLotStatus = (typeof inventoryLotStatuses)[number];

export const inventoryDisplayStatuses = ["all", "normal", "low_stock", "expiring", "expired"] as const;
export type InventoryDisplayStatus = (typeof inventoryDisplayStatuses)[number];

export type InventoryLotView = {
  readonly lotId: string;
  readonly receivedOn: string;
  readonly expiresOn: string | null;
  readonly remainingQuantity: number;
  readonly status: InventoryLotStatus;
};

export type InventoryHistoryView = {
  readonly movementId: string;
  readonly type: "INITIAL_BALANCE" | "RECEIVE" | "USE" | "DISPOSE" | "ADJUST" | "REVERSAL";
  readonly quantityDelta: number;
  readonly occurredAt: string;
  readonly description: string;
};

export type InventoryItemView = {
  readonly itemId: string;
  readonly schoolId: string;
  readonly name: string;
  readonly category: string;
  readonly specification: string;
  readonly baseUnit: string;
  readonly purchaseUnit: string;
  readonly baseUnitsPerPurchaseUnit: number;
  readonly recommendedStock: number;
  readonly minimumStock: number;
  readonly isActive: boolean;
  readonly isSynthetic: true;
  readonly lots: readonly InventoryLotView[];
  readonly recentHistory: readonly InventoryHistoryView[];
};

export type InventoryStockTotals = {
  readonly totalQuantity: number;
  readonly availableQuantity: number;
};

export type InventorySummary = {
  readonly totalItems: number;
  readonly lowStockItems: number;
  readonly expiringItems: number;
  readonly expiredItems: number;
};

export type InventoryWorkspaceReadResult = {
  readonly mode: "synthetic";
  readonly referenceDate: string;
  readonly items: readonly InventoryItemView[];
};

export type InventoryMutationDraft =
  | { readonly kind: "register_item"; readonly name: string; readonly category: string; readonly specification: string; readonly baseUnit: string; readonly purchaseUnit: string; readonly baseUnitsPerPurchaseUnit: number; readonly recommendedStock: number; readonly minimumStock: number }
  | { readonly kind: "receive"; readonly itemId: string; readonly purchaseQuantity: number; readonly baseUnitsPerPurchaseUnit: number; readonly receivedOn: string; readonly expiresOn: string | null }
  | { readonly kind: "use"; readonly itemId: string; readonly quantity: number; readonly note: string }
  | { readonly kind: "dispose"; readonly itemId: string; readonly lotId: string; readonly quantity: number; readonly reason: string }
  | { readonly kind: "adjust"; readonly itemId: string; readonly lotId: string; readonly confirmedQuantity: number; readonly reason: string }
  | { readonly kind: "purchase_candidate"; readonly itemId: string; readonly purchaseQuantity: number; readonly estimatedUnitPrice: number };

export type InventoryMutationPreviewResult =
  | { readonly kind: "preview_only"; readonly persisted: false; readonly operation: InventoryMutationDraft["kind"]; readonly message: string }
  | {
    readonly kind: "unavailable";
    readonly persisted: false;
    readonly code: "INVALID_QUANTITY" | "INVALID_TEXT" | "ITEM_NOT_FOUND" | "LOT_NOT_FOUND" | "QUANTITY_OVERFLOW" | "PREVIEW_ONLY";
    readonly message: string;
  };

export interface InventoryUiAdapter {
  loadWorkspace(): Promise<InventoryWorkspaceReadResult>;
  previewMutation(draft: InventoryMutationDraft): Promise<InventoryMutationPreviewResult>;
}
