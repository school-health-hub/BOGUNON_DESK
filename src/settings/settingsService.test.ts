import { describe, expect, it, vi } from "vitest";
import { createDefaultDashboardLayout } from "../dashboard/layouts";
import { createDefaultDockLayout } from "../dock/storage";
import type { AccountSettingsRepository, DeviceSettingsRepository } from "./types";
import { createSettingsService } from "./settingsService";
import { defaultWorkspaceFilters } from "./workspaceFilters";
import { defaultPurchaseOutputColumns } from "../purchase/types";

describe("settings service sync boundary", () => {
  it("notifies sync only after immediate account saves, never after device changes", async () => {
    const workspace = createDefaultDashboardLayout();
    const dock = createDefaultDockLayout();
    const launcherLinks = {
      onlineHealthRoomUrl: null,
      bogunonUrl: null,
      checkupToolUrl: null,
    };
    const account = {
      load: vi.fn(async () => ({ workspace, dock, launcherLinks, workspaceFilters: defaultWorkspaceFilters, purchaseOutputColumns: defaultPurchaseOutputColumns, purchaseImportTemplates: [], purchaseDraftTemplates: [] })),
      replace: vi.fn(async () => undefined),
      loadWorkspace: vi.fn(() => workspace),
      saveWorkspace: vi.fn(),
      loadDock: vi.fn(() => dock),
      saveDock: vi.fn(),
      loadLauncherLinks: vi.fn(async () => launcherLinks),
      saveLauncherLink: vi.fn(async () => launcherLinks),
      loadWorkspaceFilters: vi.fn(() => defaultWorkspaceFilters),
      saveWorkspaceFilters: vi.fn(),
      subscribeWorkspaceFilters: vi.fn(() => () => undefined),
      loadPurchaseOutputColumns: vi.fn(() => defaultPurchaseOutputColumns),
      savePurchaseOutputColumns: vi.fn(),
      loadPurchaseImportTemplates: vi.fn(() => []),
      savePurchaseImportTemplates: vi.fn(),
      loadPurchaseDraftTemplates: vi.fn(() => []),
      savePurchaseDraftTemplates: vi.fn(),
    } satisfies AccountSettingsRepository;
    const device = {
      load: vi.fn(async () => ({ closeToTray: true, workPortalUrl: null, workPortalAutoOpenDelay: "off" as const, workspaceNotificationsEnabled: false, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true } })),
      loadCloseToTray: vi.fn(() => true),
      setCloseToTray: vi.fn(async () => undefined),
      saveWorkPortalUrl: vi.fn(async () => ({ closeToTray: true, workPortalUrl: "https://portal.example.com/", workPortalAutoOpenDelay: "off" as const, workspaceNotificationsEnabled: false, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true } })),
      saveWorkPortalAutoOpenDelay: vi.fn(async () => ({ closeToTray: true, workPortalUrl: null, workPortalAutoOpenDelay: "20s" as const, workspaceNotificationsEnabled: false, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true } })),
      setWorkspaceNotificationsEnabled: vi.fn(async (enabled: boolean) => ({ closeToTray: true, workPortalUrl: null, workPortalAutoOpenDelay: "off" as const, workspaceNotificationsEnabled: enabled, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true } })),
      setWorkspaceNotificationReasons: vi.fn(async (workspaceNotificationReasons) => ({ closeToTray: true, workPortalUrl: null, workPortalAutoOpenDelay: "off" as const, workspaceNotificationsEnabled: false, workspaceNotificationReasons })),
      getAutostartEnabled: vi.fn(async () => false),
      setAutostartEnabled: vi.fn(async (enabled: boolean) => enabled),
    } satisfies DeviceSettingsRepository;
    const sync = { noteLocalChange: vi.fn() };
    const service = createSettingsService(account, device, sync);

    service.account.saveWorkspace(workspace);
    service.account.saveDock(dock);
    await service.account.saveLauncherLink("bogunon", "https://example.com/");
    service.account.saveWorkspaceFilters({ ...defaultWorkspaceFilters, personal: true });
    service.account.savePurchaseDraftTemplates([]);

    const workspaceSaveOrder = account.saveWorkspace.mock.invocationCallOrder[0];
    const dockSaveOrder = account.saveDock.mock.invocationCallOrder[0];
    const launcherSaveOrder = account.saveLauncherLink.mock.invocationCallOrder[0];
    const filterSaveOrder = account.saveWorkspaceFilters.mock.invocationCallOrder[0];
    const workspaceSyncOrder = sync.noteLocalChange.mock.invocationCallOrder[0];
    const dockSyncOrder = sync.noteLocalChange.mock.invocationCallOrder[1];
    const launcherSyncOrder = sync.noteLocalChange.mock.invocationCallOrder[2];
    const filterSyncOrder = sync.noteLocalChange.mock.invocationCallOrder[3];
    if (
      workspaceSaveOrder === undefined
      || dockSaveOrder === undefined
      || launcherSaveOrder === undefined
      || filterSaveOrder === undefined
      || workspaceSyncOrder === undefined
      || dockSyncOrder === undefined
      || launcherSyncOrder === undefined
      || filterSyncOrder === undefined
    ) throw new Error("account save and sync notifications were not recorded");
    expect(workspaceSaveOrder).toBeLessThan(workspaceSyncOrder);
    expect(dockSaveOrder).toBeLessThan(dockSyncOrder);
    expect(launcherSaveOrder).toBeLessThan(launcherSyncOrder);
    expect(filterSaveOrder).toBeLessThan(filterSyncOrder);
    expect(account.savePurchaseDraftTemplates).toHaveBeenCalledWith([]);
    expect(sync.noteLocalChange).toHaveBeenCalledTimes(5);

    await service.device.setCloseToTray(false);
    await service.device.saveWorkPortalUrl("https://portal.example.com/");
    await service.device.saveWorkPortalAutoOpenDelay("20s");
    await service.device.setWorkspaceNotificationsEnabled(true);
    await service.device.setWorkspaceNotificationReasons({ overdue: true, dueToday: false, followUp: false, needsCheck: false });
    await service.device.setAutostartEnabled(true);

    expect(sync.noteLocalChange).toHaveBeenCalledTimes(5);
  });
});
