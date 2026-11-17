// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDefaultDashboardLayout } from "../../dashboard/layouts";
import { WidgetLibraryDrawer } from "./WidgetLibraryDrawer";

afterEach(cleanup);

it("offers hide and restore actions without changing the widget registry", () => {
  const layout = createDefaultDashboardLayout();
  const onHide = vi.fn();
  const onRestore = vi.fn();
  render(<WidgetLibraryDrawer widgets={layout.widgets} onClose={vi.fn()} onHide={onHide} onRestore={onRestore} />);

  expect(screen.getAllByRole("article")).toHaveLength(13);
  const visibleButton = screen.getAllByRole("button", { name: "숨기기" })[0];
  expect(visibleButton.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(visibleButton);
  expect(onHide).toHaveBeenCalledOnce();
});
