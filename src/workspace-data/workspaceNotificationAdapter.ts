import type { WorkspaceArea } from "../settings/workspaceFilters";
import type {
  WorkspaceNotificationItem,
  WorkspaceSourceRows,
} from "./types";
import { adaptWorkspaceActionableTasks } from "./workspaceActionableTaskAdapter";

export const adaptWorkspaceNotifications = (
  rows: WorkspaceSourceRows,
  now: Date,
  enabledAreas: readonly WorkspaceArea[],
): readonly WorkspaceNotificationItem[] => {
  return adaptWorkspaceActionableTasks(rows.notificationTasks, now, enabledAreas)
    .slice(0, 4)
    .map(({ id, title, detail, relevantDate, tone }) => ({ id, title, detail, relevantDate, tone }));
};
