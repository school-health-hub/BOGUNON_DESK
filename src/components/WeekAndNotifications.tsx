import { BellRing, CalendarCheck2 } from "lucide-react";
import { notifications, weekSchedule } from "../data/mockData";
import { getWeekDates, isSameLocalDate } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { NotificationList } from "./NotificationList";
import { Panel } from "./Panel";

export function WeekAndNotifications() {
  const { now } = useWidgetSession();
  const weekDates = getWeekDates(now);
  return (
    <div className="bottom-grid">
      <Panel title="이번 주 실무일정" icon={CalendarCheck2} className="week-panel">
        <div className="week-grid">
          {weekSchedule.map((item, index) => (
            <article className={isSameLocalDate(now, weekDates[index]) ? "is-today" : ""} key={item.day}>
              <header><span>{item.day}</span><strong>{weekDates[index].getDate()}</strong></header>
              <div>{item.items.length === 0 ? <span className="empty">일정 없음</span> : item.items.map((schedule) => <p key={schedule}>{schedule}</p>)}</div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="알림" icon={BellRing} className="desktop-notifications">
        <NotificationList items={notifications} />
      </Panel>
    </div>
  );
}
