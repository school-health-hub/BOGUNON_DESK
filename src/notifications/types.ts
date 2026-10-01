export type WorkspaceNotificationReasonSettings = {
  readonly overdue: boolean;
  readonly dueToday: boolean;
  readonly followUp: boolean;
  readonly needsCheck: boolean;
};

export const DEFAULT_WORKSPACE_NOTIFICATION_REASONS: WorkspaceNotificationReasonSettings = {
  overdue: true,
  dueToday: true,
  followUp: true,
  needsCheck: true,
};

export const hasEnabledNotificationReason = (reasons: WorkspaceNotificationReasonSettings): boolean =>
  Object.values(reasons).some(Boolean);

export type NotificationDeviceSettings = {
  readonly workspaceNotificationsEnabled: boolean;
  readonly workspaceNotificationReasons: WorkspaceNotificationReasonSettings;
  readonly lastDailySummaryDate: string | null;
};

export type NativeNotificationPayload = {
  readonly title: string;
  readonly body: string;
};

export type NotificationPermission = "granted" | "denied" | "default";

export interface NotificationRepository {
  load(): Promise<NotificationDeviceSettings>;
  setEnabled(enabled: boolean): Promise<NotificationDeviceSettings>;
  setReasons(reasons: WorkspaceNotificationReasonSettings): Promise<NotificationDeviceSettings>;
  markDailySummarySent(date: string): Promise<void>;
  isPermissionGranted(): Promise<boolean>;
  requestPermission(): Promise<NotificationPermission>;
  send(payload: NativeNotificationPayload): Promise<void>;
}
