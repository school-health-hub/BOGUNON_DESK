// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { applyGridLayout, calculateGridMetrics, createSessionStorageAdapter, defaultSurfaceLayout, editedSurfaceLayout, parseSurfaceLayout, setWidgetVisibility, SURFACE_PREVIEW_STORAGE_KEY, toGridLayout } from "./layout";

describe("surface layout", () => {
  it("restores a hidden widget below an occupied former position without moving existing widgets", () => {
    const hidden = defaultSurfaceLayout.widgets.reduce((layout, widget) =>
      widget.id === "calendar" ? layout : setWidgetVisibility(layout, widget.id, false), defaultSurfaceLayout);
    const resized = applyGridLayout(hidden, [{ i: "calendar", x: 0, y: 0, w: 12, h: 8 }]);
    const restored = setWidgetVisibility(resized, "clock", true);
    expect(restored.widgets.find(({ id }) => id === "clock")).toMatchObject({ y: 8, visible: true });
    expect(restored.widgets.find(({ id }) => id === "calendar")).toEqual(resized.widgets.find(({ id }) => id === "calendar"));
  });
  it("fits the default and editing layouts inside the available viewport height", () => {
    expect(calculateGridMetrics(defaultSurfaceLayout, 768, false)).toEqual({ rows: 7, rowHeight: 82, pixelHeight: 646 });
    expect(calculateGridMetrics(editedSurfaceLayout, 900, true)).toEqual({ rows: 9, rowHeight: 69, pixelHeight: 717 });
  });

  it("starts with a compact calendar while keeping every widget resizable", () => {
    expect(defaultSurfaceLayout.widgets.find(({ id }) => id === "calendar")).toMatchObject({ width: 6, height: 6 });
    expect(toGridLayout(defaultSurfaceLayout).find(({ i }) => i === "calendar")).toMatchObject({ minW: 5, minH: 5, maxW: 12, maxH: 8 });
    expect(toGridLayout(defaultSurfaceLayout).find(({ i }) => i === "launcher")).toMatchObject({ minW: 4, minH: 2 });
    expect(toGridLayout(defaultSurfaceLayout).find(({ i }) => i === "tasks")).toMatchObject({ minW: 4, minH: 3 });
  });

  it("keeps every default widget inside the twelve-column boundary", () => {
    for (const layout of [defaultSurfaceLayout, editedSurfaceLayout]) {
      expect(layout.widgets).toHaveLength(6);
      for (const widget of layout.widgets) {
        expect(widget.x).toBeGreaterThanOrEqual(0);
        expect(widget.x + widget.width).toBeLessThanOrEqual(12);
      }
    }
  });

  it("applies bounded grid movement and preserves hidden widgets", () => {
    const hidden = setWidgetVisibility(defaultSurfaceLayout, "weather", false);
    const moved = applyGridLayout(hidden, [{ i: "clock", x: 0, y: 8, w: 4, h: 2 }]);
    expect(moved.widgets.find(({ id }) => id === "clock")).toMatchObject({ x: 0, y: 8, width: 4, height: 2 });
    expect(moved.widgets.find(({ id }) => id === "weather")?.visible).toBe(false);
  });

  it("rejects duplicate, incomplete, and out-of-bound layouts", () => {
    expect(parseSurfaceLayout({ ...defaultSurfaceLayout, widgets: defaultSurfaceLayout.widgets.slice(0, 5) })).toBeNull();
    expect(parseSurfaceLayout({ ...defaultSurfaceLayout, widgets: defaultSurfaceLayout.widgets.map((widget) => ({ ...widget, id: "clock" })) })).toBeNull();
    expect(parseSurfaceLayout({ ...defaultSurfaceLayout, widgets: defaultSurfaceLayout.widgets.map((widget) => widget.id === "clock" ? { ...widget, x: 11, width: 3 } : widget) })).toBeNull();
  });

  it("uses only the isolated preview session key", () => {
    const storage = window.sessionStorage;
    storage.clear();
    const adapter = createSessionStorageAdapter(storage);
    adapter.save(defaultSurfaceLayout);
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe(SURFACE_PREVIEW_STORAGE_KEY);
    expect(adapter.load()).toEqual(defaultSurfaceLayout);
  });
});
