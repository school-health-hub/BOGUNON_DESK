import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultWidgetLayouts } from "../dashboard/layouts";
import { widgetRegistry } from "../dashboard/widgetRegistry";
import type { WorkspaceData, WorkspaceDataState } from "../workspace-data/types";
import { DDAY_EMPTY_MESSAGE, DdayWidget } from "./DdayWidget";

const hooks = vi.hoisted(() => ({
  state: { status: "loading" } as WorkspaceDataState,
  now: new Date(2026, 8, 23, 14, 30),
}));

vi.mock("../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({ state: hooks.state }),
}));

vi.mock("../dashboard/WidgetSessionContext", () => ({
  useWidgetSession: () => ({ now: hooks.now }),
}));

const data = (ddayItems: WorkspaceData["ddayItems"]): WorkspaceData => ({
  todayTasks: [],
  calendarEvents: [],
  weekSchedule: [],
  upcomingEvents: [],
  ddayItems,
  notifications: [],
  inboxItems: [],
  summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 },
});

const renderWidget = (): string => renderToStaticMarkup(createElement(DdayWidget));

describe("D-Day widget", () => {
  beforeEach(() => {
    hooks.state = { status: "loading" };
  });

  it.each([
    ["loading", "BOGUNON 데이터를 불러오는 중입니다."],
    ["signedOut", "설정에서 Google 계정을 연결하면 BOGUNON 데이터를 볼 수 있습니다."],
    ["error", "데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요."],
  ] as const)("renders the %s workspace notice", (status, message) => {
    hooks.state = { status };

    expect(renderWidget()).toContain(message);
  });

  it("keeps the existing empty message when ready data has no D-Day items", () => {
    hooks.state = { status: "ready", data: data([]) };

    expect(renderWidget()).toContain(DDAY_EMPTY_MESSAGE);
  });

  it("formats today and future remote items without source badges", () => {
    hooks.state = { status: "ready", data: data([
      { id: "today", targetDate: "2026-09-23", title: "오늘 마감", source: "task" },
      { id: "tomorrow", targetDate: "2026-09-24", title: "내일 일정", source: "event" },
    ]) };

    const html = renderWidget();
    expect(html).toContain("D-Day");
    expect(html).toContain("D-1");
    expect(html).toContain("오늘 마감");
    expect(html).toContain("내일 일정");
    expect(html).not.toContain("task");
    expect(html).not.toContain("event");
  });

  it.each([1, 2, 3, 4])("renders %i ready items in the existing D-Day list", (count) => {
    hooks.state = { status: "ready", data: data(Array.from({ length: count }, (_, index) => ({
      id: `item-${index}`,
      targetDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
      title: `일정 ${index + 1}`,
      source: index % 2 === 0 ? "task" : "event",
    }))) };

    const html = renderWidget();
    expect((html.match(/<li>/g) ?? [])).toHaveLength(count);
    expect(html).toContain("dday-list");
  });

  it("keeps the h=2 widget geometry", () => {
    const defaultLayout = defaultWidgetLayouts.find(({ type }) => type === "dday");

    expect(widgetRegistry.dday.defaultSize.h).toBe(2);
    expect(defaultLayout?.h).toBe(2);
  });
});
