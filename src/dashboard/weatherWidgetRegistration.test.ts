import { describe, expect, it } from "vitest";
import { defaultWidgetLayouts } from "./layouts";
import { dashboardPresets } from "./presets";
import { parseDashboardLayoutValue } from "./storage";
import { widgetRegistry } from "./widgetRegistry";
import { WEATHER_SCHOOL_SETTINGS_ACTION_ID } from "../widgets/WeatherWidget";

describe("weather widget registration", () => {
  it("registers a hidden 3x2 singleton default", () => {
    expect(widgetRegistry.weather).toMatchObject({ defaultSize: { w: 3, h: 2 }, minW: 3, minH: 2, maxW: 5, maxH: 3, singleton: true });
    expect(defaultWidgetLayouts.find(({ type }) => type === "weather")).toMatchObject({ visible: false, w: 3, h: 2 });
  });

  it("includes weather in every preset and only shows it in desk", () => {
    for (const preset of dashboardPresets) {
      const weather = preset.layout.widgets.find(({ type }) => type === "weather");
      expect(weather).toBeDefined();
      expect(weather?.visible).toBe(preset.id === "desk");
    }
  });

  it("supplements legacy v1 layouts without moving stored widgets", () => {
    const legacyWidgets = defaultWidgetLayouts.filter(({ type }) => type !== "weather");
    const parsed = parseDashboardLayoutValue({ version: 1, presetId: "default", appearance: { background: "blue-gray", cardStyle: "default", cornerStyle: "soft" }, widgets: legacyWidgets });
    expect(parsed?.widgets.filter(({ type }) => type !== "weather")).toEqual(legacyWidgets);
    expect(parsed?.widgets.find(({ type }) => type === "weather")).toMatchObject({ visible: false });
  });

  it("reuses the registered BOGUNON school settings action", () => {
    expect(WEATHER_SCHOOL_SETTINGS_ACTION_ID).toBe("bogunon-school-settings");
  });
});
