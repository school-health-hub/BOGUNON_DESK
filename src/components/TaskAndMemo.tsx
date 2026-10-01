import { Check, CheckSquare2, Plus, StickyNote } from "lucide-react";
import { useState } from "react";
import { initialTasks } from "../data/mockData";
import type { HealthTask } from "../types/dashboard";
import { Panel } from "./Panel";

export function TaskAndMemo() {
  const [tasks, setTasks] = useState<readonly HealthTask[]>(initialTasks);
  const completedCount = tasks.filter((task) => task.completed).length;
  const completionRate = Math.round((completedCount / tasks.length) * 100);

  const toggleTask = (taskId: string) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task));
  };

  return (
    <div className="center-stack">
      <Panel
        title="오늘의 보건업무"
        icon={CheckSquare2}
        className="task-panel"
        action={<button className="text-button" type="button"><Plus size={15} /> 업무 추가</button>}
      >
        <div className="task-progress"><span>오늘 {tasks.length}개 중 {completedCount}개 완료</span><strong>{completionRate}%</strong></div>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${completionRate}%` }} /></div>
        <ul className="task-list">
          {tasks.map((task) => (
            <li className={task.completed ? "is-complete" : ""} key={task.id}>
              <button className="task-check" type="button" role="checkbox" onClick={() => toggleTask(task.id)} aria-label={`${task.title} ${task.completed ? "미완료로 변경" : "완료로 변경"}`} aria-checked={task.completed}>
                {task.completed && <Check size={13} strokeWidth={3} />}
              </button>
              <span className="task-title">{task.title}</span>
              {task.time && <time>{task.time}</time>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="빠른 메모" icon={StickyNote} className="memo-panel">
        <label className="sr-only" htmlFor="quick-memo">빠른 메모 입력</label>
        <textarea id="quick-memo" placeholder="잊기 전에 메모해 두세요." defaultValue="" />
        <p>이 메모는 현재 PC에만 표시되며 아직 저장되지 않습니다.</p>
      </Panel>
    </div>
  );
}
