import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DesktopPanelProvider } from "../components/desktop/DesktopPanelContext";
import { isSameLocalDate } from "../dashboard/dateSource";
import type { WorkspaceCalendarEvent, WorkspaceDataState } from "../workspace-data/types";
import { CalendarWidget, getCalendarDateKey, getCalendarEventPreview, getCalendarMonthCells, selectCalendarDate } from "./CalendarWidget";

const hooks = vi.hoisted(() => ({
  now: new Date(2026, 8, 22, 9, 0),
  state: { status: "ready", data: {
    todayTasks: [], calendarEvents: [], weekSchedule: [], upcomingEvents: [], ddayItems: [], notifications: [], inboxItems: [],
    summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 },
  } } as WorkspaceDataState,
}));

vi.mock("../dashboard/WidgetSessionContext", () => ({
  useWidgetSession: () => ({ now: hooks.now, memo: "", setMemo: () => undefined }),
}));

vi.mock("../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({ state: hooks.state }),
}));

const renderCalendar = (): string => renderToStaticMarkup(createElement(DesktopPanelProvider, {
  notify: () => undefined,
  openBogunonTask: async () => undefined,
  openInbox: () => undefined,
  openQuickAddEventForDate: () => undefined,
  openQuickAddFromMemo: () => undefined,
  openQuickMemoUrl: async () => undefined,
    runDesktopAction: async () => undefined,
    workFolderFavorites: [],
    openWorkFolderFavorite: async () => undefined,
  children: createElement(CalendarWidget),
}));

const calendarEvent = (id: string): WorkspaceCalendarEvent => ({
  id,
  targetDate: "2026-09-30",
  title: `일정 ${id}`,
  category: "행사",
});

describe("getCalendarMonthCells", () => {
  it.each([
    { year: 2026, monthIndex: 1, expectedWeeks: 4, firstDay: 1, lastDay: 28 },
    { year: 2026, monthIndex: 8, expectedWeeks: 5, firstDay: 1, lastDay: 30 },
    { year: 2026, monthIndex: 7, expectedWeeks: 6, firstDay: 1, lastDay: 31 },
  ])("creates a $expectedWeeks-week grid for $year-$monthIndex", ({
    year,
    monthIndex,
    expectedWeeks,
    firstDay,
    lastDay,
  }) => {
    const cells = getCalendarMonthCells(year, monthIndex);

    expect(cells).toHaveLength(expectedWeeks * 7);
    expect(cells.filter((day): day is number => day !== null)).toEqual(
      Array.from({ length: lastDay }, (_, index) => firstDay + index),
    );
  });

  it("keeps the final week dates in five- and six-week months", () => {
    expect(getCalendarMonthCells(2026, 8).slice(-7)).toEqual([27, 28, 29, 30, null, null, null]);
    expect(getCalendarMonthCells(2026, 7).slice(-7)).toEqual([30, 31, null, null, null, null, null]);
  });

  it("identifies exactly one current-day cell", () => {
    const now = new Date(2026, 8, 21, 15, 30);
    const todayCells = getCalendarMonthCells(2026, 8).filter((day) => (
      day !== null && isSameLocalDate(now, new Date(2026, 8, day))
    ));

    expect(todayCells).toEqual([21]);
  });
});

describe("getCalendarEventPreview", () => {
  it.each([
    { count: 0, firstEventId: null, overflowCount: 0 },
    { count: 1, firstEventId: "1", overflowCount: 0 },
    { count: 2, firstEventId: "1", overflowCount: 1 },
    { count: 3, firstEventId: "1", overflowCount: 2 },
  ])("shows one event and +N for $count events", ({ count, firstEventId, overflowCount }) => {
    const events = Array.from({ length: count }, (_, index) => calendarEvent(String(index + 1)));
    const preview = getCalendarEventPreview(events);

    expect(preview.firstEvent?.id ?? null).toBe(firstEventId);
    expect(preview.overflowCount).toBe(overflowCount);
  });
});

describe("calendar date Quick Add", () => {
  it("renders only actual dates as accessible buttons", () => {
    const markup = renderCalendar();

    expect((markup.match(/calendar-date-action/g) ?? [])).toHaveLength(30);
    expect(markup).toContain('aria-label="2026년 9월 22일 일정 추가"');
    expect(markup).toContain('aria-label="2026년 9월 30일 일정 추가"');
    expect(markup).not.toContain('aria-label="2026년 9월 null일 일정 추가"');
  });

  it.each([
    [2026, 8, 22, "2026-09-22"],
    [2026, 8, 30, "2026-09-30"],
    [2026, 7, 31, "2026-08-31"],
  ])("formats %i-%i-%i as a local calendar date", (year, monthIndex, day, expected) => {
    expect(getCalendarDateKey(year, monthIndex, day)).toBe(expected);
  });

  it("passes the selected date to the Quick Add callback without saving", () => {
    const openQuickAddEventForDate = vi.fn();

    selectCalendarDate("2026-09-22", openQuickAddEventForDate);

    expect(openQuickAddEventForDate).toHaveBeenCalledOnce();
    expect(openQuickAddEventForDate).toHaveBeenCalledWith("2026-09-22");
  });
});
