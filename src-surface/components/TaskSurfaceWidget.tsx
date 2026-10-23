import { Check, Circle } from "lucide-react";
import type { SurfaceTask } from "../projection";

export function TaskSurfaceWidget({ tasks }: Readonly<{ tasks: readonly SurfaceTask[] }>) {
  const sorted = [...tasks].sort((left, right) => Number(left.completed) - Number(right.completed) || left.order - right.order);
  if (sorted.length === 0) return <p className="surface-empty">오늘 확인할 합성 업무가 없습니다.</p>;
  return <ul className="surface-task-list">
    {sorted.map((task) => <li className={task.completed ? "is-complete" : ""} key={task.id}>
      <span className="surface-task-list__check" aria-hidden="true">{task.completed ? <Check size={13} /> : <Circle size={12} />}</span>
      <span className="surface-task-list__copy"><strong title={task.label}>{task.label}</strong><small>{task.dueDate === null ? "마감일 없음" : `${task.dueDate} 마감`}</small></span>
    </li>)}
  </ul>;
}
