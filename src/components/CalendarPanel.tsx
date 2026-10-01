import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarEvents } from "../data/mockData";
import { isDisplayScheduleDate } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import type { ScheduleCategory } from "../types/dashboard";
import { Panel } from "./Panel";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;
const leadingDays = 2;
const daysInMonth = 30;

const categoryClass: Record<ScheduleCategory, string> = {
  교육: "education",
  검진: "checkup",
  행사: "event",
  보고: "report",
};

export function CalendarPanel() {
  const { now } = useWidgetSession();
  const cells = Array.from({ length: 35 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  return (
    <Panel
      title="월간 실무일정"
      icon={CalendarRange}
      className="calendar-panel"
      action={<div className="calendar-nav"><button type="button" aria-label="이전 달"><ChevronLeft size={16} /></button><strong>2026년 9월</strong><button type="button" aria-label="다음 달"><ChevronRight size={16} /></button></div>}
    >
      <div className="calendar-legend" aria-label="일정 카테고리">
        {(Object.keys(categoryClass) as ScheduleCategory[]).map((category) => <span key={category}><i className={categoryClass[category]} />{category}</span>)}
      </div>
      <div className="calendar-grid">
        {weekdays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
        {cells.map((day, index) => {
          const events = day === null ? [] : calendarEvents.filter((event) => event.day === day);
          return (
            <div className={`calendar-cell${day !== null && isDisplayScheduleDate(now, day) ? " is-today" : ""}`} key={`cell-${index}`}>
              {day !== null && <>
                <span className="calendar-date">{day}</span>
                <div className="calendar-events">
                  {events.slice(0, 2).map((event) => <span className={`calendar-event ${categoryClass[event.category]}`} key={event.title}>{event.title}</span>)}
                </div>
              </>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
