import type { WorkspaceTask } from "./types";

const priorityRank = { high: 0, normal: 1, low: 2 } as const;
const todayReasonRank = { dueToday: 0, scheduledToday: 1 } as const;

export const compareTodayTasks = (left: WorkspaceTask, right: WorkspaceTask): number => (
  Number(left.completed) - Number(right.completed)
  || todayReasonRank[left.todayReason] - todayReasonRank[right.todayReason]
  || priorityRank[left.priority] - priorityRank[right.priority]
  || left.title.localeCompare(right.title)
  || left.id.localeCompare(right.id)
);
