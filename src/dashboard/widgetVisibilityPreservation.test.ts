import { describe, expect, it } from "vitest";
import { createDefaultDashboardLayout } from "./layouts";
import { hideWidget, restoreWidget } from "./layoutTransforms";
import { widgetTypes } from "./types";

describe("widget visibility preserves saved customization", () => {
  it.each(widgetTypes)("restores %s at its saved position and size without touching other widgets", type => {
    const base = createDefaultDashboardLayout();
    const layout = { ...base, widgets: base.widgets.map(widget => widget.type === type
      ? { ...widget, x: 1, y: 27, settings: { syntheticNote: "합성 보존 확인" } }
      : widget) };
    const target = layout.widgets.find(widget => widget.type === type);
    if (target === undefined) throw new Error("Registered widget missing from default layout");
    const before = structuredClone(layout);
    const hidden = hideWidget(layout, target.id);
    expect(hidden.widgets.find(widget => widget.id === target.id)).toEqual({ ...target, visible: false });
    const restored = restoreWidget(hidden, type);
    expect(restored.widgets.find(widget => widget.id === target.id)).toEqual({ ...target, visible: true });
    expect(restored.widgets.filter(widget => widget.id !== target.id)).toEqual(layout.widgets.filter(widget => widget.id !== target.id));
    expect(restored.widgets.map(widget => widget.id)).toEqual(layout.widgets.map(widget => widget.id));
    expect(layout).toEqual(before);
    expect(restoreWidget(restored, type)).toEqual(restored);
  });
});
