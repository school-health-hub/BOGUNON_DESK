import { describe, expect, it } from "vitest";
import type { PurchaseItem } from "../purchase/types";
import {
  createPurchaseHelperSession,
  reconcilePurchaseHelperSession,
} from "./purchaseHelperAdapter";
import type { InventoryPurchaseBatchSnapshot } from "./purchaseHelperAdapterTypes";

const schoolA = "00000000-0000-4000-8000-000000000001";
const schoolB = "00000000-0000-4000-8000-000000000002";
const batchId = "10000000-0000-4000-8000-000000000001";

const batch = (overrides: Partial<InventoryPurchaseBatchSnapshot> = {}): InventoryPurchaseBatchSnapshot => ({
  schoolId: schoolA,
  batchId,
  status: "AWAITING_RECEIPT",
  lines: [
    {
      schoolId: schoolA,
      lineId: "20000000-0000-4000-8000-000000000001",
      itemId: "30000000-0000-4000-8000-000000000001",
      candidateId: "candidate-a",
      itemName: "합성 마스크",
      specification: "100개/상자",
      baseUnit: "개",
      purchaseUnit: "상자",
      baseUnitsPerPurchaseUnit: "100",
      requestedPurchaseQuantity: "2",
      receivedBaseQuantity: "40",
      expectedUnitPrice: "12000",
    },
    {
      schoolId: schoolA,
      lineId: "20000000-0000-4000-8000-000000000002",
      itemId: "30000000-0000-4000-8000-000000000002",
      candidateId: "candidate-b",
      itemName: "합성 마스크",
      specification: "50개/상자",
      baseUnit: "개",
      purchaseUnit: "상자",
      baseUnitsPerPurchaseUnit: "50",
      requestedPurchaseQuantity: "3",
      receivedBaseQuantity: "0",
      expectedUnitPrice: "8000",
    },
  ],
  ...overrides,
});

const readySession = () => {
  const result = createPurchaseHelperSession(batch());
  expect(result.kind).toBe("ready");
  if (result.kind !== "ready") throw new Error("expected ready adapter session");
  return result.session;
};

