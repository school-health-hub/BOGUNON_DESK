import { updatePurchaseItem } from "./purchaseDomain";
import { applyPurchaseBulkChanges, canUndoPurchaseBulkEdit, previewPurchaseBulkEdit, purchaseIdsAreUnique, purchaseSelectionMatches, type PurchaseBulkRequest, type PurchaseBulkUndo } from "./purchaseBulkEdit";
import type { PurchaseItem } from "./types";

export type PurchaseItemPatch = Partial<Omit<PurchaseItem, "id" | "issues" | "selected">>;
export type PurchaseEditingState = {
  readonly items: readonly PurchaseItem[];
  readonly revision: number;
  readonly undo: PurchaseBulkUndo | null;
  readonly message: string;
};
export type PurchaseItemAction =
  | { readonly type: "patch"; readonly id: string; readonly patch: PurchaseItemPatch }
  | { readonly type: "select"; readonly id?: string; readonly selected: boolean }
  | { readonly type: "move"; readonly id: string; readonly delta: -1 | 1 }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "append"; readonly items: readonly PurchaseItem[] }
  | { readonly type: "replace"; readonly items: readonly PurchaseItem[] }
  | { readonly type: "reset" }
  | { readonly type: "invalidate"; readonly reason: string }
  | { readonly type: "bulk"; readonly request: PurchaseBulkRequest }
  | { readonly type: "undo"; readonly revision: number };

export const createPurchaseEditingState = (items: readonly PurchaseItem[] = []): PurchaseEditingState => ({ items, revision: 0, undo: null, message: "" });
const changed = (state: PurchaseEditingState, items: readonly PurchaseItem[], reason: string): PurchaseEditingState => ({
  items, revision: state.revision + 1, undo: null,
  message: state.undo === null ? "" : `${reason} 마지막 일괄 변경을 실행 취소할 수 없습니다.`,
});

export function purchaseItemEditingReducer(state: PurchaseEditingState, action: PurchaseItemAction): PurchaseEditingState {
  switch (action.type) {
    case "patch": {
      const items = state.items.map((item) => item.id === action.id ? updatePurchaseItem(item, action.patch) : item);
      const hasChange = items.some((item, index) => JSON.stringify(item) !== JSON.stringify(state.items[index]));
      return hasChange ? changed(state, items, "품목이 편집되어") : state;
    }
    case "select": return { ...state, items: state.items.map((item) => action.id === undefined || item.id === action.id ? { ...item, selected: action.selected } : item) };
    case "move": {
      const index = state.items.findIndex((item) => item.id === action.id);
      const target = index + action.delta;
      const fromItem = state.items[index];
      const toItem = state.items[target];
      if (index < 0 || fromItem === undefined || toItem === undefined) return state;
      const items = [...state.items];
      items[index] = toItem;
      items[target] = fromItem;
      return { ...state, items };
    }
    case "remove": return changed(state, state.items.filter((item) => item.id !== action.id), "품목이 삭제되어");
    case "append": return action.items.length === 0 ? state : changed(state, [...state.items, ...action.items], "품목을 가져오거나 추가하여");
    case "replace": return changed(state, action.items, "품목이 교체되어");
    case "reset": return changed(state, [], "새 작업을 시작하여");
    case "invalidate": return changed(state, state.items, action.reason);
    case "bulk": {
      const { request } = action;
      if (request.revision !== state.revision || !purchaseIdsAreUnique(state.items) || !purchaseSelectionMatches(state.items, request.selectedIds)) {
        return { ...state, message: "대상 품목이 변경되었습니다. 일괄 편집 내용을 다시 확인해 주세요." };
      }
      const preview = previewPurchaseBulkEdit(state.items, request.edits);
      if (preview.kind === "invalid") return { ...state, message: preview.message };
      if (preview.changes.length === 0) return { ...state, message: "변경할 품목이 없습니다." };
      const revision = state.revision + 1;
      return {
        items: applyPurchaseBulkChanges(state.items, preview.changes, "after"), revision,
        undo: { revision, changes: preview.changes },
        message: `${preview.changes.length}개 품목에 일괄 적용했습니다. 기존 품의문은 자동 변경되지 않습니다.`,
      };
    }
    case "undo": {
      if (state.undo === null) return { ...state, message: "실행 취소할 일괄 변경이 없습니다." };
      if (action.revision !== state.revision || state.undo.revision !== state.revision || !canUndoPurchaseBulkEdit(state.items, state.undo)) {
        return { ...state, message: "품목이 변경되어 실행 취소할 수 없습니다. 어떤 품목도 복원하지 않았습니다." };
      }
      return { items: applyPurchaseBulkChanges(state.items, state.undo.changes, "before"), revision: state.revision + 1, undo: null, message: `${state.undo.changes.length}개 품목의 일괄 변경을 실행 취소했습니다.` };
    }
  }
}
