import { updatePurchaseItem } from "./purchaseDomain";
import type { PurchaseItem } from "./types";

export const purchaseBulkFields = ["vendor", "budgetItem"] as const;
export type PurchaseBulkField = (typeof purchaseBulkFields)[number];
export type PurchaseFieldEdit = { readonly mode: "keep" } | { readonly mode: "set"; readonly value: string } | { readonly mode: "clear" };
export type PurchaseBulkEdits = Readonly<Record<PurchaseBulkField, PurchaseFieldEdit>>;
export type PurchaseFieldChange = { readonly field: PurchaseBulkField; readonly before: string; readonly after: string };
export type PurchaseBulkChange = { readonly itemId: string; readonly fields: readonly PurchaseFieldChange[] };
export type PurchaseBulkRequest = {
  readonly revision: number;
  readonly selectedIds: readonly string[];
  readonly edits: PurchaseBulkEdits;
};
export type PurchaseBulkUndo = { readonly revision: number; readonly changes: readonly PurchaseBulkChange[] };
export type PurchaseBulkPreview =
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "valid"; readonly changes: readonly PurchaseBulkChange[] };

export const createPurchaseBulkEdits = (): PurchaseBulkEdits => ({ vendor: { mode: "keep" }, budgetItem: { mode: "keep" } });
export const purchaseIdsAreUnique = (items: readonly PurchaseItem[]): boolean => new Set(items.map((item) => item.id)).size === items.length;
export const purchaseSelectionMatches = (items: readonly PurchaseItem[], ids: readonly string[]): boolean => {
  const selected = items.filter((item) => item.selected);
  const expected = new Set(ids);
  return expected.size === ids.length && selected.length === ids.length && selected.every((item) => expected.has(item.id));
};

export function previewPurchaseBulkEdit(items: readonly PurchaseItem[], edits: PurchaseBulkEdits): PurchaseBulkPreview {
  if (!purchaseIdsAreUnique(items)) return { kind: "invalid", message: "품목 ID가 중복되어 적용할 수 없습니다." };
  if (purchaseBulkFields.some((field) => { const edit = edits[field]; return edit.mode === "set" && edit.value.trim() === ""; })) {
    return { kind: "invalid", message: "지정할 값을 입력하거나 ‘비우기’를 선택해 주세요." };
  }
  const changes = items.filter((item) => item.selected).flatMap((item) => {
    const fields = purchaseBulkFields.flatMap((field): readonly PurchaseFieldChange[] => {
      const edit = edits[field];
      switch (edit.mode) {
        case "keep": return [];
        case "clear": return item[field] === "" ? [] : [{ field, before: item[field], after: "" }];
        case "set": {
          const after = edit.value.trim();
          return item[field] === after ? [] : [{ field, before: item[field], after }];
        }
      }
    });
    return fields.length === 0 ? [] : [{ itemId: item.id, fields }];
  });
  return { kind: "valid", changes };
}

export function canUndoPurchaseBulkEdit(items: readonly PurchaseItem[], undo: PurchaseBulkUndo): boolean {
  if (!purchaseIdsAreUnique(items)) return false;
  const byId = new Map(items.map((item) => [item.id, item]));
  return undo.changes.every((change) => {
    const item = byId.get(change.itemId);
    return item !== undefined && change.fields.every((entry) => item[entry.field] === entry.after);
  });
}

export function applyPurchaseBulkChanges(
  items: readonly PurchaseItem[], changes: readonly PurchaseBulkChange[], direction: "before" | "after",
): readonly PurchaseItem[] {
  const byId = new Map(changes.map((change) => [change.itemId, change.fields]));
  return items.map((item) => {
    const fields = byId.get(item.id);
    if (fields === undefined) return item;
    const patch = fields.reduce<Partial<Pick<PurchaseItem, PurchaseBulkField>>>((result, field) => ({ ...result, [field.field]: field[direction] }), {});
    return updatePurchaseItem(item, patch);
  });
}
