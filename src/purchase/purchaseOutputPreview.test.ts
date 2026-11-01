import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";
import { createPurchaseSettlement } from "./purchaseSettlement";
import { createPreviewContextKey, previewBlockReasons } from "./purchaseOutputPreview";

const item = withPurchaseIssues({ ...createEmptyPurchaseItem("preview"), name: "합성 품목", quantity: 2, unitPrice: 100 });
describe("purchase output preview context", () => {
  it("invalidates confirmation when selection, values, order or columns change", () => {
    const second = { ...item, id: "second" };
    const items = [item, second];
    const key = createPreviewContextKey(items, ["name", "amount"]);
    expect(createPreviewContextKey(items, ["name", "amount"])).toBe(key);
    for (const changed of [[second, item], [{ ...item, selected: false }, second], [{ ...item, unitPrice: 200 }, second]]) {
      expect(createPreviewContextKey(changed, ["name", "amount"])).not.toBe(key);
    }
    expect(createPreviewContextKey(items, ["amount", "name"])).not.toBe(key);
  });
  it("invalidates confirmation after settlement and source revisions", () => {
    const settlement = createPurchaseSettlement([item]);
    const key = createPreviewContextKey([item], ["name"], settlement, 1);
    expect(createPreviewContextKey([item], ["name"], { ...settlement, shippingFee: 10 }, 1)).not.toBe(key);
    expect(createPreviewContextKey([item], ["name"], settlement, 2)).not.toBe(key);
  });
  it("blocks empty selection and unreviewed output errors", () => {
    expect(previewBlockReasons([])).toHaveLength(1);
    expect(previewBlockReasons([createEmptyPurchaseItem("invalid")])).not.toHaveLength(0);
    expect(previewBlockReasons([item])).toEqual([]);
  });
  it("blocks tax discrepancy only for settlement output", () => {
    const settlement = { ...createPurchaseSettlement([item]), tax: { mode: "excluded", amount: 20 } as const };
    expect(previewBlockReasons([item], settlement, true)).not.toHaveLength(0);
    expect(previewBlockReasons([item], settlement, false)).toEqual([]);
  });
});
