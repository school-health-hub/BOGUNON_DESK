import { Check, Circle } from "lucide-react";
import { useState } from "react";
import type { SurfaceTask } from "../projection";

export function TaskSurfaceWidget({ tasks }: Readonly<{ tasks: readonly SurfaceTask[] }>) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const sorted = [...tasks].sort((left, right) => Number(left.completed) - Number(right.completed) || left.order - right.order);
  const selectedTask = sorted.find(({ id }) => id === selectedTaskId) ?? null;
  if (sorted.length === 0) return <p className="surface-empty">오늘 확인할 합성 업무가 없습니다.</p>;
  return <div className="surface-tasks">
    <ul className="surface-task-list">
      {sorted.map((task) => <li className={`${task.completed ? "is-complete" : ""}${selectedTaskId === task.id ? " is-selected" : ""}`} key={task.id}>
        <button type="button" aria-label={`${task.label} 상세 보기`} aria-pressed={selectedTaskId === task.id}
          onClick={() => setSelectedTaskId((current) => current === task.id ? null : task.id)}>
          <span className="surface-task-list__check" aria-hidden="true">{task.completed ? <Check size={13} /> : <Circle size={12} />}</span>
          <span className="surface-task-list__copy"><strong title={task.label}>{task.label}</strong><small>{task.dueDate === null ? "마감일 없음" : `${task.dueDate} 마감`}</small></span>
        </button>
      </li>)}
    </ul>
    {selectedTask !== null && <div className="surface-task-detail" role="status">
      <strong>{selectedTask.label}</strong>
      <span>{selectedTask.completed ? "완료" : "미완료"} · {selectedTask.dueDate === null ? "마감일 없음" : `${selectedTask.dueDate} 마감`}</span>
      <small>Main 연결 시 업무 상세를 엽니다. Surface에서는 상태를 변경하지 않습니다.</small>
    </div>}
  </div>;
}
