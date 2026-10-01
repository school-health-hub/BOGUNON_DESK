import { CalendarClock } from "lucide-react";
import { Panel } from "../components/Panel";
import { isSameLocalDate, parseLocalDate } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataEmpty, WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";

export function UpcomingWidget() {
  const { now } = useWidgetSession();
  const { state } = useWorkspaceData();
  const schedules = state.status === "ready" ? state.data.upcomingEvents : [];
  return (
    <Panel title="주요 일정" icon={CalendarClock} className="schedule-panel">
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : schedules.length === 0 ? (
        <WorkspaceDataEmpty>다가오는 일정이 없습니다.</WorkspaceDataEmpty>
      ) : (
      <ol className="upcoming-list">
        {schedules.map((item) => {
          const target = parseLocalDate(item.targetDate);
          const isToday = target !== null && isSameLocalDate(now, target);
          const month = target === null ? "--" : String(target.getMonth() + 1).padStart(2, "0");
          const day = target === null ? "--" : String(target.getDate()).padStart(2, "0");
          const weekday = target === null ? "-" : new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(target);
          return (
            <li className={isToday ? "is-today" : ""} key={item.id}>
              <time><strong>{month}.{day}</strong><span>{weekday}요일</span></time>
              <div><span className={`category-badge category-${item.category}`}>{item.category}</span><p>{item.title}</p></div>
            </li>
          );
        })}
      </ol>
      )}
    </Panel>
  );
}
