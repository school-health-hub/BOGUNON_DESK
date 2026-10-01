import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceData, WorkspaceDataState } from "../workspace-data/types";
import { TodaySummaryWidget } from "./TodaySummaryWidget";

const hooks = vi.hoisted(() => ({
  state: { status: "loading" } as WorkspaceDataState,
  now: new Date(2026, 9, 1, 9, 0),
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
  summary: { todayEventCount: 2, todayTaskCount: 3, incompleteTaskCount: 4 },
});

describe("TodaySummaryWidget", () => {
  beforeEach(() => { hooks.state = { status: "loading" }; });

  it("renders the nearest existing D-Day context", () => {
    hooks.state = { status: "ready", data: data([
      { id: "nearest", targetDate: "2026-10-04", title: "결핵검진", source: "event" },
    ]) };
    const markup = renderToStaticMarkup(createElement(TodaySummaryWidget));
    expect(markup).toContain("D-3 · 결핵검진");
    expect(markup).toContain("2 일정 · 3 업무");
  });

  it("renders a quiet empty value when no D-Day exists", () => {
    hooks.state = { status: "ready", data: data([]) };
    const markup = renderToStaticMarkup(createElement(TodaySummaryWidget));
    expect(markup).toContain("가까운 D-Day");
    expect(markup).toContain("—");
  });
});
