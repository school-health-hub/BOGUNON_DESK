import { describe, expect, it } from "vitest";
import { defaultWidgetLayouts } from "./layouts";
import { dashboardPresets } from "./presets";
import { parseDashboardLayoutValue } from "./storage";
import { WIDGET_LAYOUT_VERSION } from "./types";
import { assertWidgetRegistryIntegrity, widgetRegistry } from "./widgetRegistry";
import { QUICK_LAUNCHER_ACTIONS } from "../widgets/QuickLauncherWidget";

describe("quick launcher registration", () => {
  it("registers a default-hidden 3x3 work widget without a schema bump", () => {
    expect(WIDGET_LAYOUT_VERSION).toBe(1);
    expect(defaultWidgetLayouts.find(({ type }) => type === "quick-launcher")).toMatchObject({
      id: "widget-quick-launcher",
      visible: false,
      w: 3,
      h: 3,
    });
    expect(widgetRegistry["quick-launcher"]).toMatchObject({ category: "work", defaultSize: { w: 3, h: 3 } });
    expect(() => assertWidgetRegistryIntegrity()).not.toThrow();
  });

  it("keeps the launcher hidden in every preset", () => {
    for (const preset of dashboardPresets) {
      expect(preset.layout.widgets.find(({ type }) => type === "quick-launcher")?.visible).toBe(false);
    }
  });

  it("supplements a saved v1 layout with a hidden launcher without moving existing widgets", () => {
    const legacyWidgets = defaultWidgetLayouts
      .filter(({ type }) => type !== "quick-launcher")
      .map((widget) => widget.type === "clock" ? { ...widget, x: 2, y: 12 } : widget);
    const parsed = parseDashboardLayoutValue({
      version: 1,
      presetId: "default",
      appearance: { background: "blue-gray", cardStyle: "default", cornerStyle: "soft" },
      widgets: legacyWidgets,
    });

    expect(parsed?.widgets.find(({ type }) => type === "clock")).toMatchObject({ x: 2, y: 12 });
    expect(parsed?.widgets.find(({ type }) => type === "quick-launcher")).toMatchObject({ visible: false, w: 3, h: 3 });
  });

  it("references existing central desktop action IDs", () => {
    expect(QUICK_LAUNCHER_ACTIONS.map(({ actionId }) => actionId)).toEqual([
      "online-health-room",
      "bogunon",
      "work-portal",
      "toolbox",
    ]);
  });
});
