import { describe, expect, it } from "vitest";
import { adaptWorkspaceData, createWorkspaceDateRange } from "./workspaceDataAdapter";
import { compareTodayTasks } from "./workspaceTodayTaskAdapter";
import type { BogunonEventRow, BogunonTaskRow, WorkspaceTask } from "./types";

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

const event = (values: Partial<BogunonEventRow> & Pick<BogunonEventRow, "id" | "title" | "start_date" | "end_date">): BogunonEventRow => ({
  area: "schoolSchedule",
  is_all_day: true,
  start_time: null,
  end_time: null,
  color_key: null,
  ...values,
});

describe("workspace data adapter", () => {
  const now = new Date(2026, 8, 23, 9);
  const defaultAreas = ["healthWork", "schoolSchedule"] as const;

  it("builds current week and month boundaries from local time", () => {
    expect(createWorkspaceDateRange(now)).toEqual({
      today: "2026-09-23",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    });
  });

  it("deduplicates scheduled and due-today tasks and maps completion", () => {
    const data = adaptWorkspaceData({
      tasks: [
        task({ id: "both", title: "오늘 업무", scheduled_date: "2026-09-23", due_date: "2026-09-23" }),
        task({ id: "done", title: "완료 업무", scheduled_date: "2026-09-23", status: "completed", completed_at: "2026-09-23T01:00:00Z" }),
        task({ id: "old-done", title: "지난 완료", due_date: "2026-09-23", status: "completed", completed_at: "2026-09-22T01:00:00Z" }),
      ],
      events: [],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    }, now, defaultAreas);

    expect(data.todayTasks.map(({ id, completed, todayReason }) => ({ id, completed, todayReason }))).toEqual([
      { id: "both", completed: false, todayReason: "dueToday" },
      { id: "done", completed: true, todayReason: "scheduledToday" },
    ]);
    expect(data.summary).toMatchObject({ todayTaskCount: 2, incompleteTaskCount: 1 });
  });

  it("maps the reason that places a task in today's list", () => {
    const data = adaptWorkspaceData({
      tasks: [
        task({ id: "scheduled", title: "오늘 수행", scheduled_date: "2026-09-23", due_date: "2026-09-24" }),
        task({ id: "due", title: "오늘 마감", due_date: "2026-09-23" }),
        task({ id: "both", title: "수행과 마감", scheduled_date: "2026-09-23", due_date: "2026-09-23" }),
      ],
      events: [], ddayTasks: [], ddayEvents: [], notificationTasks: [],
    }, now, defaultAreas);

    expect(Object.fromEntries(data.todayTasks.map((item) => [item.id, item.todayReason]))).toEqual({
      both: "dueToday",
      due: "dueToday",
      scheduled: "scheduledToday",
    });
  });

  it("orders incomplete high-priority work before completed work", () => {
    const data = adaptWorkspaceData({
      tasks: [
        task({ id: "done", title: "완료", scheduled_date: "2026-09-23", status: "completed", completed_at: "2026-09-23T01:00:00Z", priority: "high" }),
        task({ id: "normal", title: "보통", scheduled_date: "2026-09-23", priority: "normal" }),
        task({ id: "high", title: "중요", scheduled_date: "2026-09-23", priority: "high" }),
      ],
      events: [],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    }, now, defaultAreas);

    expect(data.todayTasks.map((item) => item.id)).toEqual(["high", "normal", "done"]);
  });

  it("orders due-today work before scheduled work, then priority, title, and id", () => {
    const data = adaptWorkspaceData({
      tasks: [
        task({ id: "scheduled-high", title: "수행 중요", scheduled_date: "2026-09-23", priority: "high" }),
        task({ id: "due-low", title: "마감 낮음", due_date: "2026-09-23", priority: "low" }),
        task({ id: "due-normal", title: "마감 보통", due_date: "2026-09-23", priority: "normal" }),
        task({ id: "due-high-b", title: "같은 제목", due_date: "2026-09-23", priority: "high" }),
        task({ id: "due-high-a", title: "같은 제목", due_date: "2026-09-23", priority: "high" }),
        task({ id: "completed", title: "완료 중요", scheduled_date: "2026-09-23", due_date: "2026-09-23", priority: "high", status: "completed" }),
      ],
      events: [], ddayTasks: [], ddayEvents: [], notificationTasks: [],
    }, now, defaultAreas);

    expect(data.todayTasks.map((item) => item.id)).toEqual([
      "due-high-a", "due-high-b", "due-normal", "due-low", "scheduled-high", "completed",
    ]);
  });

  it("does not mutate the input when comparing today tasks", () => {
    const items: readonly WorkspaceTask[] = [
      { id: "scheduled", title: "수행", completed: false, status: "planned", priority: "high", todayReason: "scheduledToday" },
      { id: "due", title: "마감", completed: false, status: "planned", priority: "low", todayReason: "dueToday" },
    ];
    const original = [...items];

    const sorted = [...items].sort(compareTodayTasks);

    expect(sorted.map((item) => item.id)).toEqual(["due", "scheduled"]);
    expect(items).toEqual(original);
  });

  it("expands multi-day monthly events and maps current-week tasks and events", () => {
    const data = adaptWorkspaceData({
      tasks: [task({ id: "task", title: "주간 업무", scheduled_date: "2026-09-24" })],
      events: [event({ id: "event", title: "연속 일정", start_date: "2026-09-22", end_date: "2026-09-24" })],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    }, now, defaultAreas);

    expect(data.calendarEvents.map((item) => item.targetDate)).toEqual([
      "2026-09-22", "2026-09-23", "2026-09-24",
    ]);
    expect(data.weekSchedule[1].items).toEqual(["연속 일정"]);
    expect(data.weekSchedule[3].items).toEqual(["연속 일정", "주간 업무"]);
  });

  it("sorts upcoming events and excludes past events", () => {
    const data = adaptWorkspaceData({
      tasks: [],
      events: [
        event({ id: "later", title: "나중 일정", start_date: "2026-10-02", end_date: "2026-10-02" }),
        event({ id: "past", title: "지난 일정", start_date: "2026-09-20", end_date: "2026-09-20" }),
        event({ id: "soon", title: "가까운 일정", start_date: "2026-09-25", end_date: "2026-09-25" }),
      ],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    }, now, defaultAreas);

    expect(data.upcomingEvents.map((item) => item.id)).toEqual(["soon", "later"]);
  });

  it("keeps active multi-day events in upcoming schedules from today", () => {
    const data = adaptWorkspaceData({
      tasks: [],
      events: [
        event({ id: "ongoing", title: "진행 중 일정", start_date: "2026-09-22", end_date: "2026-09-24" }),
        event({ id: "future", title: "다음 일정", start_date: "2026-09-25", end_date: "2026-09-25" }),
      ],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    }, now, defaultAreas);

    expect(data.upcomingEvents.map(({ id, targetDate }) => ({ id, targetDate }))).toEqual([
      { id: "ongoing", targetDate: "2026-09-23" },
      { id: "future", targetDate: "2026-09-25" },
    ]);
  });

  it("returns only empty remote collections when the signed-in source is empty", () => {
    const data = adaptWorkspaceData({
      tasks: [], events: [], ddayTasks: [], ddayEvents: [], notificationTasks: [],
    }, now, defaultAreas);
    expect(data.todayTasks).toEqual([]);
    expect(data.calendarEvents).toEqual([]);
    expect(data.weekSchedule.every((day) => day.items.length === 0)).toBe(true);
    expect(data.upcomingEvents).toEqual([]);
    expect(data.ddayItems).toEqual([]);
    expect(data.notifications).toEqual([]);
  });

  it("adds the dedicated D-Day source rows without changing other collections", () => {
    const data = adaptWorkspaceData({
      tasks: [],
      events: [],
      ddayTasks: [task({ id: "due", title: "마감 업무", due_date: "2026-09-24" })],
      ddayEvents: [],
      notificationTasks: [],
    }, now, defaultAreas);

    expect(data.ddayItems).toEqual([
      { id: "due", targetDate: "2026-09-24", title: "마감 업무", source: "task" },
    ]);
    expect(data.todayTasks).toEqual([]);
    expect(data.upcomingEvents).toEqual([]);
  });

  it("adds dedicated notification source rows without changing other collections", () => {
    const data = adaptWorkspaceData({
      tasks: [],
      events: [],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [task({ id: "attention", title: "확인 업무", status: "needsCheck" })],
    }, now, defaultAreas);

    expect(data.notifications).toEqual([
      { id: "attention", title: "확인 업무", detail: "BOGUNON 확인 필요", relevantDate: null, tone: "warning" },
    ]);
    expect(data.todayTasks).toEqual([]);
    expect(data.ddayItems).toEqual([]);
    expect(data.upcomingEvents).toEqual([]);
  });

  it("defensively filters tasks, events, and summary by enabled areas", () => {
    const rows = {
      tasks: [
        task({ id: "health", title: "보건업무", scheduled_date: "2026-09-23" }),
        task({ id: "personal", title: "개인업무", area: "personal", scheduled_date: "2026-09-23" }),
      ],
      events: [
        event({ id: "school", title: "학교일정", start_date: "2026-09-23", end_date: "2026-09-23" }),
        event({ id: "exercise", title: "운동", area: "exercise", start_date: "2026-09-23", end_date: "2026-09-23" }),
        event({ id: "project", title: "프로젝트", area: "project", start_date: "2026-09-23", end_date: "2026-09-23" }),
      ],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    };

    const defaults = adaptWorkspaceData(rows, now, defaultAreas);
    expect(defaults.todayTasks.map((item) => item.id)).toEqual(["health"]);
    expect(defaults.calendarEvents.map((item) => item.title)).toEqual(["학교일정"]);
    expect(defaults.summary).toEqual({ todayEventCount: 1, todayTaskCount: 1, incompleteTaskCount: 1 });

    const withPersonal = adaptWorkspaceData(rows, now, [...defaultAreas, "personal"]);
    expect(withPersonal.todayTasks.map((item) => item.id)).toEqual(["personal", "health"]);
    const personalOffAgain = adaptWorkspaceData(rows, now, defaultAreas);
    expect(personalOffAgain.todayTasks.map((item) => item.id)).toEqual(["health"]);
  });
});