describe("Inventory purchase helper adapter projection", () => {
  it("projects Helper-compatible rows and keeps authority in an immutable sidecar", () => {
    const result = createPurchaseHelperSession(batch());
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.session.helperItems.map(({ name, specification, quantity, unitPrice }) => ({ name, specification, quantity, unitPrice }))).toEqual([
      { name: "합성 마스크", specification: "100개/상자", quantity: 2, unitPrice: 12000 },
      { name: "합성 마스크", specification: "50개/상자", quantity: 3, unitPrice: 8000 },
    ]);
    expect(result.session.lineage.map(({ lineId, itemId, requestedBaseQuantity }) => ({ lineId, itemId, requestedBaseQuantity }))).toEqual([
      { lineId: batch().lines[0]?.lineId, itemId: batch().lines[0]?.itemId, requestedBaseQuantity: "200" },
      { lineId: batch().lines[1]?.lineId, itemId: batch().lines[1]?.itemId, requestedBaseQuantity: "150" },
    ]);
    expect(result.session.stockEffect).toBe("NONE");
    expect(result.session.receiptCommand).toBeNull();
  });

  it("keeps same-name items distinct by line and item identity", () => {
    const session = readySession();
    expect(new Set(session.helperItems.map((item) => item.id)).size).toBe(2);
    expect(new Set(session.lineage.map((line) => line.itemId)).size).toBe(2);
  });

  it("keeps Helper amount inputs separate from base-unit stock authority", () => {
    const session = readySession();
    const first = session.helperItems[0];
    const lineage = session.lineage[0];
    expect(first === undefined ? null : (first.quantity ?? 0) * (first.unitPrice ?? 0)).toBe(24000);
    expect(first?.importedAmount).toBeNull();
    expect(lineage?.requestedBaseQuantity).toBe("200");
  });

  it("preserves partial-receipt metadata without deriving stock changes", () => {
    const session = readySession();
    expect(session.serverSnapshot.lines[0]?.receivedBaseQuantity).toBe("40");
    expect(session.stockEffect).toBe("NONE");
    expect(session.receiptCommand).toBeNull();
  });

  it("round-trips the authoritative 40 plus 30 cumulative receipt snapshot", () => {
    const source = batch();
    const first = source.lines[0];
    if (first === undefined) throw new Error("fixture missing first line");
    const firstReceipt = createPurchaseHelperSession(source);
    expect(firstReceipt.kind).toBe("ready");
    if (firstReceipt.kind !== "ready") return;
    expect(firstReceipt.session.serverSnapshot.lines[0]?.receivedBaseQuantity).toBe("40");
    const cumulativeReceived = (BigInt(first.receivedBaseQuantity) + 30n).toString();
    const afterSecondReceipt = createPurchaseHelperSession({ ...source, lines: [{ ...first, receivedBaseQuantity: cumulativeReceived }, ...source.lines.slice(1)] });
    expect(afterSecondReceipt.kind).toBe("ready");
    if (afterSecondReceipt.kind !== "ready") return;
    const reconciled = reconcilePurchaseHelperSession({ session: afterSecondReceipt.session, helperItems: afterSecondReceipt.session.helperItems, activeSchoolId: schoolA });
    expect(reconciled.kind).toBe("ready");
    expect(afterSecondReceipt.session.serverSnapshot.lines[0]?.receivedBaseQuantity).toBe("70");
  });

  it("recreates a deterministic editing projection from the server snapshot", () => {
    const first = readySession();
    const second = readySession();
    expect(second.helperItems).toEqual(first.helperItems);
    expect(second.lineage).toEqual(first.lineage);
  });

  it.each([
    ["fractional base quantity", { requestedPurchaseQuantity: "0.5", baseUnitsPerPurchaseUnit: "3" }],
    ["unsafe helper quantity", { requestedPurchaseQuantity: "9007199254740992" }],
    ["half-ULP helper quantity", { requestedPurchaseQuantity: "4503599627370496.5", baseUnitsPerPurchaseUnit: "2" }],
    ["fractional KRW price", { expectedUnitPrice: "1.5" }],
    ["negative quantity", { requestedPurchaseQuantity: "-1" }],
  ])("rejects %s", (_label, linePatch) => {
    const source = batch();
    const first = source.lines[0];
    if (first === undefined) throw new Error("fixture missing first line");
    const result = createPurchaseHelperSession({ ...source, lines: [{ ...first, ...linePatch }] });
    expect(result.kind).toBe("rejected");
  });

  it("rejects cross-school, duplicate-line and formula-like text boundaries", () => {
    const source = batch();
    const first = source.lines[0];
    if (first === undefined) throw new Error("fixture missing first line");
    expect(createPurchaseHelperSession({ ...source, lines: [{ ...first, schoolId: schoolB }] }).kind).toBe("rejected");
    expect(createPurchaseHelperSession({ ...source, lines: [{ ...first, schoolId: "" }] }).kind).toBe("rejected");
    const missingSchool = { ...first };
    Reflect.deleteProperty(missingSchool, "schoolId");
    expect(createPurchaseHelperSession({ ...source, lines: [missingSchool] }).kind).toBe("rejected");
    expect(createPurchaseHelperSession({ ...source, lines: [first, first] }).kind).toBe("rejected");
    expect(createPurchaseHelperSession({ ...source, lines: [{ ...first, itemName: "=1+1" }] }).kind).toBe("rejected");
  });
});

