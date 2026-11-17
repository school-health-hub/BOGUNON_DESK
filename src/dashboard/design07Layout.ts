import { createDashboardLayout, defaultAppearance } from "./layouts";
import type { WidgetLayout, WidgetType } from "./types";

export const design07WidgetLayouts = [
  { id: "widget-clock", type: "clock", x: 0, y: 0, w: 2, h: 2, visible: true },
  { id: "widget-weather", type: "weather", x: 2, y: 0, w: 2, h: 2, visible: true },
  { id: "widget-today-summary", type: "today-summary", x: 4, y: 0, w: 5, h: 2, visible: true },
  { id: "widget-dday", type: "dday", x: 9, y: 0, w: 3, h: 2, visible: true },
  { id: "widget-monthly-calendar", type: "monthly-calendar", x: 0, y: 2, w: 6, h: 5, visible: true },
  { id: "widget-today-tasks", type: "today-tasks", x: 6, y: 2, w: 3, h: 5, visible: true },
  { id: "widget-priority-task", type: "priority-task", x: 9, y: 2, w: 3, h: 2, visible: true },
  { id: "widget-meal", type: "meal", x: 9, y: 4, w: 3, h: 3, visible: true },
  { id: "widget-weekly-schedule", type: "weekly-schedule", x: 0, y: 7, w: 6, h: 3, visible: true },
  { id: "widget-quick-memo", type: "quick-memo", x: 6, y: 7, w: 3, h: 3, visible: true },
  { id: "widget-quick-launcher", type: "quick-launcher", x: 9, y: 7, w: 3, h: 3, visible: true },
  { id: "widget-upcoming-schedule", type: "upcoming-schedule", x: 0, y: 10, w: 5, h: 3, visible: true },
  { id: "widget-notifications", type: "notifications", x: 9, y: 10, w: 3, h: 3, visible: false },
] as const satisfies readonly WidgetLayout[];

export const design07WidgetSizeClasses = {
  large: ["monthly-calendar", "weekly-schedule", "today-tasks"],
  medium: ["today-summary", "quick-memo", "quick-launcher", "upcoming-schedule"],
  small: ["clock", "priority-task", "dday", "notifications", "meal", "weather"],
} as const satisfies Readonly<Record<"large" | "medium" | "small", readonly WidgetType[]>>;

export const createDesign07DashboardLayout = () =>
  createDashboardLayout(design07WidgetLayouts, defaultAppearance);
