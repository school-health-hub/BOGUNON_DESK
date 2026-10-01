import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataEmpty, WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";
import { useDesktopPanels } from "../components/desktop/DesktopPanelContext";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { openTodayTask } from "./todayTaskNavigation";

const statusLabel = {
  planned: "예정",
  inProgress: "진행 중",
  waitingForReply: "회신 대기",
  needsCheck: "확인 필요",
  completed: "완료",
  onHold: "보류",
} as const;

const timingLabel = {
  dueToday: "오늘 마감",
  scheduledToday: "오늘 수행",
} as const;

export function PriorityTaskWidget() {
  const { now } = useWidgetSession();
  const { openBogunonTask } = useDesktopPanels();
  const { state } = useWorkspaceData();
  const task = state.status === "ready"
    ? state.data.todayTasks.find((item) => !item.completed) ?? null
    : null;
  return (
    <section className="priority-card widget-surface" aria-labelledby="widget-priority-label">
      <div className="priority-card__label" id="widget-priority-label"><span aria-hidden="true" /> 지금 해야 할 일</div>
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : task === null ? (
        <WorkspaceDataEmpty>오늘 바로 처리할 업무가 없습니다.</WorkspaceDataEmpty>
      ) : <>
        <h2>
          <button
            type="button"
            className="priority-task-open"
            aria-label={`BOGUNON에서 ${task.title} 열기`}
            onClick={() => void openTodayTask(openBogunonTask, task.id, now)}
          >
            {task.title}
          </button>
        </h2>
        <div className="priority-card__meta"><span>BOGUNON · {timingLabel[task.todayReason]}</span><strong>{statusLabel[task.status]}</strong></div>
      </>}
    </section>
  );
}
