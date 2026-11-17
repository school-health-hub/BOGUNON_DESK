import { describe, expect, it } from "vitest";
import { createDesign07DashboardLayout, design07WidgetLayouts, design07WidgetSizeClasses } from "./design07Layout";
import { widgetRegistry } from "./widgetRegistry";

const expectedWidgets = [
  ["widget-clock", "clock", 0, 0, 2, 2, true],
  ["widget-weather", "weather", 2, 0, 2, 2, true],
  ["widget-today-summary", "today-summary", 4, 0, 5, 2, true],
  ["widget-dday", "dday", 9, 0, 3, 2, true],
  ["widget-monthly-calendar", "monthly-calendar", 0, 2, 6, 5, true],
  ["widget-today-tasks", "today-tasks", 6, 2, 3, 5, true],
  ["widget-priority-task", "priority-task", 9, 2, 3, 2, true],
  ["widget-meal", "meal", 9, 4, 3, 3, true],
  ["widget-weekly-schedule", "weekly-schedule", 0, 7, 6, 3, true],
  ["widget-quick-memo", "quick-memo", 6, 7, 3, 3, true],
  ["widget-quick-launcher", "quick-launcher", 9, 7, 3, 3, true],
  ["widget-upcoming-schedule", "upcoming-schedule", 0, 10, 5, 3, true],
  ["widget-notifications", "notifications", 9, 10, 3, 3, false],
] as const;

describe("DESIGN-07 first-run Bento layout", () => {
  it("uses the approved geometry and visibility for all thirteen widget identities", () => {
    expect(design07WidgetLayouts.map(({ id, type, x, y, w, h, visible }) =>
      [id, type, x, y, w, h, visible])).toEqual(expectedWidgets);
    expect(new Set(design07WidgetLayouts.map(({ id }) => id)).size).toBe(13);
    expect(new Set(design07WidgetLayouts.map(({ type }) => type)).size).toBe(13);
  });

  it("keeps every widget within registry and twelve-column bounds without collisions", () => {
    for (const widget of design07WidgetLayouts) {
      const definition = widgetRegistry[widget.type];
      expect(widget.w).toBeGreaterThanOrEqual(definition.minW);
      expect(widget.h).toBeGreaterThanOrEqual(definition.minH);
      expect(widget.w).toBeLessThanOrEqual(definition.maxW ?? widget.w);
      expect(widget.h).toBeLessThanOrEqual(definition.maxH ?? widget.h);
      expect(widget.x).toBeGreaterThanOrEqual(0);
      expect(widget.x + widget.w).toBeLessThanOrEqual(12);
      expect(widget.y).toBeGreaterThanOrEqual(0);
      expect(widget.y + widget.h).toBeLessThanOrEqual(40);
    }

    for (const [index, left] of design07WidgetLayouts.entries()) {
      for (const right of design07WidgetLayouts.slice(index + 1)) {
        const overlaps = left.x < right.x + right.w && left.x + left.w > right.x
          && left.y < right.y + right.h && left.y + left.h > right.y;
        expect(overlaps, `${left.id} overlaps ${right.id}`).toBe(false);
      }
    }
  });

  it("records the approved three large, four medium, and six small families", () => {
    expect(design07WidgetSizeClasses.large).toHaveLength(3);
    expect(design07WidgetSizeClasses.medium).toHaveLength(4);
    expect(design07WidgetSizeClasses.small).toHaveLength(6);
    expect(new Set(Object.values(design07WidgetSizeClasses).flat())).toEqual(
      new Set(design07WidgetLayouts.map(({ type }) => type)),
    );
  });

  it("returns independent first-run layout values", () => {
    const first = createDesign07DashboardLayout();
    const second = createDesign07DashboardLayout();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.widgets).not.toBe(second.widgets);
    expect(first.widgets).toEqual(design07WidgetLayouts);
  });
});
