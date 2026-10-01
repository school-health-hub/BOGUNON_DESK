import { describe, expect, it } from "vitest";
import {
  createDashboardLayout,
  createDefaultDashboardLayout,
  defaultAppearance,
  defaultDashboardLayout,
  defaultWidgetLayouts,
} from "./layouts";
import { getDashboardPreset } from "./presets";
import { parseDashboardLayout, parseDashboardLayoutValue } from "./storage";
import { WIDGET_LAYOUT_VERSION } from "./types";

describe("dashboard storage defaults", () => {
  it("uses the desk layout when no saved workspace exists", () => {
    const expected = getDashboardPreset("desk").layout;

    expect(parseDashboardLayout(null)).toEqual(expected);
    expect(defaultDashboardLayout).toEqual(expected);
    expect(createDefaultDashboardLayout()).toEqual(expected);
    expect(createDefaultDashboardLayout().presetId).toBe("desk");
    expect(createDefaultDashboardLayout().version).toBe(WIDGET_LAYOUT_VERSION);
    expect(WIDGET_LAYOUT_VERSION).toBe(1);
  });

  it.each([
    "{invalid-json",
    JSON.stringify({ version: 99, widgets: [], appearance: defaultAppearance }),
  ])("uses the desk layout when saved workspace cannot be parsed", (raw) => {
    expect(parseDashboardLayout(raw)).toEqual(getDashboardPreset("desk").layout);
  });

  it("preserves a valid saved default preset and its balanced geometry", () => {
    const saved = createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default");

    expect(parseDashboardLayout(JSON.stringify(saved))).toEqual(saved);
  });

  it("preserves custom saved geometry when presetId is absent", () => {
    const customWidgets = defaultWidgetLayouts.map((widget) => widget.type === "clock"
      ? { ...widget, x: 2, y: 12 }
      : widget);
    const parsed = parseDashboardLayoutValue({
      version: WIDGET_LAYOUT_VERSION,
      appearance: defaultAppearance,
      widgets: customWidgets,
    });

    expect(parsed?.widgets).toEqual(customWidgets);
    expect(parsed?.widgets.find(({ type }) => type === "clock")).toMatchObject({ x: 2, y: 12 });
  });

  it("supplements legacy meal and weather widgets as hidden without moving saved widgets", () => {
    const legacyWidgets = defaultWidgetLayouts
      .filter(({ type }) => type !== "meal" && type !== "weather")
      .map((widget) => widget.type === "clock" ? { ...widget, x: 2, y: 12 } : widget);
    const parsed = parseDashboardLayoutValue({
      version: WIDGET_LAYOUT_VERSION,
      presetId: "default",
      appearance: defaultAppearance,
      widgets: legacyWidgets,
    });

    expect(parsed?.widgets.find(({ type }) => type === "clock")).toMatchObject({ x: 2, y: 12 });
    expect(parsed?.widgets.find(({ type }) => type === "meal")).toMatchObject({ visible: false });
    expect(parsed?.widgets.find(({ type }) => type === "weather")).toMatchObject({ visible: false });
  });
});
