export { createSyntheticInventoryAdapter } from "./syntheticAdapter";
export { InventoryManagementPanel } from "./InventoryManagementPanel";
export { syntheticInventoryItems, syntheticInventoryReferenceDate } from "./syntheticFixtures";
export { buildInventorySummary, filterInventoryItems, getInventoryItemStatus, getInventoryStockTotals } from "./inventorySelectors";
export type {
  InventoryDisplayStatus,
  InventoryItemView,
  InventoryLotView,
  InventoryMutationDraft,
  InventoryMutationPreviewResult,
  InventoryStockTotals,
  InventorySummary,
  InventoryUiAdapter,
  InventoryWorkspaceReadResult,
} from "./inventoryTypes";
