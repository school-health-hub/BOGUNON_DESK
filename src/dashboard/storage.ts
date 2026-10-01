import { createDashboardLayout, createDefaultDashboardLayout, defaultWidgetLayouts } from "./layouts";
import { widgetRegistry } from "./widgetRegistry";
import {
  dashboardPresetIds,
  WIDGET_LAYOUT_VERSION,
  widgetTypes,
  type AppearanceBackground,
  type CardStyle,
  type CornerStyle,
  type DashboardAppearance,
  type DashboardLayout,
  type DashboardPresetId,
  type WidgetLayout,
  type WidgetType,
} from "./types";

export const DASHBOARD_LAYOUT_STORAGE_KEY = "school-health-desk.dashboard-layout.v1";

type StorageLike = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

const appearanceBackgrounds = ["mint", "white", "warm-gray", "blue-gray", "lavender"] as const;
const cardStyles = ["default", "soft", "flat"] as const;
const cornerStyles = ["compact", "soft"] as const;
const gridColumnCount = 12;
const gridMaxRows = 40;
const defaultWidgetByType = new Map(defaultWidgetLayouts.map((widget) => [widget.type, widget]));

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringIn = <T extends string>(value: unknown, candidates: readonly T[]): value is T =>
  typeof value === "string" && candidates.some((candidate) => candidate === value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isGridInteger = (value: unknown): value is number => isFiniteNumber(value) && Number.isInteger(value);

const isWidgetType = (value: unknown): value is WidgetType => isStringIn(value, widgetTypes);

const isPresetId = (value: unknown): value is DashboardPresetId => isStringIn(value, dashboardPresetIds);

const isAppearanceBackground = (value: unknown): value is AppearanceBackground =>
  isStringIn(value, appearanceBackgrounds);

const isCardStyle = (value: unknown): value is CardStyle => isStringIn(value, cardStyles);

const isCornerStyle = (value: unknown): value is CornerStyle => isStringIn(value, cornerStyles);

const parseAppearance = (value: unknown): DashboardAppearance | null => {
  if (!isRecord(value)) return null;
  const { background, cardStyle, cornerStyle } = value;
  if (!isAppearanceBackground(background) || !isCardStyle(cardStyle) || !isCornerStyle(cornerStyle)) {
    return null;
  }
  return { background, cardStyle, cornerStyle };
};

const parseWidget = (value: unknown): WidgetLayout | null => {
  if (!isRecord(value)) return null;
  const { id, type, x, y, w, h, visible, settings } = value;
  if (
    typeof id !== "string" ||
    !isWidgetType(type) ||
    !isGridInteger(x) ||
    !isGridInteger(y) ||
    !isGridInteger(w) ||
    !isGridInteger(h) ||
    typeof visible !== "boolean"
  ) {
    return null;
  }
  const defaultWidget = defaultWidgetByType.get(type);
  const definition = widgetRegistry[type];
  if (defaultWidget === undefined || id !== defaultWidget.id) return null;
  if (
    x < 0 ||
    y < 0 ||
    w < definition.minW ||
    h < definition.minH ||
    x + w > gridColumnCount ||
    y + h > gridMaxRows ||
    (definition.maxW !== undefined && w > definition.maxW) ||
    (definition.maxH !== undefined && h > definition.maxH)
  ) {
    return null;
  }
  if (settings !== undefined) {
    if (!isRecord(settings) || Object.keys(settings).length > 0) return null;
  }
  return {
    id,
    type,
    x,
    y,
    w,
    h,
    visible,
    settings: undefined,
  };
};

const normalizeWidgets = (widgets: readonly WidgetLayout[]): readonly WidgetLayout[] => {
  const seenIds = new Set<string>();
  const seenTypes = new Set<WidgetType>();
  for (const widget of widgets) {
    if (seenIds.has(widget.id) || seenTypes.has(widget.type)) {
      return createDefaultDashboardLayout().widgets;
    }
    seenIds.add(widget.id);
    seenTypes.add(widget.type);
  }

  const widgetByType = new Map(widgets.map((widget) => [widget.type, widget]));
  return defaultWidgetLayouts.map((defaultWidget) => {
    const storedWidget = widgetByType.get(defaultWidget.type);
    return storedWidget === undefined ? { ...defaultWidget } : storedWidget;
  });
};

export const parseDashboardLayoutValue = (parsed: unknown): DashboardLayout | null => {
  if (!isRecord(parsed) || parsed.version !== WIDGET_LAYOUT_VERSION) return null;
  const appearance = parseAppearance(parsed.appearance);
  if (appearance === null || !Array.isArray(parsed.widgets)) return null;
  const widgets = parsed.widgets.map(parseWidget);
  if (widgets.some((widget) => widget === null)) return null;
  return createDashboardLayout(
    normalizeWidgets(widgets.filter((widget): widget is WidgetLayout => widget !== null)),
    appearance,
    isPresetId(parsed.presetId) ? parsed.presetId : undefined,
  );
};

export const parseDashboardLayout = (raw: string | null): DashboardLayout => {
  if (raw === null) return createDefaultDashboardLayout();
  try {
    return parseDashboardLayoutValue(JSON.parse(raw)) ?? createDefaultDashboardLayout();
  } catch (error) {
    if (error instanceof SyntaxError) return createDefaultDashboardLayout();
    throw error;
  }
};

export const loadDashboardLayout = (storage: StorageLike = window.localStorage): DashboardLayout =>
  parseDashboardLayout(storage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY));

export const saveDashboardLayout = (
  layout: DashboardLayout,
  storage: StorageLike = window.localStorage,
): void => {
  storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
};
