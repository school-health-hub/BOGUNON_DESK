import { describe, expect, it } from "vitest";
import { createSyntheticInventoryAdapter } from "../renderer/inventory-preview/source/syntheticAdapter";
import { syntheticInventoryItems, syntheticInventoryReferenceDate } from "../renderer/inventory-preview/source/syntheticFixtures";
import {
  buildInventorySummary,
  filterInventoryItems,
  getInventoryItemStatus,
  getInventoryStockTotals,
} from "../renderer/inventory-preview/source/inventorySelectors";
import type { InventoryItemView } from "../renderer/inventory-preview/source/inventoryTypes";

describe("Inventory UI selectors", () => {
  it("separates total stock from usable stock", () => {
    // Given
    const item = syntheticInventoryItems[0];

    // When
    const totals = getInventoryStockTotals(item, syntheticInventoryReferenceDate);

    // Then
    expect(totals).toEqual({ totalQuantity: 24, availableQuantity: 10 });
  });

  it("counts low, expiring, and expired items independently", () => {
    // Given / When
    const summary = buildInventorySummary(syntheticInventoryItems, syntheticInventoryReferenceDate);

    // Then
    expect(summary).toEqual({ totalItems: 5, lowStockItems: 2, expiringItems: 1, expiredItems: 1 });
  });

  it("matches Korean item metadata and a requested status", () => {
    // Given / When
    const filtered = filterInventoryItems(syntheticInventoryItems, {
      query: "거즈",
      status: "expiring",
      referenceDate: syntheticInventoryReferenceDate,
    });

    // Then
    expect(filtered.map((item) => item.name)).toEqual(["합성 멸균 거즈"]);
  });

  it("reports expired before low-stock when an item has both conditions", () => {
    // Given
    const item = syntheticInventoryItems[1];

    // When / Then
    expect(getInventoryItemStatus(item, syntheticInventoryReferenceDate)).toBe("expired");
  });

  it("keeps an expiry-day lot available and marks day 90 but not day 91 as expiring", () => {
    // Given
    const baseItem = syntheticInventoryItems[4];
    const expiringOnDay90: InventoryItemView = { ...baseItem, lots: [{ ...baseItem.lots[0], expiresOn: "2027-01-31" }] };
    const normalOnDay91: InventoryItemView = { ...baseItem, lots: [{ ...baseItem.lots[0], expiresOn: "2027-02-01" }] };
    const expiresToday: InventoryItemView = { ...baseItem, lots: [{ ...baseItem.lots[0], expiresOn: syntheticInventoryReferenceDate }] };

    // When / Then
    expect(getInventoryItemStatus(expiringOnDay90, syntheticInventoryReferenceDate)).toBe("expiring");
    expect(getInventoryItemStatus(normalOnDay91, syntheticInventoryReferenceDate)).toBe("normal");
    expect(getInventoryStockTotals(expiresToday, syntheticInventoryReferenceDate).availableQuantity).toBe(12);
  });

  it("excludes quarantined, unavailable, and depleted lots from available stock", () => {
    // Given
    const baseItem = syntheticInventoryItems[4];
    const item: InventoryItemView = {
      ...baseItem,
      lots: [
        { ...baseItem.lots[0], lotId: "lot-available", remainingQuantity: 2, status: "available" },
        { ...baseItem.lots[0], lotId: "lot-quarantined", remainingQuantity: 3, status: "quarantined" },
        { ...baseItem.lots[0], lotId: "lot-unavailable", remainingQuantity: 4, status: "unavailable" },
        { ...baseItem.lots[0], lotId: "lot-depleted", remainingQuantity: 0, status: "depleted" },
      ],
    };

    // When / Then
    expect(getInventoryStockTotals(item, syntheticInventoryReferenceDate)).toEqual({ totalQuantity: 9, availableQuantity: 2 });
  });
});

