import { Sparkles } from "lucide-react";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";
import { formatDday } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";

export function TodaySummaryWidget() {
  const { now } = useWidgetSession();
  const { state } = useWorkspaceData();
  const summary = state.status === "ready" ? state.data.summary : null;
  const nearestDday = state.status === "ready" ? state.data.ddayItems[0] : undefined;
  return (
    <section className="summary-card widget-surface" aria-labelledby="widget-today-summary-title">
      <div className="summary-card__heading">
        <Sparkles size={15} />
        <h1 id="widget-today-summary-title">오늘의 보건실</h1>
      </div>
      <div className="summary-stats">
        <div className="summary-stats__today">
          <span>오늘</span>
          <strong>{summary?.todayEventCount ?? "—"} 일정 · {summary?.todayTaskCount ?? "—"} 업무</strong>
        </div>
        <div><span>남은 업무</span><strong className="summary-stats__urgent">{summary?.incompleteTaskCount ?? "—"}</strong></div>
        <div className="summary-stats__dday"><span>가까운 D-Day</span><strong>{nearestDday === undefined ? "—" : `${formatDday(nearestDday.targetDate, now)} · ${nearestDday.title}`}</strong></div>
      </div>
      {state.status !== "ready" && <WorkspaceDataNotice state={state} />}
    </section>
  );
}
