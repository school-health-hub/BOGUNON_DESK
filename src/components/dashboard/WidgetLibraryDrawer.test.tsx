// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDefaultDashboardLayout } from "../../dashboard/layouts";
import { WidgetLibraryDrawer } from "./WidgetLibraryDrawer";
import { widgetDefinitions, widgetLibraryCategories } from "../../dashboard/widgetRegistry";

afterEach(cleanup);

it("shows every registered widget as a named controlled switch in its category", () => {
  const layout = createDefaultDashboardLayout();
  const onHide = vi.fn();
  const onRestore = vi.fn();
  render(<WidgetLibraryDrawer widgets={layout.widgets} onClose={vi.fn()} onHide={onHide} onRestore={onRestore} />);

  expect(screen.getAllByRole("article")).toHaveLength(13);
  expect(screen.getAllByRole("switch")).toHaveLength(13);
  for (const definition of widgetDefinitions) {
    const control = screen.getByRole("switch", { name: `${definition.title} 표시` });
    expect(control.getAttribute("aria-checked")).toBe(String(layout.widgets.some(widget => widget.type === definition.type && widget.visible)));
    expect(screen.getByText(definition.description)).toBeTruthy();
  }
  for (const category of widgetLibraryCategories) {
    const group = screen.getByRole("region", { name: category.title });
    expect(within(group).getAllByRole("switch")).toHaveLength(widgetDefinitions.filter(widget => widget.category === category.id).length);
  }
});

it("routes hide and restore by type without mutating widgets or optimistic state", () => {
  const layout = createDefaultDashboardLayout();
  const before = structuredClone(layout);
  const onHide = vi.fn(), onRestore = vi.fn();
  const props = { widgets: layout.widgets, onClose: vi.fn(), onHide, onRestore };
  const view = render(<WidgetLibraryDrawer {...props} />);
  const clock = screen.getByRole("switch", { name: "날짜·시계 표시" });
  fireEvent.click(clock);
  expect(onHide).toHaveBeenCalledWith("clock");
  expect(clock.getAttribute("aria-checked")).toBe("true");
  view.rerender(<WidgetLibraryDrawer {...props} widgets={layout.widgets.map(widget => widget.type === "clock" ? { ...widget, visible: false } : widget)} />);
  expect(clock.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(clock);
  expect(onRestore).toHaveBeenCalledWith("clock");
  expect(layout).toEqual(before);
});

it("keeps the close action separate from widget selection", () => {
  const onClose = vi.fn(), onHide = vi.fn(), onRestore = vi.fn();
  render(<WidgetLibraryDrawer widgets={createDefaultDashboardLayout().widgets} onClose={onClose} onHide={onHide} onRestore={onRestore} />);
  fireEvent.click(screen.getByRole("button", { name: "위젯 편집 닫기" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onHide).not.toHaveBeenCalled();
  expect(onRestore).not.toHaveBeenCalled();
});
