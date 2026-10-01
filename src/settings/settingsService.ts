import { accountSettingsRepository } from "./accountSettings";
import { accountSyncService } from "./accountSyncService";
import { deviceSettingsRepository } from "./deviceSettings";
import type { AccountSettingsRepository, DeviceSettingsRepository, SettingsPanelSnapshot } from "./types";

type AccountSyncNotifier = {
  readonly noteLocalChange: () => void;
};

export const createSettingsService = (
  accountRepository: AccountSettingsRepository,
  deviceRepository: DeviceSettingsRepository,
  syncNotifier: AccountSyncNotifier,
) => {
  const loadSettingsPanel = async (): Promise<SettingsPanelSnapshot> => {
    const [account, device, autostartEnabled] = await Promise.all([
      accountRepository.load(),
      deviceRepository.load(),
      deviceRepository.getAutostartEnabled(),
    ]);
    return {
      account,
      device,
      autostartEnabled,
    };
  };

  return {
  account: {
    load: accountRepository.load,
    loadWorkspace: accountRepository.loadWorkspace,
    saveWorkspace: (workspace: Parameters<AccountSettingsRepository["saveWorkspace"]>[0]) => {
      accountRepository.saveWorkspace(workspace);
      syncNotifier.noteLocalChange();
    },
    loadDock: accountRepository.loadDock,
    saveDock: (dock: Parameters<AccountSettingsRepository["saveDock"]>[0]) => {
      accountRepository.saveDock(dock);
      syncNotifier.noteLocalChange();
    },
    loadLauncherLinks: accountRepository.loadLauncherLinks,
    saveLauncherLink: async (...args: Parameters<AccountSettingsRepository["saveLauncherLink"]>) => {
      const links = await accountRepository.saveLauncherLink(...args);
      syncNotifier.noteLocalChange();
      return links;
    },
    loadWorkspaceFilters: accountRepository.loadWorkspaceFilters,
    subscribeWorkspaceFilters: accountRepository.subscribeWorkspaceFilters,
    saveWorkspaceFilters: (filters: Parameters<AccountSettingsRepository["saveWorkspaceFilters"]>[0]) => {
      accountRepository.saveWorkspaceFilters(filters);
      syncNotifier.noteLocalChange();
    },
    loadPurchaseOutputColumns: accountRepository.loadPurchaseOutputColumns,
    savePurchaseOutputColumns: (columns: Parameters<AccountSettingsRepository["savePurchaseOutputColumns"]>[0]) => {
      accountRepository.savePurchaseOutputColumns(columns);
      syncNotifier.noteLocalChange();
    },
    loadPurchaseImportTemplates: accountRepository.loadPurchaseImportTemplates,
    savePurchaseImportTemplates: (templates: Parameters<AccountSettingsRepository["savePurchaseImportTemplates"]>[0]) => {
      accountRepository.savePurchaseImportTemplates(templates);
      syncNotifier.noteLocalChange();
    },
    loadPurchaseDraftTemplates: accountRepository.loadPurchaseDraftTemplates,
    savePurchaseDraftTemplates: (templates: Parameters<AccountSettingsRepository["savePurchaseDraftTemplates"]>[0]) => {
      accountRepository.savePurchaseDraftTemplates(templates);
      syncNotifier.noteLocalChange();
    },
  },
  device: {
    load: deviceRepository.load,
    getCloseToTray: deviceRepository.loadCloseToTray,
    setCloseToTray: deviceRepository.setCloseToTray,
    saveWorkPortalUrl: deviceRepository.saveWorkPortalUrl,
    saveWorkPortalAutoOpenDelay: deviceRepository.saveWorkPortalAutoOpenDelay,
    setWorkspaceNotificationsEnabled: deviceRepository.setWorkspaceNotificationsEnabled,
    setWorkspaceNotificationReasons: deviceRepository.setWorkspaceNotificationReasons,
    getAutostartEnabled: deviceRepository.getAutostartEnabled,
    setAutostartEnabled: deviceRepository.setAutostartEnabled,
  },
  loadPanel: loadSettingsPanel,
  } as const;
};

export const settingsService = createSettingsService(
  accountSettingsRepository,
  deviceSettingsRepository,
  accountSyncService,
);
