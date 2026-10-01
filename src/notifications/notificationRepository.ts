import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { isDesktopRuntime } from "../desktop/actions";
import { DEFAULT_WORKSPACE_NOTIFICATION_REASONS, type NotificationDeviceSettings, type NotificationRepository } from "./types";

const EMPTY_SETTINGS: NotificationDeviceSettings = {
  workspaceNotificationsEnabled: false,
  workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS,
  lastDailySummaryDate: null,
};

export const nativeNotificationRepository: NotificationRepository = {
  load: async () => isDesktopRuntime()
    ? invoke<NotificationDeviceSettings>("get_notification_settings")
    : EMPTY_SETTINGS,
  setEnabled: async (enabled) => {
    if (!isDesktopRuntime()) return { ...EMPTY_SETTINGS, workspaceNotificationsEnabled: enabled };
    return invoke<NotificationDeviceSettings>("set_workspace_notifications_enabled", { enabled });
  },
  setReasons: async (reasons) => {
    if (!isDesktopRuntime()) return { ...EMPTY_SETTINGS, workspaceNotificationReasons: reasons };
    return invoke<NotificationDeviceSettings>("set_workspace_notification_reasons", { reasons });
  },
  markDailySummarySent: async (date) => {
    if (isDesktopRuntime()) await invoke("mark_daily_summary_sent", { date });
  },
  isPermissionGranted: async () => isDesktopRuntime() && isPermissionGranted(),
  requestPermission: async () => isDesktopRuntime() ? requestPermission() : "denied",
  send: async (payload) => {
    if (!isDesktopRuntime()) throw new Error("Windows 알림은 Tauri 앱에서 사용할 수 있습니다.");
    sendNotification(payload);
  },
};
