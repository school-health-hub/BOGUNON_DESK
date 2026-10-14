import type { Layout } from "react-grid-layout";
import { deskWidgetLayouts } from "./layouts";
import { mergeGridLayout } from "./layoutTransforms";
import type { DashboardLayout, WidgetLayout } from "./types";

export const isCanonicalDeskLayout = (layout: DashboardLayout): boolean =>
  layout.version === 1 && layout.presetId === "desk" && layout.widgets.length === deskWidgetLayouts.length &&
  deskWidgetLayouts.every((expected) => layout.widgets.some((widget) =>
    widget.id === expected.id && widget.type === expected.type && widget.visible === expected.visible &&
    widget.x === expected.x && widget.y === expected.y && widget.w === expected.w && widget.h === expected.h &&
    Object.keys(widget.settings ?? {}).length === 0));

export const resolveDeskGeometry = (layout: DashboardLayout, viewportWidth: number) => {
  const dense = layout.gridProfile === "dense-desk-v2";
  const extraRows = viewportWidth >= 1800 ? 2 : viewportWidth >= 1500 ? 1 : 0;
  const widgets: readonly WidgetLayout[] = dense && isCanonicalDeskLayout(layout) ? layout.widgets.map((widget) => {
    if (widget.type === "monthly-calendar") return { ...widget, h: widget.h + extraRows };
    return widget.x < 8 ? { ...widget, y: widget.y + extraRows } : widget;
  }) : layout.widgets;
  return { dense, widgets, rowHeight: 40 + extraRows * 2, margin: 10 + extraRows * 2 };
};

export const mergeRenderedGridLayout = (current: DashboardLayout, rendered: readonly WidgetLayout[], next: Layout): DashboardLayout => {
  const visible = rendered.filter((widget) => widget.visible);
  const unchanged = visible.length === next.length && visible.every((widget) => next.some((item) =>
    item.i === widget.id && item.x === widget.x && item.y === widget.y && item.w === widget.w && item.h === widget.h));
  if (unchanged) return current;
  const geometryById = new Map(rendered.map((widget) => [widget.id,widget]));
  const widgets = current.widgets.map((widget) => {
    const geometry = geometryById.get(widget.id);
    return geometry === undefined ? widget : { ...widget, x:geometry.x, y:geometry.y, w:geometry.w, h:geometry.h };
  });
  return mergeGridLayout({ ...current, widgets }, next.filter((item) => current.widgets.some((widget) => widget.visible && widget.id === item.i)));
};
