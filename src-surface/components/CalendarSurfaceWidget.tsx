import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { calendarCells, toLocalDateKey } from "../date";
import type { SurfaceCalendarEvent } from "../projection";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;

type Props = Readonly<{
  events: readonly SurfaceCalendarEvent[];
  now: Date;
  onSyntheticAction: (message: string) => void;
}>;

export function CalendarSurfaceWidget({ events, now, onSyntheticAction }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const cells = useMemo(() => calendarCells(visibleMonth.getFullYear(), visibleMonth.getMonth()), [visibleMonth]);
  const changeMonth = (offset: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  return <div className="surface-calendar">
    <div className="surface-calendar__toolbar">
      <button type="button" aria-label="이전 달" onClick={() => changeMonth(-1)}><ChevronLeft size={15} /></button>
      <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
      <button type="button" aria-label="다음 달" onClick={() => changeMonth(1)}><ChevronRight size={15} /></button>
      <button type="button" className="surface-calendar__today" onClick={() => setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>오늘</button>
    </div>
    <div className="surface-calendar__legend" aria-label="일정 유형">
      <span data-kind="education">교육</span><span data-kind="checkup">검진</span><span data-kind="event">행사</span><span data-kind="report">보고</span>
    </div>
    <div className="surface-calendar__grid">
      {weekdays.map((weekday) => <span className="surface-calendar__weekday" key={weekday}>{weekday}</span>)}
      {cells.map((day, index) => {
        if (day === null) return <span className="surface-calendar__cell is-empty" key={`empty-${index}`} />;
        const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
        const dateKey = toLocalDateKey(date);
        const dayEvents = events.filter((event) => event.date === dateKey);
        const isToday = dateKey === toLocalDateKey(now);
        return <button type="button" key={dateKey} className={`surface-calendar__cell${isToday ? " is-today" : ""}${selectedDate === dateKey ? " is-selected" : ""}`}
          aria-label={`${dateKey} 합성 일정 ${dayEvents.length}개`} onClick={() => { setSelectedDate(dateKey); onSyntheticAction(`합성 날짜 선택 · ${dateKey}`); }}>
          <span className="surface-calendar__date">{day}</span>
          {dayEvents.slice(0, 1).map((event) => <span className="surface-calendar__event" data-kind={event.kind} key={`${event.date}-${event.label}`} title={event.label}>{event.label}</span>)}
          {dayEvents.length > 1 && <span className="surface-calendar__more">+{dayEvents.length - 1}</span>}
        </button>;
      })}
    </div>
    {selectedDate !== null && <p className="surface-calendar__selection"><CalendarRange size={13} /> {selectedDate} · 합성 선택 상태</p>}
  </div>;
}
