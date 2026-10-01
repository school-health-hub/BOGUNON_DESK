import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceDataState, WorkspaceWeekDay } from "../workspace-data/types";
import { getWeeklySchedulePreview, WeeklyWidget } from "./WeeklyWidget";

const hooks = vi.hoisted(() => ({
  now: new Date(2026, 8, 23, 9, 0),
  state: { status: "loading" } as WorkspaceDataState,
}));

vi.mock("../dashboard/WidgetSessionContext", () => ({
  useWidgetSession: () => ({ now: hooks.now, memo: "", setMemo: () => undefined }),
}));

vi.mock("../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({ state: hooks.state }),
}));

const weekSchedule = (items: readonly string[]): readonly WorkspaceWeekDay[] => (
  Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${21 + index}`,
    items: index === 2 ? items : [],
  }))
);

const readyState = (items: readonly string[]): WorkspaceDataState => ({
  status: "ready",
  data: {
    todayTasks: [],
    calendarEvents: [],
    weekSchedule: weekSchedule(items),
    upcomingEvents: [],
    ddayItems: [],
    notifications: [],
    inboxItems: [],
    summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 },
  },
});

describe("getWeeklySchedulePreview", () => {
  it.each([
    { items: [], visibleCount: 0, overflowCount: 0 },
    { items: ["첫 일정"], visibleCount: 1, overflowCount: 0 },
    { items: ["첫 일정", "둘째 일정"], visibleCount: 2, overflowCount: 0 },
    { items: ["첫 일정", "둘째 일정", "셋째 일정"], visibleCount: 2, overflowCount: 1 },
    { items: ["1", "2", "3", "4", "5"], visibleCount: 2, overflowCount: 3 },
  ])("keeps $visibleCount items and reports $overflowCount more", ({ items, visibleCount, overflowCount }) => {
    const original = [...items];

    const preview = getWeeklySchedulePreview(items);

    expect(preview.visibleItems).toHaveLength(visibleCount);
    expect(preview.overflowCount).toBe(overflowCount);
    expect(items).toEqual(original);
  });
});

describe("WeeklyWidget", () => {
  beforeEach(() => {
    hooks.state = readyState([]);
  });

  it("renders the empty message for a day without schedules", () => {
    expect(renderToStaticMarkup(createElement(WeeklyWidget))).toContain("일정 없음");
  });

  it.each([
    { items: ["첫 일정"], visible: ["첫 일정"], hidden: [], overflow: null },
    { items: ["첫 일정", "둘째 일정"], visible: ["첫 일정", "둘째 일정"], hidden: [], overflow: null },
    { items: ["첫 일정", "둘째 일정", "셋째 일정"], visible: ["첫 일정", "둘째 일정"], hidden: ["셋째 일정"], overflow: 1 },
    { items: ["1번 일정", "2번 일정", "3번 일정", "4번 일정", "5번 일정"], visible: ["1번 일정", "2번 일정"], hidden: ["3번 일정", "4번 일정", "5번 일정"], overflow: 3 },
  ])("renders a compact preview for $items.length schedules", ({ items, visible, hidden, overflow }) => {
    hooks.state = readyState(items);

    const markup = renderToStaticMarkup(createElement(WeeklyWidget));

    visible.forEach((item) => expect(markup).toContain(`title="${item}"`));
    hidden.forEach((item) => expect(markup).not.toContain(item));
    if (overflow === null) {
      expect(markup).not.toContain("week-more");
    } else {
      expect(markup).toContain(`aria-label="일정 ${overflow}개 더 있음"`);
      expect(markup).toContain(`+${overflow}`);
    }
  });

  it("keeps a long title intact for CSS ellipsis and hover access", () => {
    const title = "조달청 비축 마스크 무상방출 신청 공문 발송";
    hooks.state = readyState([title]);

    const markup = renderToStaticMarkup(createElement(WeeklyWidget));

    expect(markup).toContain(`title="${title}"`);
    expect(markup).toContain(`>${title}</p>`);
  });
});
