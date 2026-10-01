import { describe, expect, it } from "vitest";
import type { BogunonEventRow, BogunonTaskRow, WorkspaceSourceRows } from "./types";
import { adaptWorkspaceDdayItems } from "./workspaceDdayAdapter";

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

const event = (values: Partial<BogunonEventRow> & Pick<BogunonEventRow, "id" | "title" | "start_date">): BogunonEventRow => ({
  area: "schoolSchedule",
  end_date: values.start_date,
  is_all_day: true,
  start_time: null,
  end_time: null,
  color_key: null,
  ...values,
});

const rows = (
  ddayTasks: readonly BogunonTaskRow[] = [],
  ddayEvents: readonly BogunonEventRow[] = [],
): WorkspaceSourceRows => ({ tasks: [], events: [], ddayTasks, ddayEvents, notificationTasks: [] });

describe("workspace D-Day adapter", () => {
  const now = new Date(2026, 8, 23, 9);
  const defaultAreas = ["healthWork", "schoolSchedule"] as const;

  it("uses only due dates and event start dates from today onward", () => {
    const result = adaptWorkspaceDdayItems(rows([
      task({ id: "due", title: "마감 업무", due_date: "2026-09-23" }),
      task({ id: "scheduled", title: "예정 업무", scheduled_date: "2026-09-24" }),
      task({ id: "follow-up", title: "후속 업무", follow_up_date: "2026-09-24" }),
      task({ id: "past", title: "지난 업무", due_date: "2026-09-22" }),
    ], [
      event({ id: "future", title: "미래 일정", start_date: "2026-09-25" }),
      event({ id: "ongoing", title: "진행 중 일정", start_date: "2026-09-22", end_date: "2026-09-24" }),
      event({ id: "past-event", title: "지난 일정", start_date: "2026-09-20" }),
    ]), now, defaultAreas);

    expect(result.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: "due", source: "task" },
      { id: "future", source: "event" },
    ]);
  });

  it("sorts equal-date and equal-priority items by locale title", () => {
    const result = adaptWorkspaceDdayItems(rows([
      task({ id: "later-title", title: "나 업무", due_date: "2026-09-24" }),
      task({ id: "earlier-title", title: "가 업무", due_date: "2026-09-24" }),
    ], [
      event({ id: "later-event", title: "나 일정", start_date: "2026-09-25" }),
      event({ id: "earlier-event", title: "가 일정", start_date: "2026-09-25" }),
    ]), now, defaultAreas);

    expect(result.map(({ id }) => id)).toEqual([
      "earlier-title", "later-title", "earlier-event", "later-event",
    ]);
  });

  it("excludes completed and on-hold tasks but keeps every active status", () => {
    const result = adaptWorkspaceDdayItems(rows([
      task({ id: "planned", title: "계획", due_date: "2026-09-24", status: "planned" }),
      task({ id: "progress", title: "진행", due_date: "2026-09-24", status: "inProgress" }),
      task({ id: "reply", title: "답변 대기", due_date: "2026-09-24", status: "waitingForReply" }),
      task({ id: "check", title: "확인 필요", due_date: "2026-09-24", status: "needsCheck" }),
      task({ id: "completed", title: "완료", due_date: "2026-09-24", status: "completed" }),
      task({ id: "hold", title: "보류", due_date: "2026-09-24", status: "onHold" }),
    ]), now, defaultAreas);

    expect(result.map(({ id }) => id)).toEqual(["planned", "reply", "progress", "check"]);
  });

  it("applies workspace areas, source identity dedupe, ordering, and the global limit", () => {
    const result = adaptWorkspaceDdayItems(rows([
      task({ id: "normal", title: "나 업무", due_date: "2026-09-24" }),
      task({ id: "high", title: "다 업무", due_date: "2026-09-24", priority: "high" }),
      task({ id: "low", title: "가 업무", due_date: "2026-09-24", priority: "low" }),
      task({ id: "personal", title: "개인 업무", due_date: "2026-09-23", area: "personal" }),
      task({ id: "normal", title: "중복 업무", due_date: "2026-09-24" }),
    ], [
      event({ id: "normal", title: "나 업무", start_date: "2026-09-24" }),
      event({ id: "later", title: "나중 일정", start_date: "2026-09-25" }),
    ]), now, defaultAreas);

    expect(result.map(({ id, source }) => `${source}:${id}`)).toEqual([
      "task:high", "task:normal", "task:low", "event:normal",
    ]);
  });

  it("includes optional areas only when enabled and returns an empty collection when disabled", () => {
    const sourceRows = rows([
      task({ id: "personal", title: "개인 업무", due_date: "2026-09-24", area: "personal" }),
    ]);

    expect(adaptWorkspaceDdayItems(sourceRows, now, defaultAreas)).toEqual([]);
    expect(adaptWorkspaceDdayItems(sourceRows, now, [...defaultAreas, "personal"]).map(({ id }) => id)).toEqual(["personal"]);
    expect(adaptWorkspaceDdayItems(sourceRows, now, [])).toEqual([]);
  });
});
