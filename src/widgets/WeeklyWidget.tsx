import { CalendarCheck2 } from "lucide-react";
import { Panel } from "../components/Panel";
import { getWeekDates, isSameLocalDate } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";

export const getWeeklySchedulePreview = (
  items: readonly string[],
  maxVisible = 2,
): { readonly visibleItems: readonly string[]; readonly overflowCount: number } => ({
  visibleItems: items.slice(0, maxVisible),
  overflowCount: Math.max(0, items.length - maxVisible),
});

export function WeeklyWidget() {
  const { now } = useWidgetSession();
  const { state } = useWorkspaceData();
  const weekDates = getWeekDates(now);
  const schedule = state.status === "ready" ? state.data.weekSchedule : [];
  return (
    <Panel title="이번 주 실무일정" icon={CalendarCheck2} className="week-panel">
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : (
      <div className="week-grid">
        {weekDates.map((date, index) => {
          const items = schedule[index]?.items ?? [];
          const preview = getWeeklySchedulePreview(items);
          return (
            <article className={isSameLocalDate(now, date) ? "is-today" : ""} key={schedule[index]?.date ?? date.toISOString()}>
              <header><span>{["월", "화", "수", "목", "금", "토", "일"][index]}</span><strong>{date.getDate()}</strong></header>
              <div className={`week-schedule-list${items.length === 0 ? " is-empty" : ""}`}>
                {items.length === 0 ? <span className="empty">일정 없음</span> : (
                  <>
                    {preview.visibleItems.map((item, itemIndex) => <p title={item} key={`${itemIndex}-${item}`}>{item}</p>)}
                    {preview.overflowCount > 0 && (
                      <span className="week-more" aria-label={`일정 ${preview.overflowCount}개 더 있음`}>+{preview.overflowCount}</span>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      )}
    </Panel>
  );
}
