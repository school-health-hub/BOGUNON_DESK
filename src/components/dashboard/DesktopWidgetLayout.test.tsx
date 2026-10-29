import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDefaultDashboardLayout } from "../../dashboard/layouts";
import { DesktopWidgetLayout } from "./DesktopWidgetLayout";

vi.mock("../../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({ state: { status: "signedOut" } }),
}));
vi.mock("./WidgetFrame", () => ({
  WidgetFrame: ({ widget }: { readonly widget: { readonly id: string } }) => <section aria-label={widget.id} />,
}));

describe("DesktopWidgetLayout compact presentation", () => {
  it("renders visible widgets in a natural full-width list without a grid callback", () => {
    // Given a saved desk in a compact window.
    const widgets = createDefaultDashboardLayout().widgets;
    const onLayoutChange = vi.fn();
    // When the presentation is rendered.
    const markup = renderToStaticMarkup(<DesktopWidgetLayout widgets={widgets} width={800} compact editing={false}
      selectedId={null} metrics={{ contentHeight: 708, rowHeight: 48, margin: 12 }}
      onLayoutChange={onLayoutChange} onHide={() => undefined} onSelect={() => undefined} />);
    // Then each visible widget is reachable in document flow, with no grid coordinates to persist.
    expect(markup).toContain("desktop-widget-stack");
    expect(markup).not.toContain("react-grid-layout");
    expect((markup.match(/data-widget-type=/g) ?? []).length).toBe(widgets.filter((widget) => widget.visible).length);
    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});
