import { describe, expect, it } from "vitest";
import { defaultWidgetLayouts } from "./layouts";
import { dashboardPresets } from "./presets";
import { parseDashboardLayoutValue } from "./storage";
import { assertWidgetRegistryIntegrity, widgetRegistry } from "./widgetRegistry";
import { MEAL_SCHOOL_SETTINGS_ACTION_ID } from "../widgets/MealWidget";

describe("meal widget registration", () => {
  it("registers a hidden meal widget with compatible sizing", () => {
    const widget = defaultWidgetLayouts.find(({ type }) => type === "meal");
    expect(widget).toMatchObject({ id: "widget-meal", visible: false, w: 3, h: 3 });
    expect(widgetRegistry.meal.defaultSize).toEqual({ w: 3, h: 3 });
    expect(() => assertWidgetRegistryIntegrity()).not.toThrow();
  });

  it("keeps the meal widget restorable and only shows it in the desk preset", () => {
    for (const preset of dashboardPresets) {
      expect(preset.layout.widgets.find(({ type }) => type === "meal")?.visible).toBe(preset.id === "desk");
    }
  });

  it("supplements a legacy v1 layout without moving existing widgets", () => {
    const legacyWidgets = defaultWidgetLayouts
      .filter(({ type }) => type !== "meal")
      .map((widget, index) => index === 0 ? { ...widget, x: 2, y: 12 } : widget);
    const parsed = parseDashboardLayoutValue({
      version: 1,
      presetId: "default",
      appearance: { background: "blue-gray", cardStyle: "default", cornerStyle: "soft" },
      widgets: legacyWidgets,
    });

    expect(parsed?.widgets.find(({ type }) => type === "clock")).toMatchObject({ x: 2, y: 12 });
    expect(parsed?.widgets.find(({ type }) => type === "meal")).toMatchObject({ visible: false, w: 3, h: 3 });
  });

  it("reuses the registered BOGUNON school settings action", () => {
    expect(MEAL_SCHOOL_SETTINGS_ACTION_ID).toBe("bogunon-school-settings");
  });
});
