import { BellRing, CalendarClock, Flag } from "lucide-react";
import { dDayItems, notifications, upcomingSchedules } from "../data/mockData";
import { formatDday, isSameLocalDate, parseLocalDate } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { NotificationList } from "./NotificationList";
import { Panel } from "./Panel";

export function RightRail() {
  const { now } = useWidgetSession();
  return (
    <aside className="right-stack" aria-label="주요 일정과 마감">
      <Panel title="주요 일정" icon={CalendarClock} className="schedule-panel">
        <ol className="upcoming-list">
          {upcomingSchedules.map((item) => {
            const target = parseLocalDate(item.targetDate);
            const isToday = target !== null && isSameLocalDate(now, target);
            return (
              <li className={isToday ? "is-today" : ""} key={`${item.date}-${item.title}`}>
                <time><strong>{item.date}</strong><span>{item.weekday}요일</span></time>
                <div><span className={`category-badge category-${item.category}`}>{item.category}</span><p>{item.title}</p></div>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Panel title="D-Day" icon={Flag} className="dday-panel">
        <ul className="dday-list">
          {dDayItems.map((item) => <li key={item.title}><strong>{formatDday(item.targetDate, now)}</strong><span>{item.title}</span></li>)}
        </ul>
      </Panel>
      <Panel title="알림" icon={BellRing} className="mobile-notifications">
        <NotificationList items={notifications} />
      </Panel>
    </aside>
  );
}