describe("Synthetic Inventory adapter", () => {
  it("labels every read model as synthetic", async () => {
    // Given
    const adapter = createSyntheticInventoryAdapter();

    // When
    const result = await adapter.loadWorkspace();

    // Then
    expect(result.mode).toBe("synthetic");
    expect(result.items.every((item) => item.isSynthetic)).toBe(true);
  });

  it("returns fresh nested fixture graphs for separate reads", async () => {
    // Given
    const adapter = createSyntheticInventoryAdapter();

    // When
    const first = await adapter.loadWorkspace();
    const second = await adapter.loadWorkspace();

    // Then
    expect(first.items).not.toBe(second.items);
    expect(first.items[0]).not.toBe(second.items[0]);
    expect(first.items[0]?.lots).not.toBe(second.items[0]?.lots);
  });

  it("returns preview-only for valid mutation drafts without claiming persistence", async () => {
    // Given
    const adapter = createSyntheticInventoryAdapter();

    // When
    const result = await adapter.previewMutation({
      kind: "use",
      itemId: "synthetic-item-gauze",
      quantity: 2,
      note: "합성 테스트 사용",
    });

    // Then
    expect(result.kind).toBe("preview_only");
    expect(result.persisted).toBe(false);
    expect(result.message).not.toMatch(/저장되었습니다|저장 완료|입고 완료/);
  });

  it("rejects ambiguous fractional conversion instead of rounding", async () => {
    // Given
    const adapter = createSyntheticInventoryAdapter();

    // When
    const result = await adapter.previewMutation({
      kind: "receive",
      itemId: "synthetic-item-gauze",
      purchaseQuantity: 1.5,
      baseUnitsPerPurchaseUnit: 10,
      receivedOn: "2026-11-02",
      expiresOn: null,
    });

    // Then
    expect(result).toEqual({
      kind: "unavailable",
      persisted: false,
      code: "INVALID_QUANTITY",
      message: "수량과 변환비는 양의 정수로 입력해야 합니다.",
    });
  });

  it.each([
    { label: "zero use", draft: { kind: "use", itemId: "synthetic-item-gauze", quantity: 0, note: "합성 사유" } },
    { label: "blank use note", draft: { kind: "use", itemId: "synthetic-item-gauze", quantity: 1, note: "  " } },
    { label: "unknown item", draft: { kind: "purchase_candidate", itemId: "unknown-item", purchaseQuantity: 1, estimatedUnitPrice: 1000 } },
    { label: "unknown lot", draft: { kind: "dispose", itemId: "synthetic-item-gauze", lotId: "unknown-lot", quantity: 1, reason: "합성 사유" } },
    { label: "blank adjustment reason", draft: { kind: "adjust", itemId: "synthetic-item-gauze", lotId: "synthetic-lot-gauze-available", confirmedQuantity: 1, reason: "" } },
    { label: "conversion overflow", draft: { kind: "receive", itemId: "synthetic-item-gauze", purchaseQuantity: Number.MAX_SAFE_INTEGER, baseUnitsPerPurchaseUnit: 2, receivedOn: "2026-11-02", expiresOn: null } },
  ] satisfies readonly { readonly label: string; readonly draft: Parameters<ReturnType<typeof createSyntheticInventoryAdapter>["previewMutation"]>[0] }[])(
    "rejects $label instead of returning preview-only",
    async ({ draft }) => {
      // Given
      const adapter = createSyntheticInventoryAdapter();

      // When
      const result = await adapter.previewMutation(draft);

      // Then
      expect(result.kind).toBe("unavailable");
      expect(result.persisted).toBe(false);
    },
  );

  it.each([
    { label: "use beyond total FEFO-eligible stock", draft: { kind: "use", itemId: "synthetic-item-gauze", quantity: 11, note: "합성 사용" } },
    { label: "dispose beyond selected lot", draft: { kind: "dispose", itemId: "synthetic-item-gauze", lotId: "synthetic-lot-gauze-available", quantity: 11, reason: "합성 폐기" } },
  ] satisfies readonly { readonly label: string; readonly draft: Parameters<ReturnType<typeof createSyntheticInventoryAdapter>["previewMutation"]>[0] }[])("rejects $label", async ({ draft }) => {
    const result = await createSyntheticInventoryAdapter().previewMutation(draft);
    expect(result.kind).toBe("unavailable");
    expect(result.persisted).toBe(false);
  });
});
