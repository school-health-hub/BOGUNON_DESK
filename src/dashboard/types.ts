import type { ComponentType } from "react";

export const WIDGET_LAYOUT_VERSION = 1;

export const widgetTypes = [
  "clock",
  "today-summary",
  "priority-task",
  "monthly-calendar",
  "today-tasks",
  "quick-memo",
  "quick-launcher",
  "upcoming-schedule",
  "dday",
  "weekly-schedule",
  "notifications",
  "meal",
  "weather",
] as const;

export type WidgetType = (typeof widgetTypes)[number];

export type WidgetCategory = "basic" | "schedule" | "work";

export type AppearanceBackground = "mint" | "white" | "warm-gray" | "blue-gray" | "lavender";

export type CardStyle = "default" | "soft" | "flat";

export type CornerStyle = "compact" | "soft";

export type WidgetSize = {
  readonly w: number;
  readonly h: number;
};

export type WidgetLayout = {
  readonly id: string;
  readonly type: WidgetType;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly visible: boolean;
  readonly settings?: Readonly<Record<string, unknown>>;
};

export type DashboardAppearance = {
  readonly background: AppearanceBackground;
  readonly cardStyle: CardStyle;
  readonly cornerStyle: CornerStyle;
};

export type DashboardLayout = {
  readonly version: typeof WIDGET_LAYOUT_VERSION;
  readonly presetId?: DashboardPresetId;
  readonly widgets: readonly WidgetLayout[];
  readonly appearance: DashboardAppearance;
};

export const dashboardPresetIds = ["default", "schedule", "work", "minimal", "desk"] as const;

export type DashboardPresetId = (typeof dashboardPresetIds)[number];

export type WidgetDefinition = {
  readonly type: WidgetType;
  readonly title: string;
  readonly description: string;
  readonly category: WidgetCategory;
  readonly component: ComponentType;
  readonly icon: ComponentType<{ readonly size?: number; readonly strokeWidth?: number }>;
  readonly defaultSize: WidgetSize;
  readonly minW: number;
  readonly minH: number;
  readonly maxW?: number;
  readonly maxH?: number;
  readonly singleton: true;
};
