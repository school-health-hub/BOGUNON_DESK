import { describe, expect, it } from "vitest";
import { applyPreset } from "../components/dashboard/dashboardCanvasSupport";
import { createDashboardLayout, createDefaultDashboardLayout, defaultAppearance, defaultWidgetLayouts } from "./layouts";
import { dashboardPresets, getDashboardPreset } from "./presets";
import { parseDashboardLayoutValue } from "./storage";
import { dashboardPresetIds, widgetTypes, type WidgetLayout } from "./types";
import { widgetRegistry } from "./widgetRegistry";

const overlaps = (left: WidgetLayout, right: WidgetLayout): boolean =>
  left.x < right.x + right.w
  && left.x + left.w > right.x
  && left.y < right.y + right.h
  && left.y + left.h > right.y;

describe("dashboard presets", () => {
  it("registers the desk preset after the existing presets", () => {
    expect(dashboardPresetIds).toEqual(["default", "schedule", "work", "minimal", "desk"]);
    expect(dashboardPresets.map(({ id }) => id)).toEqual(dashboardPresetIds);
    expect(getDashboardPreset("desk").name).toBe("데스크형");
  });

  it("provides every widget exactly once in the desk preset", () => {
    const widgets = getDashboardPreset("desk").layout.widgets;
    expect(widgets.map(({ type }) => type).sort()).toEqual([...widgetTypes].sort());
    expect(new Set(widgets.map(({ id }) => id)).size).toBe(widgetTypes.length);
  });

  it("uses a valid, non-overlapping ten-row desk layout", () => {
    const visibleWidgets = getDashboardPreset("desk").layout.widgets.filter(({ visible }) => visible);

    for (const widget of visibleWidgets) {
      const definition = widgetRegistry[widget.type];
      expect(widget.w).toBeGreaterThanOrEqual(definition.minW);
      expect(widget.h).toBeGreaterThanOrEqual(definition.minH);
      if (definition.maxW !== undefined) expect(widget.w).toBeLessThanOrEqual(definition.maxW);
      if (definition.maxH !== undefined) expect(widget.h).toBeLessThanOrEqual(definition.maxH);
    }

    for (const [index, widget] of visibleWidgets.entries()) {
      for (const other of visibleWidgets.slice(index + 1)) {
        expect(overlaps(widget, other)).toBe(false);
      }
    }

    expect(Math.max(...visibleWidgets.map(({ y, h }) => y + h))).toBe(10);
  });

  it("matches the requested desk hierarchy and visibility", () => {
    const widgets = getDashboardPreset("desk").layout.widgets;
    const byType = new Map(widgets.map((widget) => [widget.type, widget]));

    expect(byType.get("clock")).toMatchObject({ x: 0, y: 0, w: 3, h: 2, visible: true });
    expect(byType.get("weather")).toMatchObject({ x: 3, y: 0, w: 3, h: 2, visible: true });
    expect(byType.get("today-summary")).toMatchObject({ x: 7, y: 0, w: 5, h: 2, visible: true });
    expect(byType.get("monthly-calendar")).toMatchObject({ x: 0, y: 2, w: 4, h: 5, visible: true });
    expect(byType.get("today-tasks")).toMatchObject({ x: 5, y: 2, w: 3, h: 5, visible: true });
    expect(byType.get("dday")).toMatchObject({ x: 9, y: 2, w: 3, h: 2, visible: true });
    expect(byType.get("quick-memo")).toMatchObject({ x: 9, y: 4, w: 3, h: 3, visible: true });
    expect(byType.get("weekly-schedule")).toMatchObject({ x: 0, y: 7, w: 5, h: 3, visible: true });
    expect(byType.get("upcoming-schedule")).toMatchObject({ x: 6, y: 7, w: 3, h: 3, visible: true });
    expect(byType.get("meal")).toMatchObject({ x: 9, y: 7, w: 3, h: 3, visible: true });
    expect(
      widgets.filter(({ visible }) => !visible).map(({ type }) => type).sort(),
    ).toEqual(["notifications", "priority-task", "quick-launcher"]);
  });

  it("keeps the balanced layout as the separate default preset", () => {
    const balanced = createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default");

    expect(getDashboardPreset("default").layout).toEqual(balanced);
    expect(getDashboardPreset("default").layout).not.toEqual(getDashboardPreset("desk").layout);
  });

  it("keeps the current appearance when applying the desk preset", () => {
    const current = {
      ...createDefaultDashboardLayout(),
      appearance: { background: "lavender", cardStyle: "flat", cornerStyle: "compact" },
    } as const;
    const applied = applyPreset(current, "desk", () => true);

    expect(applied.presetId).toBe("desk");
    expect(applied.appearance).toEqual(current.appearance);
  });

  it("accepts desk in persisted v1 layouts without regressing legacy layouts", () => {
    const desk = getDashboardPreset("desk").layout;
    expect(parseDashboardLayoutValue(desk)?.presetId).toBe("desk");

    const legacy = createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default");
    expect(parseDashboardLayoutValue(legacy)?.widgets).toEqual(legacy.widgets);
  });
});
