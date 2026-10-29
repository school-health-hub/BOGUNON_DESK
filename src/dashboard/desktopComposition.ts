import type { WidgetLayout, WidgetType } from "./types";

// Display geometry only. Stored custom layouts and widget identities are preserved.
export const desktopComposition = {
  clock: { x: 0, y: 0, w: 2, h: 2 },
  weather: { x: 2, y: 0, w: 2, h: 2 },
  "today-summary": { x: 4, y: 0, w: 5, h: 2 },
  "priority-task": { x: 9, y: 0, w: 3, h: 2 },
  "monthly-calendar": { x: 0, y: 2, w: 6, h: 5 },
  "today-tasks": { x: 6, y: 2, w: 3, h: 3 },
  "upcoming-schedule": { x: 9, y: 2, w: 3, h: 3 },
  meal: { x: 6, y: 5, w: 3, h: 2 },
  dday: { x: 9, y: 5, w: 3, h: 2 },
  "weekly-schedule": { x: 0, y: 7, w: 6, h: 3 },
  "quick-memo": { x: 6, y: 7, w: 3, h: 3 },
  "quick-launcher": { x: 9, y: 7, w: 3, h: 4 },
  notifications: { x: 9, y: 11, w: 3, h: 3 },
} as const satisfies Readonly<Record<WidgetType, Pick<WidgetLayout, "x" | "y" | "w" | "h">>>;
