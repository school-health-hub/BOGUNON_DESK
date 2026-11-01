import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem } from "./purchaseDomain";
import { createPurchaseBulkEdits, type PurchaseBulkEdits } from "./purchaseBulkEdit";
import { createPurchaseEditingState, purchaseItemEditingReducer as reduce, type PurchaseEditingState } from "./purchaseItemEditing";

const initial = () => createPurchaseEditingState([
  { ...createEmptyPurchaseItem("a"), vendor: "가게 A", budgetItem: "예산 A", note: "보존" },
  { ...createEmptyPurchaseItem("b"), vendor: "가게 B", budgetItem: "예산 B" },
]);
const edits: PurchaseBulkEdits = { vendor: { mode: "set", value: "공통 구매처" }, budgetItem: { mode: "clear" } };
const apply = (state: PurchaseEditingState, changes = edits) => reduce(state, { type: "bulk", request: { revision: state.revision, selectedIds: state.items.filter((item) => item.selected).map((item) => item.id), edits: changes } });

describe("purchase item owner transactions", () => {
  it("applies both fields and restores distinct originals without changing selection or order", () => {
    let state = apply(initial());
    expect(state.items.map((item) => [item.vendor, item.budgetItem])).toEqual([["공통 구매처", ""], ["공통 구매처", ""]]);
    state = reduce(state, { type: "select", id: "a", selected: false });
    state = reduce(state, { type: "move", id: "a", delta: 1 });
    state = reduce(state, { type: "undo", revision: state.revision });
    expect(state.items.map((item) => [item.id, item.vendor, item.budgetItem, item.selected])).toEqual([["b", "가게 B", "예산 B", true], ["a", "가게 A", "예산 A", false]]);
    expect(state.items[1]?.note).toBe("보존");
    expect(state.undo).toBeNull();
  });
  it("replaces history only on a second successful batch", () => {
    const first = apply(initial());
    const second = apply(first, { vendor: { mode: "set", value: "두 번째" }, budgetItem: { mode: "keep" } });
    const undone = reduce(second, { type: "undo", revision: second.revision });
    expect(undone.items.map((item) => item.vendor)).toEqual(["공통 구매처", "공통 구매처"]);
  });
  it("preserves history on invalid, stale, and no-op requests", () => {
    const state = apply(initial());
    expect(apply(state, createPurchaseBulkEdits()).undo).toBe(state.undo);
    expect(apply(state, { ...edits, vendor: { mode: "set", value: " " } }).undo).toBe(state.undo);
    const stale = reduce(state, { type: "bulk", request: { revision: 0, selectedIds: ["a", "b"], edits } });
    expect(stale.items).toBe(state.items);
    expect(stale.undo).toBe(state.undo);
  });
  it("does not lose asynchronous imports to a stale bulk request", () => {
    const before = initial();
    const imported = reduce(before, { type: "append", items: [createEmptyPurchaseItem("incoming")] });
    const stale = reduce(imported, { type: "bulk", request: { revision: before.revision, selectedIds: ["a", "b"], edits } });
    expect(stale.items.map((item) => item.id)).toEqual(["a", "b", "incoming"]);
    expect(stale.items[0]?.vendor).toBe("가게 A");
  });
  it("rejects a changed selection without changing content or history", () => {
    const state = reduce(apply(initial()), { type: "select", id: "b", selected: false });
    const next = reduce(state, { type: "bulk", request: { revision: state.revision, selectedIds: ["a", "b"], edits } });
    expect(next.items).toBe(state.items);
    expect(next.undo).toBe(state.undo);
  });
  it("preserves undo on a no-op cell commit and invalidates on a real edit", () => {
    const state = apply(initial());
    expect(reduce(state, { type: "patch", id: "a", patch: { vendor: "공통 구매처" } }).undo).toBe(state.undo);
    expect(reduce(state, { type: "patch", id: "a", patch: { note: "새 비고" } }).undo).toBeNull();
  });
  it("preserves rows, revision, and history for an empty failed or unsupported import", () => {
    const state = apply(initial());
    expect(reduce(state, { type: "append", items: [] })).toBe(state);
  });
  it.each(["remove", "replace", "append", "reset", "invalidate"] as const)("invalidates undo on %s", (type) => {
    const state = apply(initial());
    switch (type) {
      case "remove": expect(reduce(state, { type, id: "a" }).undo).toBeNull(); break;
      case "replace": expect(reduce(state, { type, items: initial().items }).undo).toBeNull(); break;
      case "append": expect(reduce(state, { type, items: [createEmptyPurchaseItem("c")] }).undo).toBeNull(); break;
      case "reset": expect(reduce(state, { type }).undo).toBeNull(); break;
      case "invalidate": expect(reduce(state, { type, reason: "패널을 닫아" }).undo).toBeNull(); break;
    }
  });
  it.each(["missing", "duplicate", "replaced-value"] as const)("never partially undoes a %s target", (conflict) => {
    const state = apply(initial());
    const items = conflict === "missing" ? state.items.slice(0, 1) : conflict === "duplicate" ? [...state.items, state.items[0] ?? createEmptyPurchaseItem("a")] : state.items.map((item) => item.id === "b" ? { ...item, vendor: "외부 교체" } : item);
    const damaged = { ...state, items };
    const next = reduce(damaged, { type: "undo", revision: state.revision });
    expect(next.items).toBe(items);
    expect(next.items[0]?.vendor).toBe("공통 구매처");
    expect(next.message).toContain("어떤 품목도 복원하지 않았습니다");
  });
});
