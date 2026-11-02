import type {
  InventoryMutationDraft,
  InventoryMutationPreviewResult,
  InventoryUiAdapter,
  InventoryWorkspaceReadResult,
} from "./inventoryTypes";
import { syntheticInventoryItems, syntheticInventoryReferenceDate } from "./syntheticFixtures";
import { getInventoryStockTotals } from "./inventorySelectors";

const unavailable = (
  code: Extract<InventoryMutationPreviewResult, { readonly kind: "unavailable" }>["code"],
  message: string,
): InventoryMutationPreviewResult => ({ kind: "unavailable", persisted: false, code, message });

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const hasText = (value: string): boolean => value.trim().length > 0;
const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const findItem = (itemId: string) => syntheticInventoryItems.find((item) => item.itemId === itemId);
const itemExists = (itemId: string): boolean => hasText(itemId) && syntheticInventoryItems.some((item) => item.itemId === itemId);
const lotBelongsToItem = (itemId: string, lotId: string): boolean => syntheticInventoryItems.some(
  (item) => item.itemId === itemId && item.lots.some((lot) => lot.lotId === lotId),
);

const validateDraft = (draft: InventoryMutationDraft): InventoryMutationPreviewResult | null => {
  switch (draft.kind) {
    case "register_item":
      if (![draft.name, draft.category, draft.specification, draft.baseUnit, draft.purchaseUnit].every(hasText)) return unavailable("INVALID_TEXT", "필수 물품 정보를 입력해야 합니다.");
      return isPositiveSafeInteger(draft.baseUnitsPerPurchaseUnit) && Number.isSafeInteger(draft.recommendedStock) && draft.recommendedStock >= 0 && Number.isSafeInteger(draft.minimumStock) && draft.minimumStock >= 0
        ? null : unavailable("INVALID_QUANTITY", "재고 수량과 변환비는 안전한 정수여야 합니다.");
    case "receive": {
      if (!itemExists(draft.itemId)) return unavailable("ITEM_NOT_FOUND", "선택한 합성 물품을 확인할 수 없습니다.");
      if (!isPositiveSafeInteger(draft.purchaseQuantity) || !isPositiveSafeInteger(draft.baseUnitsPerPurchaseUnit)) {
        return unavailable("INVALID_QUANTITY", "수량과 변환비는 양의 정수로 입력해야 합니다.");
      }
      if (!isIsoDate(draft.receivedOn) || (draft.expiresOn !== null && !isIsoDate(draft.expiresOn))) return unavailable("INVALID_TEXT", "입고일과 유효기간을 확인해 주세요.");
      return Number.isSafeInteger(draft.purchaseQuantity * draft.baseUnitsPerPurchaseUnit)
        ? null
        : unavailable("QUANTITY_OVERFLOW", "변환된 기본 단위 수량이 안전한 정수 범위를 벗어납니다.");
    }
    case "use":
      if (!itemExists(draft.itemId)) return unavailable("ITEM_NOT_FOUND", "선택한 합성 물품을 확인할 수 없습니다.");
      if (!isPositiveSafeInteger(draft.quantity)) return unavailable("INVALID_QUANTITY", "수량은 양의 정수로 입력해야 합니다.");
      if (draft.quantity > getInventoryStockTotals(findItem(draft.itemId)!, syntheticInventoryReferenceDate).availableQuantity) return unavailable("INVALID_QUANTITY", "사용 수량이 가용재고를 초과합니다.");
      return hasText(draft.note) ? null : unavailable("INVALID_TEXT", "사용 메모를 입력해야 합니다.");
    case "dispose":
      if (!itemExists(draft.itemId)) return unavailable("ITEM_NOT_FOUND", "선택한 합성 물품을 확인할 수 없습니다.");
      if (!lotBelongsToItem(draft.itemId, draft.lotId)) return unavailable("LOT_NOT_FOUND", "선택한 합성 로트를 확인할 수 없습니다.");
      if (!isPositiveSafeInteger(draft.quantity)) return unavailable("INVALID_QUANTITY", "수량은 양의 정수로 입력해야 합니다.");
      if (draft.quantity > findItem(draft.itemId)!.lots.find((lot) => lot.lotId === draft.lotId)!.remainingQuantity) return unavailable("INVALID_QUANTITY", "폐기 수량이 로트 잔량을 초과합니다.");
      return hasText(draft.reason) ? null : unavailable("INVALID_TEXT", "폐기 사유를 입력해야 합니다.");
    case "adjust":
      if (!itemExists(draft.itemId)) return unavailable("ITEM_NOT_FOUND", "선택한 합성 물품을 확인할 수 없습니다.");
      if (!lotBelongsToItem(draft.itemId, draft.lotId)) return unavailable("LOT_NOT_FOUND", "선택한 합성 로트를 확인할 수 없습니다.");
      if (!Number.isSafeInteger(draft.confirmedQuantity) || draft.confirmedQuantity < 0) return unavailable("INVALID_QUANTITY", "확인 잔량은 0 이상의 정수여야 합니다.");
      return hasText(draft.reason) ? null : unavailable("INVALID_TEXT", "정정 사유를 입력해야 합니다.");
    case "purchase_candidate":
      if (!itemExists(draft.itemId)) return unavailable("ITEM_NOT_FOUND", "선택한 합성 물품을 확인할 수 없습니다.");
      return isPositiveSafeInteger(draft.purchaseQuantity) && Number.isSafeInteger(draft.estimatedUnitPrice) && draft.estimatedUnitPrice >= 0 ? null : unavailable("INVALID_QUANTITY", "수량과 예상 단가는 안전한 정수여야 합니다.");
  }
};

const cloneItems = () => syntheticInventoryItems.map((item) => ({
  ...item,
  lots: item.lots.map((lot) => ({ ...lot })),
  recentHistory: item.recentHistory.map((entry) => ({ ...entry })),
}));

export const createSyntheticInventoryAdapter = (): InventoryUiAdapter => ({
  async loadWorkspace(): Promise<InventoryWorkspaceReadResult> {
    return {
      mode: "synthetic",
      referenceDate: syntheticInventoryReferenceDate,
      items: cloneItems(),
    };
  },
  async previewMutation(draft: InventoryMutationDraft): Promise<InventoryMutationPreviewResult> {
    const validationResult = validateDraft(draft);
    if (validationResult !== null) return validationResult;
    return {
      kind: "preview_only",
      persisted: false,
      operation: draft.kind,
      message: "합성 데이터 입력을 확인했습니다. 실제 재고에는 반영되지 않습니다.",
    };
  },
});
