import { Check, CheckSquare2 } from "lucide-react";
import { Panel } from "../components/Panel";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataEmpty, WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";
import { useDesktopPanels } from "../components/desktop/DesktopPanelContext";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { openTodayTask } from "./todayTaskNavigation";

const timingLabel = {
  dueToday: "오늘 마감",
  scheduledToday: "오늘 수행",
} as const;

export function TodayTasksWidget() {
  const { now } = useWidgetSession();
  const { openBogunonTask } = useDesktopPanels();
  const { state, setTaskCompleted, pendingTaskId, taskMutationError } = useWorkspaceData();
  const tasks = state.status === "ready" ? state.data.todayTasks : [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const completionRate = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  return (
    <Panel
      title="오늘의 보건업무"
      icon={CheckSquare2}
      className="task-panel"
      action={<span className="workspace-readonly-badge">BOGUNON 연동</span>}
    >
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : tasks.length === 0 ? (
        <WorkspaceDataEmpty>오늘 예정된 업무가 없습니다.</WorkspaceDataEmpty>
      ) : <>
      <div className="task-progress"><span>오늘 {tasks.length}개 중 {completedCount}개 완료</span><strong>{completionRate}%</strong></div>
      <div className="progress-track" aria-hidden="true"><span style={{ width: `${completionRate}%` }} /></div>
      <ul className="task-list">
        {tasks.map((task) => (
          <li className={task.completed ? "is-complete" : ""} key={task.id}>
            <button
              className="task-check"
              type="button"
              role="checkbox"
              aria-label={`${task.title} ${task.completed ? "완료 해제" : "완료 처리"}`}
              aria-checked={task.completed}
              disabled={pendingTaskId !== null}
              onClick={() => void setTaskCompleted(task.id, !task.completed)}
            >
              {task.completed && <Check size={13} strokeWidth={3} />}
            </button>
            <button
              type="button"
              className="task-title task-title-action"
              aria-label={`BOGUNON에서 ${task.title} 열기`}
              onClick={() => void openTodayTask(openBogunonTask, task.id, now)}
            >
              {task.title}
            </button>
            <span className={`task-row-meta ${task.completed ? "is-complete" : task.todayReason === "dueToday" ? "is-due" : "is-scheduled"}`}>
              {task.completed ? "완료" : timingLabel[task.todayReason]}
            </span>
          </li>
        ))}
      </ul>
      {taskMutationError !== null && <p className="task-mutation-error" role="status">{taskMutationError}</p>}
      </>}
    </Panel>
  );
}
