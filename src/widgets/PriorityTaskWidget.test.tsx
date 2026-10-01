import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceDataState } from "../workspace-data/types";
import { PriorityTaskWidget } from "./PriorityTaskWidget";

const hooks = vi.hoisted(() => ({
  openBogunonTask: vi.fn(async () => undefined),
  state: {
    status: "ready",
    data: {
      todayTasks: [{ id: "due", title: "오늘 마감 업무", completed: false, status: "needsCheck", priority: "low", todayReason: "dueToday" }],
      calendarEvents: [], weekSchedule: [], upcomingEvents: [], ddayItems: [], notifications: [], inboxItems: [],
      summary: { todayEventCount: 0, todayTaskCount: 1, incompleteTaskCount: 1 },
    },
  } as WorkspaceDataState,
}));

vi.mock("../dashboard/WidgetSessionContext", () => ({
  useWidgetSession: () => ({ now: new Date(2026, 8, 23, 9, 0), memo: "", setMemo: vi.fn() }),
}));

vi.mock("../components/desktop/DesktopPanelContext", () => ({
  useDesktopPanels: () => ({ openBogunonTask: hooks.openBogunonTask }),
}));

vi.mock("../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({ state: hooks.state }),
}));

describe("PriorityTaskWidget", () => {
  it("uses the selected task's today reason without replacing its status", () => {
    const markup = renderToStaticMarkup(createElement(PriorityTaskWidget));

    expect(markup).toContain("BOGUNON · 오늘 마감");
    expect(markup).toContain("확인 필요");
    expect(markup).toContain('class="priority-task-open"');
    expect(markup).toContain("BOGUNON에서 오늘 마감 업무 열기");
  });
});
