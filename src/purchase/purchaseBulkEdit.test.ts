import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem } from "./purchaseDomain";
import { createPurchaseBulkEdits, previewPurchaseBulkEdit } from "./purchaseBulkEdit";

describe("purchase bulk preview", () => {
  it.each(["vendor", "budgetItem"] as const)("changes only %s on selected items", (field) => {
    const items = [createEmptyPurchaseItem("a"), { ...createEmptyPurchaseItem("b"), selected: false }];
    const result = previewPurchaseBulkEdit(items, { ...createPurchaseBulkEdits(), [field]: { mode: "set", value: " 새 값 " } });
    expect(result).toEqual({ kind: "valid", changes: [{ itemId: "a", fields: [{ field, before: "", after: "새 값" }] }] });
  });
  it("requires explicit clear and detects no-op", () => {
    const items = [{ ...createEmptyPurchaseItem("a"), vendor: "상점" }];
    expect(previewPurchaseBulkEdit(items, { vendor: { mode: "set", value: " " }, budgetItem: { mode: "keep" } }).kind).toBe("invalid");
    expect(previewPurchaseBulkEdit(items, createPurchaseBulkEdits())).toEqual({ kind: "valid", changes: [] });
    expect(previewPurchaseBulkEdit(items, { vendor: { mode: "clear" }, budgetItem: { mode: "keep" } })).toEqual({ kind: "valid", changes: [{ itemId: "a", fields: [{ field: "vendor", before: "상점", after: "" }] }] });
  });
});
