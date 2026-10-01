import { useEffect, useState } from "react";
import type { AuthStatus } from "../auth/types";
import type { WorkspaceDataState } from "../workspace-data/types";
import { notificationService } from "./workspaceNotificationService";

const toLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const useWorkspaceNotifications = (
  authStatus: AuthStatus,
  workspaceState: WorkspaceDataState,
  now: Date,
): void => {
  const localDate = toLocalDate(now);
  const [settingsRevision, setSettingsRevision] = useState(0);
  useEffect(() => notificationService.subscribe(() => setSettingsRevision((value) => value + 1)), []);
  useEffect(() => {
    void notificationService.sendDailySummary({ authStatus, workspaceState, localDate });
  }, [authStatus, localDate, settingsRevision, workspaceState]);
};
