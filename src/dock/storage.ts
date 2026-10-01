import {
  defaultDockItemIds,
  dockItemIds,
  DOCK_LAYOUT_VERSION,
  optionalDockItemIds,
  type DockItemId,
  type DockLayout,
  type DockLayoutItem,
} from "./types";

export const DOCK_STORAGE_KEY = "school-health-desk.dock.v2";
const LEGACY_DOCK_STORAGE_KEY = "school-health-desk.dock.v1";

type StorageLike = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDockItemId = (value: unknown): value is DockItemId =>
  typeof value === "string" && dockItemIds.some((id) => id === value);

const parseDockItem = (value: unknown): DockLayoutItem | null => {
  if (!isRecord(value) || !isDockItemId(value.id) || typeof value.visible !== "boolean") return null;
  return { id: value.id, visible: value.visible };
};

const normalizeDockItems = (items: readonly DockLayoutItem[]): readonly DockLayoutItem[] => {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const allowedItemIds: readonly DockItemId[] = [...defaultDockItemIds, ...optionalDockItemIds];
  const ordered = items.filter(
    (item, index) =>
      allowedItemIds.some((id) => id === item.id)
      && items.findIndex((candidate) => candidate.id === item.id) === index,
  );
  const missing = defaultDockItemIds.filter((id) => !itemById.has(id)).map((id) => ({ id, visible: true }));
  const missingOptional = optionalDockItemIds.filter((id) => !itemById.has(id)).map((id) => ({ id, visible: false }));
  return [...ordered, ...missing, ...missingOptional];
};

export const createDefaultDockLayout = (): DockLayout => ({
  version: DOCK_LAYOUT_VERSION,
  items: [
    ...defaultDockItemIds.map((id) => ({ id, visible: true })),
    ...optionalDockItemIds.map((id) => ({ id, visible: false })),
  ],
});

export const parseDockLayoutValue = (parsed: unknown): DockLayout | null => {
  if (
    !isRecord(parsed)
    || (parsed.version !== 1 && parsed.version !== DOCK_LAYOUT_VERSION)
    || !Array.isArray(parsed.items)
  ) return null;
  const items = parsed.items.map(parseDockItem);
  if (items.some((item) => item === null)) return null;
  return {
    version: DOCK_LAYOUT_VERSION,
    items: normalizeDockItems(items.filter((item): item is DockLayoutItem => item !== null)),
  };
};

export const parseDockLayout = (raw: string | null): DockLayout => {
  if (raw === null) return createDefaultDockLayout();
  try {
    return parseDockLayoutValue(JSON.parse(raw)) ?? createDefaultDockLayout();
  } catch (error) {
    if (error instanceof SyntaxError) return createDefaultDockLayout();
    throw error;
  }
};

export const loadDockLayout = (storage: StorageLike = window.localStorage): DockLayout => {
  const current = storage.getItem(DOCK_STORAGE_KEY);
  return parseDockLayout(current ?? storage.getItem(LEGACY_DOCK_STORAGE_KEY));
};

export const saveDockLayout = (layout: DockLayout, storage: StorageLike = window.localStorage): void => {
  storage.setItem(DOCK_STORAGE_KEY, JSON.stringify(layout));
};