describe("Purchase Helper result reconciliation", () => {
  it("preserves mapping after row reorder", () => {
    const session = readySession();
    const result = reconcilePurchaseHelperSession({ session, helperItems: [...session.helperItems].reverse(), activeSchoolId: schoolA });
    expect(result.kind).toBe("ready");
    expect(result.matched.map((row) => row.lineId).sort()).toEqual(session.lineage.map((row) => row.lineId).sort());
  });

  it("returns quantity and price changes as review proposals without applying stock", () => {
    const session = readySession();
    const first = session.helperItems[0];
    if (first === undefined) throw new Error("fixture missing helper row");
    const edited: PurchaseItem = { ...first, quantity: 4, unitPrice: 11000 };
    const result = reconcilePurchaseHelperSession({ session, helperItems: [edited, ...session.helperItems.slice(1)], activeSchoolId: schoolA });
    expect(result.kind).toBe("review_required");
    expect(result.changed).toMatchObject([{ lineId: session.lineage[0]?.lineId, requestedPurchaseQuantity: "4", expectedUnitPrice: "11000" }]);
    expect(result.stockEffect).toBe("NONE");
    expect(result.receiptCommand).toBeNull();
  });

  it("detects deleted and deselected rows", () => {
    const session = readySession();
    const first = session.helperItems[0];
    if (first === undefined) throw new Error("fixture missing helper row");
    const missing = reconcilePurchaseHelperSession({ session, helperItems: session.helperItems.slice(1), activeSchoolId: schoolA });
    const deselected = reconcilePurchaseHelperSession({ session, helperItems: [{ ...first, selected: false }, ...session.helperItems.slice(1)], activeSchoolId: schoolA });
    expect(missing.missing).toEqual([{ lineId: session.lineage[0]?.lineId, reason: "ROW_REMOVED" }]);
    expect(deselected.missing).toEqual([{ lineId: session.lineage[0]?.lineId, reason: "ROW_DESELECTED" }]);
  });

  it("marks added rows for review and never name-maps them", () => {
    const session = readySession();
    const source = session.helperItems[0];
    if (source === undefined) throw new Error("fixture missing helper row");
    const added = { ...source, id: "helper-new", specification: "100개/상자" };
    const result = reconcilePurchaseHelperSession({ session, helperItems: [...session.helperItems, added], activeSchoolId: schoolA });
    expect(result.kind).toBe("review_required");
    expect(result.added).toEqual([{ helperRowId: "helper-new", reason: "UNKNOWN_HELPER_ROW" }]);
  });

  it("retains an explicit issue for unsafe unknown rows without mapping them", () => {
    const session = readySession();
    const source = session.helperItems[0];
    if (source === undefined) throw new Error("fixture missing helper row");
    const result = reconcilePurchaseHelperSession({ session, helperItems: [...session.helperItems, { ...source, id: "helper-unsafe", note: "  =1+1" }], activeSchoolId: schoolA });
    expect(result.kind).toBe("review_required");
    expect(result.added).toEqual([{ helperRowId: "helper-unsafe", reason: "UNKNOWN_HELPER_ROW" }]);
    expect(result.issues).toContainEqual({ code: "INVALID_TEXT", field: "helperText", lineId: null });
  });

  it("rejects duplicate row identity, cross-school reconciliation and unsafe text", () => {
    const session = readySession();
    const first = session.helperItems[0];
    if (first === undefined) throw new Error("fixture missing helper row");
    expect(reconcilePurchaseHelperSession({ session, helperItems: [first, first], activeSchoolId: schoolA }).kind).toBe("rejected");
    expect(reconcilePurchaseHelperSession({ session, helperItems: session.helperItems, activeSchoolId: schoolB }).kind).toBe("rejected");
    expect(reconcilePurchaseHelperSession({ session, helperItems: [{ ...first, name: "@SUM(A1)" }, ...session.helperItems.slice(1)], activeSchoolId: schoolA }).kind).toBe("rejected");
    expect(reconcilePurchaseHelperSession({ session, helperItems: [{ ...first, note: "safe\nunsafe" }, ...session.helperItems.slice(1)], activeSchoolId: schoolA }).kind).toBe("rejected");
    expect(reconcilePurchaseHelperSession({ session, helperItems: [{ ...first, vendor: `safe${String.fromCharCode(127)}unsafe` }, ...session.helperItems.slice(1)], activeSchoolId: schoolA }).kind).toBe("rejected");
  });

  it("requires review for identity-bearing name, specification or ambiguous numeric edits", () => {
    const session = readySession();
    const first = session.helperItems[0];
    if (first === undefined) throw new Error("fixture missing helper row");
    for (const edit of [{ name: "다른 품목" }, { specification: "다른 규격" }, { quantity: 1.25 }]) {
      const result = reconcilePurchaseHelperSession({ session, helperItems: [{ ...first, ...edit }, ...session.helperItems.slice(1)], activeSchoolId: schoolA });
      expect(result.kind).toBe("review_required");
    }
  });

  it("reports the honest session recovery boundary", () => {
    const session = readySession();
    expect(session.recovery).toEqual({ serverBatch: "RECOVERABLE", unsavedHelperEdits: "NOT_RECOVERABLE", downloadedFiles: "EXTERNAL_ONLY", confirmedReceipts: "SERVER_RECORDED" });
  });

  it("does not mutate snapshots or returned Helper rows", () => {
    const source = batch();
    const before = JSON.stringify(source);
    const session = createPurchaseHelperSession(source);
    expect(JSON.stringify(source)).toBe(before);
    if (session.kind !== "ready") return;
    const helperBefore = JSON.stringify(session.session.helperItems);
    reconcilePurchaseHelperSession({ session: session.session, helperItems: session.session.helperItems, activeSchoolId: schoolA });
    expect(JSON.stringify(session.session.helperItems)).toBe(helperBefore);
  });
});
