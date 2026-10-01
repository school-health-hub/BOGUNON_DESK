import type { DashboardLayout } from "../dashboard/types";
import type { ConfigurableUrlActionId, WorkPortalAutoOpenDelay } from "../desktop/types";
import type { DockLayout } from "../dock/types";
import type { WorkspaceFilters } from "./workspaceFilters";
import type { WorkspaceNotificationReasonSettings } from "../notifications/types";
import type { PurchaseDraftTemplate, PurchaseImportTemplate, PurchaseOutputColumnId } from "../purchase/types";

export const syncStatuses = ["localOnly", "signedOut", "syncing", "synced", "error"] as const;
export type SyncStatus = (typeof syncStatuses)[number];

export type AccountLauncherLinks = {
  readonly onlineHealthRoomUrl: string | null;
  readonly bogunonUrl: string | null;
  readonly checkupToolUrl: string | null;
};

export type AccountSettings = {
  readonly workspace: DashboardLayout;
  readonly dock: DockLayout;
  readonly launcherLinks: AccountLauncherLinks;
  readonly workspaceFilters: WorkspaceFilters;
  readonly purchaseOutputColumns: readonly PurchaseOutputColumnId[];
  readonly purchaseImportTemplates: readonly PurchaseImportTemplate[];
  readonly purchaseDraftTemplates: readonly PurchaseDraftTemplate[];
};

export type DeviceSettings = {
  readonly closeToTray: boolean;
  readonly workPortalUrl: string | null;
  readonly workPortalAutoOpenDelay: WorkPortalAutoOpenDelay;
  readonly workspaceNotificationsEnabled: boolean;
  readonly workspaceNotificationReasons: WorkspaceNotificationReasonSettings;
};

export type SettingsPanelSnapshot = {
  readonly account: AccountSettings;
  readonly device: DeviceSettings;
  readonly autostartEnabled: boolean;
};

export type AccountSettingsRepository = {
  readonly load: () => Promise<AccountSettings>;
  readonly replace: (settings: AccountSettings) => Promise<void>;
  readonly loadWorkspace: () => DashboardLayout;
  readonly saveWorkspace: (workspace: DashboardLayout) => void;
  readonly loadDock: () => DockLayout;
  readonly saveDock: (dock: DockLayout) => void;
  readonly loadLauncherLinks: () => Promise<AccountLauncherLinks>;
  readonly saveLauncherLink: (
    actionId: ConfigurableUrlActionId,
    url: string,
  ) => Promise<AccountLauncherLinks>;
  readonly loadWorkspaceFilters: () => WorkspaceFilters;
  readonly saveWorkspaceFilters: (filters: WorkspaceFilters) => void;
  readonly subscribeWorkspaceFilters: (listener: (filters: WorkspaceFilters) => void) => () => void;
  readonly loadPurchaseOutputColumns: () => readonly PurchaseOutputColumnId[];
  readonly savePurchaseOutputColumns: (columns: readonly PurchaseOutputColumnId[]) => void;
  readonly loadPurchaseImportTemplates: () => readonly PurchaseImportTemplate[];
  readonly savePurchaseImportTemplates: (templates: readonly PurchaseImportTemplate[]) => void;
  readonly loadPurchaseDraftTemplates: () => readonly PurchaseDraftTemplate[];
  readonly savePurchaseDraftTemplates: (templates: readonly PurchaseDraftTemplate[]) => void;
};

export type AccountSyncState = {
  readonly status: SyncStatus;
  readonly lastSyncedAt: number | null;
};

export type DeviceSettingsRepository = {
  readonly load: () => Promise<DeviceSettings>;
  readonly loadCloseToTray: () => boolean;
  readonly setCloseToTray: (enabled: boolean) => Promise<void>;
  readonly saveWorkPortalUrl: (url: string | null) => Promise<DeviceSettings>;
  readonly saveWorkPortalAutoOpenDelay: (delay: WorkPortalAutoOpenDelay) => Promise<DeviceSettings>;
  readonly setWorkspaceNotificationsEnabled: (enabled: boolean) => Promise<DeviceSettings>;
  readonly setWorkspaceNotificationReasons: (reasons: WorkspaceNotificationReasonSettings) => Promise<DeviceSettings>;
  readonly getAutostartEnabled: () => Promise<boolean>;
  readonly setAutostartEnabled: (enabled: boolean) => Promise<boolean>;
};
