import type { Layout, LayoutItem } from "react-grid-layout";
import { widgetRegistry } from "./widgetRegistry";
import type { DashboardLayout, WidgetLayout, WidgetType } from "./types";

const markLayoutCustom = (layout: DashboardLayout, widgets: readonly WidgetLayout[]): DashboardLayout => ({
  version: layout.version,
  appearance: layout.appearance,
  widgets,
});

export const toGridLayout = (widgets: readonly WidgetLayout[], editable: boolean): Layout =>
  widgets
    .filter((widget) => widget.visible)
    .map((widget) => {
      const definition = widgetRegistry[widget.type];
      return {
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        minW: definition.minW,
        minH: definition.minH,
        maxW: definition.maxW,
        maxH: definition.maxH,
        isDraggable: editable,
        isResizable: editable,
      } satisfies LayoutItem;
    });

export const mergeGridLayout = (current: DashboardLayout, next: Layout): DashboardLayout => {
  const gridById = new Map(next.map((item) => [item.i, item]));
  let hasGeometryChange = false;
  const widgets = current.widgets.map((widget) => {
    const gridItem = gridById.get(widget.id);
    if (gridItem === undefined) return widget;
    if (widget.x !== gridItem.x || widget.y !== gridItem.y || widget.w !== gridItem.w || widget.h !== gridItem.h) {
      hasGeometryChange = true;
    }
    return { ...widget, x: gridItem.x, y: gridItem.y, w: gridItem.w, h: gridItem.h };
  });
  return hasGeometryChange ? markLayoutCustom(current, widgets) : { ...current, widgets };
};

export const nextBottomY = (widgets: readonly WidgetLayout[]): number =>
  widgets.reduce((bottom, widget) => (widget.visible ? Math.max(bottom, widget.y + widget.h) : bottom), 0);

export const restoreWidget = (layout: DashboardLayout, type: WidgetType): DashboardLayout => markLayoutCustom(
  layout,
  layout.widgets.map((widget) =>
    widget.type === type ? { ...widget, visible: true, y: widget.visible ? widget.y : nextBottomY(layout.widgets) } : widget,
  ),
);

export const hideWidget = (layout: DashboardLayout, widgetId: string): DashboardLayout => markLayoutCustom(
  layout,
  layout.widgets.map((widget) => (widget.id === widgetId ? { ...widget, visible: false } : widget)),
);
