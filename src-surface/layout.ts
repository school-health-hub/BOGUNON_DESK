import type { Layout } from "react-grid-layout";
import { surfaceWidgetIds, type SurfaceWidgetId } from "./projection";

export const SURFACE_LAYOUT_VERSION = 1 as const;
export const SURFACE_PREVIEW_STORAGE_KEY = "bogunon.desktop-surface.synthetic-preview-layout.v1";

export type SurfaceWidgetLayout = Readonly<{
  id: SurfaceWidgetId;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}>;
export type SurfaceLayout = Readonly<{ version: typeof SURFACE_LAYOUT_VERSION; widgets: readonly SurfaceWidgetLayout[] }>;
export type SurfaceLayoutStorage = Readonly<{ load: () => SurfaceLayout | null; save: (layout: SurfaceLayout) => void }>;

const GRID_MARGIN = 12;
const GRID_ROW_HEIGHT = 88;
const MIN_GRID_ROW_HEIGHT = 52;

const widgetMinimums: Readonly<Record<SurfaceWidgetId, Readonly<{ width: number; height: number }>>> = {
  calendar: { width: 5, height: 5 },
  tasks: { width: 4, height: 3 },
  dday: { width: 2, height: 2 },
  clock: { width: 3, height: 2 },
  weather: { width: 3, height: 2 },
  launcher: { width: 4, height: 2 },
};

export type SurfaceGridMetrics = Readonly<{ rows: number; rowHeight: number; pixelHeight: number }>;

export const calculateGridMetrics = (layout: SurfaceLayout, viewportHeight: number, editing: boolean): SurfaceGridMetrics => {
  const rows = Math.max(...layout.widgets.filter(({ visible }) => visible).map(({ y, height }) => y + height), 1);
  const reservedHeight = editing ? 178 : 122;
  const availableHeight = Math.max(MIN_GRID_ROW_HEIGHT * rows + GRID_MARGIN * (rows - 1), viewportHeight - reservedHeight);
  const rowHeight = Math.min(GRID_ROW_HEIGHT, Math.max(MIN_GRID_ROW_HEIGHT,
    Math.floor((availableHeight - GRID_MARGIN * (rows - 1)) / rows)));
  return { rows, rowHeight, pixelHeight: rowHeight * rows + GRID_MARGIN * (rows - 1) };
};

export const defaultSurfaceLayout: SurfaceLayout = {
  version: SURFACE_LAYOUT_VERSION,
  widgets: [
    { id: "calendar", x: 0, y: 0, width: 6, height: 6, visible: true },
    { id: "clock", x: 6, y: 0, width: 3, height: 2, visible: true },
    { id: "weather", x: 9, y: 0, width: 3, height: 2, visible: true },
    { id: "tasks", x: 6, y: 2, width: 6, height: 3, visible: true },
    { id: "dday", x: 6, y: 5, width: 2, height: 2, visible: true },
    { id: "launcher", x: 8, y: 5, width: 4, height: 2, visible: true },
  ],
};

export const editedSurfaceLayout: SurfaceLayout = {
  version: SURFACE_LAYOUT_VERSION,
  widgets: [
    { id: "clock", x: 0, y: 0, width: 4, height: 2, visible: true },
    { id: "weather", x: 4, y: 0, width: 3, height: 2, visible: true },
    { id: "dday", x: 7, y: 0, width: 5, height: 2, visible: true },
    { id: "tasks", x: 0, y: 2, width: 4, height: 4, visible: true },
    { id: "calendar", x: 4, y: 2, width: 8, height: 7, visible: true },
    { id: "launcher", x: 0, y: 6, width: 4, height: 3, visible: true },
  ],
};

const isFiniteInteger = (value: unknown): value is number => Number.isInteger(value) && Number.isFinite(value);

export const parseSurfaceLayout = (value: unknown): SurfaceLayout | null => {
  if (typeof value !== "object" || value === null) return null;
  const version = Reflect.get(value, "version");
  const candidateWidgets = Reflect.get(value, "widgets");
  if (version !== SURFACE_LAYOUT_VERSION || !Array.isArray(candidateWidgets)) return null;
  const parsed = candidateWidgets.map((widget): SurfaceWidgetLayout | null => {
    if (typeof widget !== "object" || widget === null) return null;
    const idValue = Reflect.get(widget, "id");
    const x = Reflect.get(widget, "x");
    const y = Reflect.get(widget, "y");
    const width = Reflect.get(widget, "width");
    const height = Reflect.get(widget, "height");
    const visible = Reflect.get(widget, "visible");
    const id = surfaceWidgetIds.find((entry) => entry === idValue);
    if (id === undefined || !isFiniteInteger(x) || !isFiniteInteger(y)
      || !isFiniteInteger(width) || !isFiniteInteger(height) || typeof visible !== "boolean") return null;
    if (x < 0 || y < 0 || width < 2 || height < 2 || x + width > 12) return null;
    return { id, x, y, width, height, visible };
  });
  if (parsed.some((widget) => widget === null) || parsed.length !== surfaceWidgetIds.length) return null;
  const widgets = parsed.filter((widget): widget is SurfaceWidgetLayout => widget !== null);
  if (new Set(widgets.map(({ id }) => id)).size !== surfaceWidgetIds.length) return null;
  return { version: SURFACE_LAYOUT_VERSION, widgets };
};

export const toGridLayout = (layout: SurfaceLayout): Layout => layout.widgets.filter(({ visible }) => visible).map((widget) => {
  const minimum = widgetMinimums[widget.id];
  return { i: widget.id, x: widget.x, y: widget.y, w: widget.width, h: widget.height, minW: minimum.width, minH: minimum.height, maxW: 12, maxH: 8 };
});
export const applyGridLayout = (current: SurfaceLayout, next: Layout): SurfaceLayout => ({
  version: SURFACE_LAYOUT_VERSION,
  widgets: current.widgets.map((widget) => {
    const changed = next.find(({ i }) => i === widget.id);
    return changed === undefined ? widget : { ...widget, x: changed.x, y: changed.y, width: changed.w, height: changed.h };
  }),
});
export const setWidgetVisibility = (current: SurfaceLayout, id: SurfaceWidgetId, visible: boolean): SurfaceLayout => ({
  version: SURFACE_LAYOUT_VERSION,
  widgets: current.widgets.map((widget) => widget.id === id ? { ...widget, visible } : widget),
});
export const createSessionStorageAdapter = (storage: Storage): SurfaceLayoutStorage => ({
  load: () => {
    const raw = storage.getItem(SURFACE_PREVIEW_STORAGE_KEY);
    if (raw === null) return null;
    try { return parseSurfaceLayout(JSON.parse(raw)); } catch (error) { if (error instanceof SyntaxError) return null; throw error; }
  },
  save: (layout) => storage.setItem(SURFACE_PREVIEW_STORAGE_KEY, JSON.stringify(layout)),
});
