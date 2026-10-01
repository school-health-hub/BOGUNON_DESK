import { describe, expect, it } from "vitest";
import { adaptWorkspaceNotifications } from "./workspaceNotificationAdapter";
import type { BogunonTaskRow, WorkspaceSourceRows } from "./types";

const task = (values: Partial<BogunonTaskRow> & Pick<BogunonTaskRow, "id" | "title">): BogunonTaskRow => ({
  area: "healthWork",
  status: "planned",
  priority: "normal",
  scheduled_date: null,
  due_date: null,
  follow_up_date: null,
  completed_at: null,
  category: "other",
  updated_at: "2026-10-01T09:00:00.000Z",
  ...values,
});

const rows = (notificationTasks: readonly BogunonTaskRow[]): WorkspaceSourceRows => ({
  tasks: [],
  events: [],
  ddayTasks: [],
  ddayEvents: [],
  notificationTasks,
});

describe("workspace notification adapter", () => {
  const now = new Date(2026, 8, 23, 9);
  const enabledAreas = ["healthWork", "schoolSchedule"] as const;

  it("maps overdue and due-today tasks while excluding future due-only tasks", () => {
    const items = adaptWorkspaceNotifications(rows([
      task({ id: "overdue", title: "지난 마감", due_date: "2026-09-20" }),
      task({ id: "today", title: "오늘 마감 업무", due_date: "2026-09-23" }),
      task({ id: "future", title: "미래 마감", due_date: "2026-09-24" }),
    ]), now, enabledAreas);

    expect(items).toEqual([
      { id: "overdue", title: "지난 마감", detail: "마감 3일 지남", relevantDate: "2026-09-20", tone: "warning" },
      { id: "today", title: "오늘 마감 업무", detail: "오늘 마감", relevantDate: "2026-09-23", tone: "warning" },
    ]);
  });

  it("maps due follow-ups and allows future follow-up only for reply waiting", () => {
    const items = adaptWorkspaceNotifications(rows([
      task({ id: "follow-past", title: "지난 후속", follow_up_date: "2026-09-21" }),
      task({ id: "follow-today", title: "오늘 후속", follow_up_date: "2026-09-23" }),
      task({ id: "future-only", title: "미래 후속", follow_up_date: "2026-09-25" }),
      task({ id: "waiting-future", title: "회신 예정", status: "waitingForReply", follow_up_date: "2026-09-24" }),
      task({ id: "waiting", title: "회신 대기", status: "waitingForReply" }),
    ]), now, enabledAreas);

    expect(items).toEqual([
      { id: "follow-past", title: "지난 후속", detail: "후속 확인 2일 지남", relevantDate: "2026-09-21", tone: "warning" },
      { id: "follow-today", title: "오늘 후속", detail: "오늘 후속 확인", relevantDate: "2026-09-23", tone: "warning" },
      { id: "waiting-future", title: "회신 예정", detail: "회신 대기 · 확인 9.24", relevantDate: "2026-09-24", tone: "info" },
      { id: "waiting", title: "회신 대기", detail: "회신 대기", relevantDate: null, tone: "info" },
    ]);
  });

  it("maps attention statuses and defensively excludes inactive tasks and areas", () => {
    const items = adaptWorkspaceNotifications(rows([
      task({ id: "needs-check", title: "확인 업무", status: "needsCheck" }),
      task({ id: "waiting", title: "회신 업무", status: "waitingForReply" }),
      task({ id: "completed", title: "완료 업무", status: "completed", due_date: "2026-09-20" }),
      task({ id: "on-hold", title: "보류 업무", status: "onHold", follow_up_date: "2026-09-20" }),
      task({ id: "disabled", title: "개인 업무", area: "personal", status: "needsCheck" }),
    ]), now, enabledAreas);

    expect(items).toEqual([
      { id: "needs-check", title: "확인 업무", detail: "BOGUNON 확인 필요", relevantDate: null, tone: "warning" },
      { id: "waiting", title: "회신 업무", detail: "회신 대기", relevantDate: null, tone: "info" },
    ]);
  });

  it("keeps one highest-priority reason per task and deduplicates repeated rows", () => {
    const overdueNeedsCheck = task({
      id: "overdue-needs-check",
      title: "복합 업무",
      status: "needsCheck",
      due_date: "2026-09-22",
    });
    const items = adaptWorkspaceNotifications(rows([
      overdueNeedsCheck,
      overdueNeedsCheck,
      task({ id: "today-waiting", title: "오늘 회신", status: "waitingForReply", due_date: "2026-09-23" }),
      task({ id: "follow-waiting", title: "후속 회신", status: "waitingForReply", follow_up_date: "2026-09-22" }),
    ]), now, enabledAreas);

    expect(items).toEqual([
      { id: "overdue-needs-check", title: "복합 업무", detail: "마감 1일 지남", relevantDate: "2026-09-22", tone: "warning" },
      { id: "today-waiting", title: "오늘 회신", detail: "오늘 마감", relevantDate: "2026-09-23", tone: "warning" },
      { id: "follow-waiting", title: "후속 회신", detail: "후속 확인 1일 지남", relevantDate: "2026-09-22", tone: "warning" },
    ]);
  });

  it("sorts by reason, task priority, relevant date, and title before limiting to four", () => {
    const items = adaptWorkspaceNotifications(rows([
      task({ id: "waiting", title: "회신", status: "waitingForReply", priority: "high" }),
      task({ id: "needs", title: "확인", status: "needsCheck", priority: "high" }),
      task({ id: "follow", title: "후속", follow_up_date: "2026-09-20", priority: "high" }),
      task({ id: "today", title: "오늘", due_date: "2026-09-23", priority: "high" }),
      task({ id: "overdue-low", title: "낮음", due_date: "2026-09-18", priority: "low" }),
      task({ id: "overdue-normal", title: "보통", due_date: "2026-09-19", priority: "normal" }),
      task({ id: "overdue-high-later", title: "하나", due_date: "2026-09-22", priority: "high" }),
      task({ id: "overdue-high-earlier-b", title: "가나다", due_date: "2026-09-20", priority: "high" }),
      task({ id: "overdue-high-earlier-a", title: "가가", due_date: "2026-09-20", priority: "high" }),
    ]), now, enabledAreas);

    expect(items.map(({ id }) => id)).toEqual([
      "overdue-high-earlier-a",
      "overdue-high-earlier-b",
      "overdue-high-later",
      "overdue-normal",
    ]);
  });

  it("returns an empty feed when no task needs attention", () => {
    expect(adaptWorkspaceNotifications(rows([]), now, enabledAreas)).toEqual([]);
    expect(adaptWorkspaceNotifications(rows([
      task({ id: "future", title: "미래 업무", due_date: "2026-09-24" }),
    ]), now, enabledAreas)).toEqual([]);
  });
});
