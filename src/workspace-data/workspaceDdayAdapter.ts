import { parseLocalDate } from "../dashboard/dateSource";
import type { WorkspaceArea } from "../settings/workspaceFilters";
import type {
  BogunonTaskPriority,
  WorkspaceDdayItem,
  WorkspaceSourceRows,
} from "./types";

type DdayCandidate = WorkspaceDdayItem & {
  readonly priority: BogunonTaskPriority | null;
};

const priorityRank: Readonly<Record<BogunonTaskPriority, number>> = {
  high: 0,
  normal: 1,
  low: 2,
};

const isCurrentOrFutureDate = (value: string, today: Date): boolean => {
  const date = parseLocalDate(value);
  return date !== null && date >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const adaptWorkspaceDdayItems = (
  rows: WorkspaceSourceRows,
  now: Date,
  enabledAreas: readonly WorkspaceArea[],
): readonly WorkspaceDdayItem[] => {
  const allowedAreas = new Set(enabledAreas);
  const candidates = new Map<string, DdayCandidate>();

  for (const task of rows.ddayTasks) {
    if (
      !allowedAreas.has(task.area)
      || task.due_date === null
      || task.status === "completed"
      || task.status === "onHold"
      || !isCurrentOrFutureDate(task.due_date, now)
    ) continue;
    const key = `task:${task.id}`;
    if (!candidates.has(key)) candidates.set(key, {
      id: task.id,
      targetDate: task.due_date,
      title: task.title,
      source: "task",
      priority: task.priority,
    });
  }

  for (const event of rows.ddayEvents) {
    if (!allowedAreas.has(event.area) || !isCurrentOrFutureDate(event.start_date, now)) continue;
    const key = `event:${event.id}`;
    if (!candidates.has(key)) candidates.set(key, {
      id: event.id,
      targetDate: event.start_date,
      title: event.title,
      source: "event",
      priority: null,
    });
  }

  return [...candidates.values()]
    .sort((left, right) => (
      left.targetDate.localeCompare(right.targetDate)
      || Number(left.source === "event") - Number(right.source === "event")
      || (left.priority === null || right.priority === null ? 0 : priorityRank[left.priority] - priorityRank[right.priority])
      || left.title.localeCompare(right.title)
    ))
    .slice(0, 4)
    .map(({ priority: _priority, ...item }) => item);
};
