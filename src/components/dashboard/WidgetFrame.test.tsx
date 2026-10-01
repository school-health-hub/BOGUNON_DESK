import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WidgetLayout } from "../../dashboard/types";
import { WidgetFrame } from "./WidgetFrame";

vi.mock("../../dashboard/widgetRegistry", () => ({
  widgetRegistry: {
    clock: {
      type: "clock",
      title: "날짜·시계",
      description: "현재 날짜와 시간을 표시합니다.",
      category: "basic",
      component: () => <div>시계 내용</div>,
      icon: () => null,
      defaultSize: { w: 3, h: 2 },
      minW: 2,
      minH: 2,
      maxW: 5,
      maxH: 3,
      singleton: true,
    },
  },
}));

const widget: WidgetLayout = {
  id: "widget-clock",
  type: "clock",
  x: 0,
  y: 0,
  w: 3,
  h: 2,
  visible: true,
};

const renderFrame = (isEditing: boolean): string => renderToStaticMarkup(
  <WidgetFrame
    isEditing={isEditing}
    isSelected={false}
    widget={widget}
    onHide={() => undefined}
    onSelect={() => undefined}
  />,
);

describe("WidgetFrame visual modes", () => {
  it("renders a transparent view wrapper without editor chrome", () => {
    const markup = renderFrame(false);

    expect(markup).toContain("widget-frame is-viewing");
    expect(markup).not.toContain("widget-frame__chrome");
    expect(markup).not.toContain("날짜·시계 이동");
    expect(markup).not.toContain("날짜·시계 숨기기");
  });

  it("keeps drag, settings, and hide controls in edit mode", () => {
    const markup = renderFrame(true);

    expect(markup).toContain("widget-frame is-editing");
    expect(markup).toContain("widget-frame__chrome");
    expect(markup).toContain("날짜·시계 이동");
    expect(markup).toContain("날짜·시계 설정 보기");
    expect(markup).toContain("날짜·시계 숨기기");
  });
});
