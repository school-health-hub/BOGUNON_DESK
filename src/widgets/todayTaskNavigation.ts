import { formatWorkspaceDate } from "../workspace-data/workspaceDataAdapter";

export type OpenBogunonTask = (taskId: string, date: string) => Promise<void>;

export const openTodayTask = (
  openBogunonTask: OpenBogunonTask,
  taskId: string,
  now: Date,
): Promise<void> => openBogunonTask(taskId, formatWorkspaceDate(now));
