import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceDataState, WorkspaceTask } from "../workspace-data/types";
import { TodayTasksWidget } from "./TodayTasksWidget";

const hooks = vi.hoisted(() => ({
  state: { status: "loading" } as WorkspaceDataState,
  openBogunonTask: vi.fn(async () => undefined),
}));

vi.mock("../dashboard/WidgetSessionContext", () => ({
  useWidgetSession: () => ({ now: new Date(2026, 8, 23, 9, 0), memo: "", setMemo: vi.fn() }),
}));

vi.mock("../components/desktop/DesktopPanelContext", () => ({
  useDesktopPanels: () => ({ openBogunonTask: hooks.openBogunonTask }),
}));

vi.mock("../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({
    state: hooks.state,
    setTaskCompleted: vi.fn(),
    pendingTaskId: null,
    taskMutationError: null,
  }),
}));

const task = (values: Partial<WorkspaceTask> & Pick<WorkspaceTask, "id" | "title">): WorkspaceTask => ({
  completed: false,
  status: "planned",
  priority: "normal",
  todayReason: "scheduledToday",
  ...values,
});

const readyState = (todayTasks: readonly WorkspaceTask[]): WorkspaceDataState => ({
  status: "ready",
  data: {
    todayTasks,
    calendarEvents: [],
    weekSchedule: [],
    upcomingEvents: [],
    ddayItems: [],
    notifications: [],
    inboxItems: [],
    summary: { todayEventCount: 0, todayTaskCount: todayTasks.length, incompleteTaskCount: todayTasks.filter((item) => !item.completed).length },
  },
});

describe("TodayTasksWidget", () => {
  beforeEach(() => {
    hooks.state = readyState([]);
  });

  it("renders due, scheduled, and completed timing labels", () => {
    hooks.state = readyState([
      task({ id: "due", title: "마감 업무", todayReason: "dueToday" }),
      task({ id: "scheduled", title: "수행 업무" }),
      task({ id: "done", title: "완료 업무", completed: true, status: "completed", todayReason: "dueToday" }),
    ]);

    const markup = renderToStaticMarkup(createElement(TodayTasksWidget));

    expect(markup).toContain("오늘 마감");
    expect(markup).toContain("오늘 수행");
    expect(markup).toContain("완료");
    expect(markup).toContain("task-row-meta");
    expect(markup).toContain('class="task-title task-title-action"');
    expect(markup).toContain("BOGUNON에서 마감 업무 열기");
    expect(markup).toContain('role="checkbox"');
  });
});
