import type { DashboardAppearance, DashboardLayout, WidgetLayout } from "./types";
import { WIDGET_LAYOUT_VERSION } from "./types";

export const defaultAppearance = {
  background: "blue-gray",
  cardStyle: "default",
  cornerStyle: "soft",
} as const satisfies DashboardAppearance;

export const defaultWidgetLayouts = [
  { id: "widget-clock", type: "clock", x: 0, y: 0, w: 3, h: 2, visible: true },
  { id: "widget-today-summary", type: "today-summary", x: 3, y: 0, w: 5, h: 2, visible: true },
  { id: "widget-priority-task", type: "priority-task", x: 8, y: 0, w: 4, h: 2, visible: true },
  { id: "widget-monthly-calendar", type: "monthly-calendar", x: 0, y: 2, w: 5, h: 5, visible: true },
  { id: "widget-today-tasks", type: "today-tasks", x: 5, y: 2, w: 4, h: 5, visible: true },
  { id: "widget-upcoming-schedule", type: "upcoming-schedule", x: 9, y: 2, w: 3, h: 3, visible: true },
  { id: "widget-dday", type: "dday", x: 9, y: 5, w: 3, h: 2, visible: true },
  { id: "widget-weekly-schedule", type: "weekly-schedule", x: 0, y: 7, w: 6, h: 3, visible: true },
  { id: "widget-quick-memo", type: "quick-memo", x: 6, y: 7, w: 3, h: 3, visible: true },
  { id: "widget-quick-launcher", type: "quick-launcher", x: 9, y: 15, w: 3, h: 3, visible: false },
  { id: "widget-notifications", type: "notifications", x: 9, y: 7, w: 3, h: 3, visible: true },
  { id: "widget-meal", type: "meal", x: 9, y: 10, w: 3, h: 3, visible: false },
  { id: "widget-weather", type: "weather", x: 9, y: 13, w: 3, h: 2, visible: false },
] as const satisfies readonly WidgetLayout[];

export const deskWidgetLayouts = [
  { id: "widget-clock", type: "clock", x: 8, y: 0, w: 2, h: 2, visible: true },
  { id: "widget-today-summary", type: "today-summary", x: 8, y: 10, w: 4, h: 2, visible: true },
  { id: "widget-priority-task", type: "priority-task", x: 8, y: 2, w: 4, h: 2, visible: true },
  { id: "widget-monthly-calendar", type: "monthly-calendar", x: 0, y: 0, w: 8, h: 5, visible: true },
  { id: "widget-today-tasks", type: "today-tasks", x: 0, y: 7, w: 4, h: 2, visible: true },
  { id: "widget-upcoming-schedule", type: "upcoming-schedule", x: 5, y: 9, w: 3, h: 3, visible: true },
  { id: "widget-dday", type: "dday", x: 8, y: 4, w: 4, h: 2, visible: true },
  { id: "widget-weekly-schedule", type: "weekly-schedule", x: 0, y: 5, w: 8, h: 2, visible: true },
  { id: "widget-quick-memo", type: "quick-memo", x: 0, y: 9, w: 5, h: 3, visible: true },
  { id: "widget-quick-launcher", type: "quick-launcher", x: 8, y: 6, w: 4, h: 4, visible: true },
  { id: "widget-notifications", type: "notifications", x: 8, y: 12, w: 4, h: 3, visible: false },
  { id: "widget-meal", type: "meal", x: 4, y: 7, w: 4, h: 2, visible: true },
  { id: "widget-weather", type: "weather", x: 10, y: 0, w: 2, h: 2, visible: true },
] as const satisfies readonly WidgetLayout[];

const cloneWidgets = (widgets: readonly WidgetLayout[]): readonly WidgetLayout[] =>
  widgets.map((widget) => ({ ...widget, settings: widget.settings === undefined ? undefined : { ...widget.settings } }));

export const createDashboardLayout = (
  widgets: readonly WidgetLayout[] = defaultWidgetLayouts,
  appearance: DashboardAppearance = defaultAppearance,
  presetId: DashboardLayout["presetId"] = "default",
): DashboardLayout => ({
  ...(widgets === deskWidgetLayouts ? { gridProfile: "dense-desk-v2" } as const : {}),
  version: WIDGET_LAYOUT_VERSION,
  presetId,
  widgets: cloneWidgets(widgets),
  appearance: { ...appearance },
});

export const createDefaultDashboardLayout = (): DashboardLayout =>
  createDashboardLayout(deskWidgetLayouts, defaultAppearance, "desk");

export const defaultDashboardLayout = createDefaultDashboardLayout();
