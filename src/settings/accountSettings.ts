import { loadDashboardLayout, saveDashboardLayout } from "../dashboard/storage";
import { getLauncherSettings, replaceAccountLauncherLinks, saveLauncherUrl } from "../desktop/actions";
import { loadDockLayout, saveDockLayout } from "../dock/storage";
import type { ConfigurableUrlActionId, LauncherSettings } from "../desktop/types";
import type {
  AccountLauncherLinks,
  AccountSettings,
  AccountSettingsRepository,
} from "./types";
import { loadWorkspaceFilters, saveWorkspaceFilters, subscribeWorkspaceFilters } from "./workspaceFilters";
import { loadPurchaseOutputColumns, savePurchaseOutputColumns } from "../purchase/purchaseOutputSettings";
import { loadPurchaseImportTemplates, savePurchaseImportTemplates } from "../purchase/purchaseImportSettings";
import { loadPurchaseDraftTemplates, savePurchaseDraftTemplates } from "../purchase/purchaseDraftSettings";
import { createDefaultDashboardLayout } from "../dashboard/layouts";
import { createDefaultDockLayout } from "../dock/storage";
import { defaultWorkspaceFilters } from "./workspaceFilters";
import { defaultPurchaseOutputColumns } from "../purchase/types";

export const emptyAccountLauncherLinks: AccountLauncherLinks = {
  onlineHealthRoomUrl: null,
  bogunonUrl: null,
  checkupToolUrl: null,
};

export const createDefaultAccountSettings = (): AccountSettings => ({
  workspace: createDefaultDashboardLayout(),
  dock: createDefaultDockLayout(),
  launcherLinks: emptyAccountLauncherLinks,
  workspaceFilters: defaultWorkspaceFilters,
  purchaseOutputColumns: defaultPurchaseOutputColumns,
  purchaseImportTemplates: [],
  purchaseDraftTemplates: [],
});

export const accountLauncherLinksFromLegacyStore = (
  settings: LauncherSettings,
): AccountLauncherLinks => ({
  onlineHealthRoomUrl: settings.onlineHealthRoomUrl,
  bogunonUrl: settings.bogunonUrl,
  checkupToolUrl: settings.checkupToolUrl,
});

const loadAccountSettings = async (): Promise<AccountSettings> => ({
  workspace: loadDashboardLayout(),
  dock: loadDockLayout(),
  launcherLinks: accountLauncherLinksFromLegacyStore(await getLauncherSettings()),
  workspaceFilters: loadWorkspaceFilters(),
  purchaseOutputColumns: loadPurchaseOutputColumns(),
  purchaseImportTemplates: loadPurchaseImportTemplates(),
  purchaseDraftTemplates: loadPurchaseDraftTemplates(),
});

const loadAccountLauncherLinks = async (): Promise<AccountLauncherLinks> =>
  accountLauncherLinksFromLegacyStore(await getLauncherSettings());

const saveAccountLauncherLink = async (
  actionId: ConfigurableUrlActionId,
  url: string,
): Promise<AccountLauncherLinks> =>
  accountLauncherLinksFromLegacyStore(await saveLauncherUrl(actionId, url));

const replaceAccountSettings = async (settings: AccountSettings): Promise<void> => {
  saveDashboardLayout(settings.workspace);
  saveDockLayout(settings.dock);
  await replaceAccountLauncherLinks(settings.launcherLinks);
  saveWorkspaceFilters(settings.workspaceFilters);
  savePurchaseOutputColumns(settings.purchaseOutputColumns);
  savePurchaseImportTemplates(settings.purchaseImportTemplates);
  savePurchaseDraftTemplates(settings.purchaseDraftTemplates);
};

export const accountSettingsRepository = {
  load: loadAccountSettings,
  replace: replaceAccountSettings,
  loadWorkspace: loadDashboardLayout,
  saveWorkspace: saveDashboardLayout,
  loadDock: loadDockLayout,
  saveDock: saveDockLayout,
  loadLauncherLinks: loadAccountLauncherLinks,
  saveLauncherLink: saveAccountLauncherLink,
  loadWorkspaceFilters,
  saveWorkspaceFilters,
  subscribeWorkspaceFilters,
  loadPurchaseOutputColumns,
  savePurchaseOutputColumns,
  loadPurchaseImportTemplates,
  savePurchaseImportTemplates,
  loadPurchaseDraftTemplates,
  savePurchaseDraftTemplates,
} as const satisfies AccountSettingsRepository;
