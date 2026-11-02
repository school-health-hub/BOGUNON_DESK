import type { InventoryDisplayStatus, InventoryItemView, InventoryStockTotals, InventorySummary } from "./inventoryTypes";

const millisecondsPerDay = 86_400_000;
const expiryWarningDays = 90;

const toUtcDay = (date: string): number => Date.parse(`${date}T00:00:00Z`);

const daysUntil = (expiresOn: string, referenceDate: string): number =>
  Math.floor((toUtcDay(expiresOn) - toUtcDay(referenceDate)) / millisecondsPerDay);

const isExpired = (expiresOn: string | null, referenceDate: string): boolean =>
  expiresOn !== null && daysUntil(expiresOn, referenceDate) < 0;

const isExpiring = (expiresOn: string | null, referenceDate: string): boolean => {
  if (expiresOn === null) return false;
  const remainingDays = daysUntil(expiresOn, referenceDate);
  return remainingDays >= 0 && remainingDays <= expiryWarningDays;
};

export const getInventoryStockTotals = (item: InventoryItemView, referenceDate: string): InventoryStockTotals => ({
  totalQuantity: item.lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0),
  availableQuantity: item.lots.reduce(
    (sum, lot) => sum + (lot.status === "available" && !isExpired(lot.expiresOn, referenceDate) ? lot.remainingQuantity : 0),
    0,
  ),
});

export const getInventoryItemStatus = (
  item: InventoryItemView,
  referenceDate: string,
): Exclude<InventoryDisplayStatus, "all"> => {
  if (item.lots.some((lot) => lot.remainingQuantity > 0 && isExpired(lot.expiresOn, referenceDate))) return "expired";
  if (item.lots.some((lot) => lot.status === "available" && lot.remainingQuantity > 0 && isExpiring(lot.expiresOn, referenceDate))) return "expiring";
  if (getInventoryStockTotals(item, referenceDate).availableQuantity < item.minimumStock) return "low_stock";
  return "normal";
};

export const buildInventorySummary = (
  items: readonly InventoryItemView[],
  referenceDate: string,
): InventorySummary => ({
  totalItems: items.length,
  lowStockItems: items.filter((item) => getInventoryStockTotals(item, referenceDate).availableQuantity < item.minimumStock).length,
  expiringItems: items.filter((item) => item.lots.some((lot) => lot.status === "available" && lot.remainingQuantity > 0 && isExpiring(lot.expiresOn, referenceDate))).length,
  expiredItems: items.filter((item) => item.lots.some((lot) => lot.remainingQuantity > 0 && isExpired(lot.expiresOn, referenceDate))).length,
});

export type InventoryFilter = {
  readonly query: string;
  readonly status: InventoryDisplayStatus;
  readonly referenceDate: string;
};

export const filterInventoryItems = (
  items: readonly InventoryItemView[],
  filter: InventoryFilter,
): readonly InventoryItemView[] => {
  const query = filter.query.trim().toLocaleLowerCase("ko-KR");
  return items.filter((item) => {
    const matchesQuery = query.length === 0 || [item.name, item.category, item.specification]
      .some((value) => value.toLocaleLowerCase("ko-KR").includes(query));
    const matchesStatus = filter.status === "all" || getInventoryItemStatus(item, filter.referenceDate) === filter.status;
    return matchesQuery && matchesStatus;
  });
};
