import { CalendarRange } from "lucide-react";
import { scheduleCategories, type ScheduleCategory } from "../types/dashboard";
import { Panel } from "../components/Panel";
import { useDesktopPanels } from "../components/desktop/DesktopPanelContext";
import { isSameLocalDate } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataEmpty, WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";
import { formatWorkspaceDate } from "../workspace-data/workspaceDataAdapter";
import type { WorkspaceCalendarEvent } from "../workspace-data/types";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;
const categoryClass: Record<ScheduleCategory, string> = {
  교육: "education",
  검진: "checkup",
  행사: "event",
  보고: "report",
};

export const getCalendarMonthCells = (year: number, monthIndex: number): readonly (number | null)[] => {
  const leadingDays = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
};

export const getCalendarEventPreview = (
  events: readonly WorkspaceCalendarEvent[],
): { readonly firstEvent: WorkspaceCalendarEvent | null; readonly overflowCount: number } => ({
  firstEvent: events[0] ?? null,
  overflowCount: Math.max(0, events.length - 1),
});

export const getCalendarDateKey = (year: number, monthIndex: number, day: number): string => (
  formatWorkspaceDate(new Date(year, monthIndex, day))
);

export const selectCalendarDate = (
  date: string,
  openQuickAddEventForDate: (selectedDate: string) => void,
): void => openQuickAddEventForDate(date);

export function CalendarWidget() {
  const { openQuickAddEventForDate } = useDesktopPanels();
  const { now } = useWidgetSession();
  const { state } = useWorkspaceData();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const cells = getCalendarMonthCells(year, monthIndex);
  const weekCount = cells.length / 7;
  const events = state.status === "ready" ? state.data.calendarEvents : [];

  return (
    <Panel
      title="월간 실무일정"
      icon={CalendarRange}
      className="calendar-panel"
      action={<div className="calendar-nav"><strong>{year}년 {monthIndex + 1}월</strong></div>}
    >
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : events.length === 0 && (
        <WorkspaceDataEmpty>이번 달 등록된 일정이 없습니다.</WorkspaceDataEmpty>
      )}
      <div className="calendar-legend" aria-label="일정 카테고리">
        {scheduleCategories.map((category) => <span key={category}><i className={categoryClass[category]} />{category}</span>)}
      </div>
      <div className={`calendar-grid has-${weekCount}-weeks`}>
        {weekdays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
        {cells.map((day, index) => {
          const date = day === null ? null : new Date(year, monthIndex, day);
          const dateKey = day === null ? null : getCalendarDateKey(year, monthIndex, day);
          const dateEvents = dateKey === null ? [] : events.filter((event) => event.targetDate === dateKey);
          const eventPreview = getCalendarEventPreview(dateEvents);
          return (
            <div className={`calendar-cell${date !== null && isSameLocalDate(now, date) ? " is-today" : ""}`} key={`widget-cell-${index}`}>
              {day !== null && <>
                <button
                  type="button"
                  className="calendar-date calendar-date-action"
                  aria-label={`${year}년 ${monthIndex + 1}월 ${day}일 일정 추가`}
                  title={`${monthIndex + 1}월 ${day}일 일정 추가`}
                  onClick={() => selectCalendarDate(dateKey!, openQuickAddEventForDate)}
                >
                  {day}
                </button>
                <div className="calendar-events">
                  {eventPreview.firstEvent !== null && (
                    <span className={`calendar-event ${categoryClass[eventPreview.firstEvent.category]}`}>{eventPreview.firstEvent.title}</span>
                  )}
                  {eventPreview.overflowCount > 0 && (
                    <span className="calendar-event-overflow" aria-label={`${eventPreview.overflowCount}개 일정 더 있음`}>
                      +{eventPreview.overflowCount}
                    </span>
                  )}
                </div>
              </>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
