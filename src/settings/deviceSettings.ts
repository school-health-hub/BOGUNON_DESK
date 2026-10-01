import {
  getAutostartEnabled,
  getLauncherSettings,
  saveWorkPortalUrl,
  saveWorkPortalAutoOpenDelay,
  setAutostartEnabled,
  syncCloseToTray,
} from "../desktop/actions";
import { loadDesktopSettings, saveCloseToTraySetting } from "../desktop/storage";
import type { LauncherSettings } from "../desktop/types";
import { workPortalAutoOpenDelays, type WorkPortalAutoOpenDelay } from "../desktop/types";
import type { DeviceSettings, DeviceSettingsRepository } from "./types";
import { notificationService } from "../notifications/workspaceNotificationService";
import { DEFAULT_WORKSPACE_NOTIFICATION_REASONS, type NotificationDeviceSettings, type WorkspaceNotificationReasonSettings } from "../notifications/types";

export const loadLocalDeviceSettings = (
  launcherSettings?: LauncherSettings,
  notificationSettings: NotificationDeviceSettings = {
    workspaceNotificationsEnabled: false,
    workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS,
    lastDailySummaryDate: null,
  },
): DeviceSettings => ({
  closeToTray: loadDesktopSettings().closeToTray,
  workPortalUrl: launcherSettings?.workPortalUrl ?? null,
  workPortalAutoOpenDelay: normalizeWorkPortalAutoOpenDelay(launcherSettings?.workPortalAutoOpenDelay),
  workspaceNotificationsEnabled: notificationSettings.workspaceNotificationsEnabled,
  workspaceNotificationReasons: notificationSettings.workspaceNotificationReasons,
});

export const normalizeWorkPortalAutoOpenDelay = (value: unknown): WorkPortalAutoOpenDelay =>
  workPortalAutoOpenDelays.find((delay) => delay === value) ?? "off";

export const saveLocalCloseToTray = (enabled: boolean): void => {
  saveCloseToTraySetting(enabled);
};

const loadDeviceSettings = async (): Promise<DeviceSettings> => {
  const [launcherSettings, notificationSettings] = await Promise.all([
    getLauncherSettings(),
    notificationService.load(),
  ]);
  return loadLocalDeviceSettings(launcherSettings, notificationSettings);
};

const updateCloseToTray = async (enabled: boolean): Promise<void> => {
  await syncCloseToTray(enabled);
  saveLocalCloseToTray(enabled);
};

const updateWorkPortalUrl = async (url: string | null): Promise<DeviceSettings> => {
  const [launcherSettings, notificationSettings] = await Promise.all([
    saveWorkPortalUrl(url),
    notificationService.load(),
  ]);
  return loadLocalDeviceSettings(launcherSettings, notificationSettings);
};

const updateWorkPortalAutoOpenDelay = async (
  delay: WorkPortalAutoOpenDelay,
): Promise<DeviceSettings> => {
  const [launcherSettings, notificationSettings] = await Promise.all([
    saveWorkPortalAutoOpenDelay(delay),
    notificationService.load(),
  ]);
  return loadLocalDeviceSettings(launcherSettings, notificationSettings);
};

const updateWorkspaceNotifications = async (enabled: boolean): Promise<DeviceSettings> => {
  const actualEnabled = await notificationService.setEnabled(enabled);
  const [launcherSettings, notificationSettings] = await Promise.all([getLauncherSettings(), notificationService.load()]);
  return loadLocalDeviceSettings(launcherSettings, { ...notificationSettings, workspaceNotificationsEnabled: actualEnabled });
};

const updateWorkspaceNotificationReasons = async (reasons: WorkspaceNotificationReasonSettings): Promise<DeviceSettings> => {
  const [notificationSettings, launcherSettings] = await Promise.all([
    notificationService.setReasons(reasons),
    getLauncherSettings(),
  ]);
  return loadLocalDeviceSettings(launcherSettings, notificationSettings);
};

export const deviceSettingsRepository = {
  load: loadDeviceSettings,
  loadCloseToTray: () => loadDesktopSettings().closeToTray,
  setCloseToTray: updateCloseToTray,
  saveWorkPortalUrl: updateWorkPortalUrl,
  saveWorkPortalAutoOpenDelay: updateWorkPortalAutoOpenDelay,
  setWorkspaceNotificationsEnabled: updateWorkspaceNotifications,
  setWorkspaceNotificationReasons: updateWorkspaceNotificationReasons,
  getAutostartEnabled,
  setAutostartEnabled,
} as const satisfies DeviceSettingsRepository;
