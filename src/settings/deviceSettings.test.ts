import { beforeEach, describe, expect, it, vi } from "vitest";

const desktopActions = vi.hoisted(() => ({
  getLauncherSettings: vi.fn(),
  saveWorkPortalUrl: vi.fn(),
  saveWorkPortalAutoOpenDelay: vi.fn(),
}));

vi.mock("../notifications/workspaceNotificationService", () => ({
  notificationService: {
    load: vi.fn(async () => ({ workspaceNotificationsEnabled: false, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true }, lastDailySummaryDate: null })),
    setEnabled: vi.fn(async (enabled: boolean) => enabled),
    setReasons: vi.fn(async (reasons) => ({ workspaceNotificationsEnabled: false, workspaceNotificationReasons: reasons, lastDailySummaryDate: null })),
  },
}));

vi.mock("../desktop/actions", () => ({
  getAutostartEnabled: vi.fn(async () => false),
  getLauncherSettings: desktopActions.getLauncherSettings,
  saveWorkPortalUrl: desktopActions.saveWorkPortalUrl,
  saveWorkPortalAutoOpenDelay: desktopActions.saveWorkPortalAutoOpenDelay,
  setAutostartEnabled: vi.fn(),
  syncCloseToTray: vi.fn(),
}));

vi.mock("../desktop/storage", () => ({
  loadDesktopSettings: vi.fn(() => ({ closeToTray: true })),
  saveDesktopSettings: vi.fn(),
}));

import { deviceSettingsRepository, loadLocalDeviceSettings, normalizeWorkPortalAutoOpenDelay } from "./deviceSettings";

const launcherSettings = {
  onlineHealthRoomUrl: null,
  bogunonUrl: null,
  checkupToolUrl: null,
  workPortalUrl: null,
  workPortalAutoOpenDelay: "off" as const,
};

describe("device-only work portal settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults the work portal URL to null", () => {
    expect(loadLocalDeviceSettings(launcherSettings).workPortalUrl).toBeNull();
  });

  it("defaults workspace notifications to off", () => {
    expect(loadLocalDeviceSettings(launcherSettings).workspaceNotificationsEnabled).toBe(false);
  });

  it("defaults all workspace notification reasons to enabled", () => {
    expect(loadLocalDeviceSettings(launcherSettings).workspaceNotificationReasons)
      .toEqual({ overdue: true, dueToday: true, followUp: true, needsCheck: true });
  });

  it("does not serialize AI connection data into device settings", () => {
    const raw = JSON.stringify(loadLocalDeviceSettings(launcherSettings));
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("provider");
    expect(raw).not.toContain("connectionStatus");
  });

  it("saves and reloads the URL through the native device store", async () => {
    const saved = { ...launcherSettings, workPortalUrl: "https://portal.example.com/" };
    desktopActions.saveWorkPortalUrl.mockResolvedValue(saved);
    desktopActions.getLauncherSettings.mockResolvedValue(saved);

    expect((await deviceSettingsRepository.saveWorkPortalUrl("https://portal.example.com/")).workPortalUrl)
      .toBe("https://portal.example.com/");
    expect((await deviceSettingsRepository.load()).workPortalUrl)
      .toBe("https://portal.example.com/");
  });

  it.each(["off", "20s", "45s"] as const)("persists the %s auto-open delay in the native device store", async (delay) => {
    const saved = { ...launcherSettings, workPortalAutoOpenDelay: delay };
    desktopActions.saveWorkPortalAutoOpenDelay.mockResolvedValue(saved);
    desktopActions.getLauncherSettings.mockResolvedValue(saved);

    expect((await deviceSettingsRepository.saveWorkPortalAutoOpenDelay(delay)).workPortalAutoOpenDelay).toBe(delay);
    expect((await deviceSettingsRepository.load()).workPortalAutoOpenDelay).toBe(delay);
  });

  it("falls back to off when native storage returns an invalid delay", () => {
    expect(normalizeWorkPortalAutoOpenDelay("invalid")).toBe("off");
  });
});
