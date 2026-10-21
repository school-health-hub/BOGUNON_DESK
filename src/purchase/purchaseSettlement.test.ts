import { describe, expect, it } from "vitest";
import { appendPurchaseItemsWithSessionIds, createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";
import {
  calculatePurchaseSettlementSummary,
  calculatePurchaseSettlementDisplaySummary,
  createPurchaseSettlement,
  createPurchaseSettlementClipboard,
  getPurchaseSettlementWarnings,
  reconcilePurchaseSettlement,
  resolveSettlementItemAmount,
  updatePurchaseSettlementItem,
  updatePurchaseSettlementOrder,
  updatePurchaseSettlementTax,
} from "./purchaseSettlement";

const item = (id: string, quantity: number | null, unitPrice: number | null) => withPurchaseIssues({ ...createEmptyPurchaseItem(id), name: id, quantity, unitPrice });

describe("purchase settlement", () => {
  it("initializes selected items from immutable planned values", () => {
    const planned = [item("A", 2, 12_000), { ...item("B", 3, 3_500), selected: false }];
    const settlement = createPurchaseSettlement(planned);
    expect(settlement.items).toEqual([{ purchaseItemId: "A", status: "purchased", actualQuantity: 2, actualUnitPrice: 12_000, note: "" }]);
    expect(planned[0]?.quantity).toBe(2);
  });

  it("keeps settlement rows isolated after repeated native ids are remapped", () => {
    let sequence = 0;
    const imported = item("purchase-0-0", 1, 10_000);
    const planned = appendPurchaseItemsWithSessionIds(
      appendPurchaseItemsWithSessionIds([], [imported], () => `session-${sequence++}`),
      [imported],
      () => `session-${sequence++}`,
    );
    const settlement = createPurchaseSettlement(planned);
    const edited = updatePurchaseSettlementItem(settlement, "session-0", { actualQuantity: 2 });

    expect(settlement.items.map((entry) => entry.purchaseItemId)).toEqual(["session-0", "session-1"]);
    expect(edited.items.map((entry) => entry.actualQuantity)).toEqual([2, 1]);
  });

  it("includes purchased and partial amounts but excludes pending and cancelled", () => {
    expect(resolveSettlementItemAmount({ purchaseItemId: "A", status: "purchased", actualQuantity: 2, actualUnitPrice: 11_500, note: "" })).toBe(23_000);
    expect(resolveSettlementItemAmount({ purchaseItemId: "A", status: "partial", actualQuantity: 2, actualUnitPrice: 3_500, note: "" })).toBe(7_000);
    expect(resolveSettlementItemAmount({ purchaseItemId: "A", status: "pending", actualQuantity: 2, actualUnitPrice: 3_500, note: "" })).toBeNull();
    expect(resolveSettlementItemAmount({ purchaseItemId: "A", status: "cancelled", actualQuantity: 2, actualUnitPrice: 3_500, note: "" })).toBeNull();
  });

  it("calculates shipping, discount, and planned difference", () => {
    const planned = [item("A", 2, 12_000), item("B", 3, 3_500)];
    const settlement = { items: [
      { purchaseItemId: "A", status: "purchased" as const, actualQuantity: 2, actualUnitPrice: 11_500, note: "" },
      { purchaseItemId: "B", status: "partial" as const, actualQuantity: 2, actualUnitPrice: 3_500, note: "" },
    ], shippingFee: 3_000, discountAmount: 1_000, adjustmentNote: "" };
    expect(calculatePurchaseSettlementSummary(planned, settlement)).toEqual({ plannedTotal: 34_500, actualSubtotal: 30_000, shippingFee: 3_000, discountAmount: 1_000, finalActual: 32_000, difference: -2_500 });
  });

  it("keeps legacy settlements and export summaries unchanged when tax is absent", () => {
    const planned = [item("A", 1, 10_000)];
    const settlement = createPurchaseSettlement(planned);

    expect(settlement).not.toHaveProperty("tax");
    expect(calculatePurchaseSettlementSummary(planned, settlement)).toEqual({
      plannedTotal: 10_000,
      actualSubtotal: 10_000,
      shippingFee: 0,
      discountAmount: 0,
      finalActual: 10_000,
      difference: 0,
    });
    expect(calculatePurchaseSettlementDisplaySummary(planned, settlement)).toEqual({
      legacyExportTotal: 10_000,
      screenFinalActual: 10_000,
      screenDifference: 0,
      tax: { mode: "unspecified", amount: null },
      appliedTaxAmount: 0,
      legacyOutputSafe: true,
    });
  });

  it("adds only explicit excluded tax to the screen total while preserving the legacy export total", () => {
    const planned = [item("A", 1, 10_000)];
    const base = createPurchaseSettlement(planned);
    const excluded = updatePurchaseSettlementTax(base, { mode: "excluded", amount: 1_000 });
    const included = updatePurchaseSettlementTax(base, { mode: "included", amount: 1_000 });

    expect(calculatePurchaseSettlementSummary(planned, excluded).finalActual).toBe(10_000);
    expect(calculatePurchaseSettlementDisplaySummary(planned, excluded)).toMatchObject({
      legacyExportTotal: 10_000,
      screenFinalActual: 11_000,
      screenDifference: 1_000,
      appliedTaxAmount: 1_000,
      legacyOutputSafe: false,
    });
    expect(calculatePurchaseSettlementDisplaySummary(planned, included)).toMatchObject({
      legacyExportTotal: 10_000,
      screenFinalActual: 10_000,
      appliedTaxAmount: 0,
      legacyOutputSafe: true,
    });
  });

  it("does not infer tax and neutralizes invalid explicit tax amounts", () => {
    const planned = [item("A", 1, 10_000)];
    const base = createPurchaseSettlement(planned);
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const settlement = updatePurchaseSettlementTax(base, { mode: "excluded", amount });
      expect(calculatePurchaseSettlementDisplaySummary(planned, settlement)).toMatchObject({
        screenFinalActual: 10_000,
        appliedTaxAmount: 0,
        legacyOutputSafe: true,
      });
    }
    expect(calculatePurchaseSettlementDisplaySummary(planned, updatePurchaseSettlementTax(base, { mode: "exempt", amount: 999 }))).toMatchObject({ appliedTaxAmount: 0 });
    expect(calculatePurchaseSettlementDisplaySummary(planned, updatePurchaseSettlementTax(base, { mode: "unspecified", amount: 999 }))).toMatchObject({ appliedTaxAmount: 0 });
  });

  it("preserves existing values and adds newly selected items", () => {
    const planned = [item("A", 2, 12_000), item("B", 3, 3_500)];
    const existing = { items: [{ purchaseItemId: "A", status: "partial" as const, actualQuantity: 1, actualUnitPrice: 10_000, note: "변경" }], shippingFee: 0, discountAmount: 0, adjustmentNote: "" };
    const next = reconcilePurchaseSettlement(existing, planned);
    expect(next.items[0]).toEqual(existing.items[0]);
    expect(next.items[1]?.purchaseItemId).toBe("B");
  });

  it("edits actual values and order adjustments without mutating planned items", () => {
    const planned = [item("A", 2, 12_000)];
    const initial = createPurchaseSettlement(planned);
    const editedItem = updatePurchaseSettlementItem(initial, "A", { status: "partial", actualQuantity: 1, actualUnitPrice: 11_500, note: "1개 구매" });
    const editedOrder = updatePurchaseSettlementOrder(editedItem, { shippingFee: 3_000, discountAmount: 1_000, adjustmentNote: "쿠폰" });
    expect(editedOrder.items[0]).toMatchObject({ status: "partial", actualQuantity: 1, actualUnitPrice: 11_500, note: "1개 구매" });
    expect(editedOrder).toMatchObject({ shippingFee: 3_000, discountAmount: 1_000, adjustmentNote: "쿠폰" });
    expect(calculatePurchaseSettlementSummary(planned, editedOrder).finalActual).toBe(13_500);
    expect(planned[0]).toMatchObject({ quantity: 2, unitPrice: 12_000 });
    expect(initial.items[0]).toMatchObject({ status: "purchased", actualQuantity: 2, actualUnitPrice: 12_000 });
  });

  it("keeps deselected settlement input for reselection without surfacing hidden warnings", () => {
    const planned = [{ ...item("A", 2, 12_000), selected: false }];
    const settlement = { items: [{ purchaseItemId: "A", status: "purchased" as const, actualQuantity: 3, actualUnitPrice: null, note: "보존" }], shippingFee: 0, discountAmount: 0, adjustmentNote: "" };
    expect(reconcilePurchaseSettlement(settlement, planned)).toBe(settlement);
    expect(getPurchaseSettlementWarnings(planned, settlement)).toEqual([]);
    const reselected = [{ ...planned[0]!, selected: true }];
    expect(reconcilePurchaseSettlement(settlement, reselected).items[0]).toEqual(settlement.items[0]);
    expect(getPurchaseSettlementWarnings(reselected, settlement)).toContain("실제 단가를 확인해 주세요.");
  });

  it("reports quantity, missing-value, over-budget, and negative-total warnings", () => {
    const planned = [item("A", 2, 12_000)];
    const settlement = { items: [{ purchaseItemId: "A", status: "purchased" as const, actualQuantity: 3, actualUnitPrice: null, note: "" }], shippingFee: 0, discountAmount: 30_000, adjustmentNote: "" };
    expect(getPurchaseSettlementWarnings(planned, settlement)).toEqual(expect.arrayContaining(["실제 단가를 확인해 주세요.", "품의 수량보다 실제 수량이 많습니다.", "최종 결제금액이 0원보다 작습니다."]));
  });

  it("reports the numeric over-budget difference without an administrative judgment", () => {
    const planned = [item("A", 1, 10_000)];
    const settlement = { items: [{ purchaseItemId: "A", status: "purchased" as const, actualQuantity: 1, actualUnitPrice: 12_000, note: "" }], shippingFee: 0, discountAmount: 0, adjustmentNote: "" };
    expect(getPurchaseSettlementWarnings(planned, settlement)).toContain("품의금액보다 2,000원 많습니다.");
  });

  it("creates escaped HTML and TSV rows", () => {
    const planned = [{ ...item("A", 2, 12_000), name: "<장갑>&" }];
    const settlement = createPurchaseSettlement(planned);
    const clipboard = createPurchaseSettlementClipboard(planned, settlement);
    expect(clipboard.text).toContain("품명\t품의수량\t실제수량");
    expect(clipboard.text).toContain("<장갑>&\t2\t2");
    expect(clipboard.html).toContain("&lt;장갑&gt;&amp;");
  });
});
