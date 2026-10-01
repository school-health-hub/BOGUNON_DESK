import { getSupabaseClient } from "../auth/supabaseClient";
import { parseDashboardLayoutValue } from "../dashboard/storage";
import { parseDockLayoutValue } from "../dock/storage";
import type { AccountLauncherLinks, AccountSettings } from "./types";
import { normalizeWorkspaceFilters } from "./workspaceFilters";
import { normalizePurchaseOutputColumns } from "../purchase/purchaseDomain";
import { normalizePurchaseImportTemplates } from "../purchase/purchaseImportSettings";
import { normalizePurchaseDraftTemplates } from "../purchase/purchaseDraftSettings";

const TABLE_NAME = "school_health_desk_settings";
const SETTINGS_VERSION = 1;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseOptionalWebUrl = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
      return undefined;
    }
    return url.toString();
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
};

const parseLauncherLinks = (value: unknown): AccountLauncherLinks | null => {
  if (!isRecord(value)) return null;
  const onlineHealthRoomUrl = parseOptionalWebUrl(value.onlineHealthRoomUrl);
  const bogunonUrl = parseOptionalWebUrl(value.bogunonUrl);
  const checkupToolUrl = parseOptionalWebUrl(value.checkupToolUrl);
  if (
    onlineHealthRoomUrl === undefined
    || bogunonUrl === undefined
    || checkupToolUrl === undefined
  ) return null;
  return { onlineHealthRoomUrl, bogunonUrl, checkupToolUrl };
};

export const serializeAccountSettings = (settings: AccountSettings): AccountSettings => ({
  workspace: {
    version: settings.workspace.version,
    ...(settings.workspace.presetId === undefined ? {} : { presetId: settings.workspace.presetId }),
    widgets: settings.workspace.widgets.map(({ id, type, x, y, w, h, visible }) => ({
      id,
      type,
      x,
      y,
      w,
      h,
      visible,
    })),
    appearance: {
      background: settings.workspace.appearance.background,
      cardStyle: settings.workspace.appearance.cardStyle,
      cornerStyle: settings.workspace.appearance.cornerStyle,
    },
  },
  dock: {
    version: settings.dock.version,
    items: settings.dock.items.map(({ id, visible }) => ({ id, visible })),
  },
  launcherLinks: {
    onlineHealthRoomUrl: settings.launcherLinks.onlineHealthRoomUrl,
    bogunonUrl: settings.launcherLinks.bogunonUrl,
    checkupToolUrl: settings.launcherLinks.checkupToolUrl,
  },
  workspaceFilters: normalizeWorkspaceFilters(settings.workspaceFilters),
  purchaseOutputColumns: normalizePurchaseOutputColumns(settings.purchaseOutputColumns),
  purchaseImportTemplates: normalizePurchaseImportTemplates(settings.purchaseImportTemplates),
  purchaseDraftTemplates: normalizePurchaseDraftTemplates(settings.purchaseDraftTemplates),
});

export const parseRemoteAccountSettings = (
  version: unknown,
  value: unknown,
): AccountSettings | null => {
  if (version !== SETTINGS_VERSION || !isRecord(value)) return null;
  const workspace = parseDashboardLayoutValue(value.workspace);
  const dock = parseDockLayoutValue(value.dock);
  const launcherLinks = parseLauncherLinks(value.launcherLinks);
  if (workspace === null || dock === null || launcherLinks === null) return null;
  return { workspace, dock, launcherLinks, workspaceFilters: normalizeWorkspaceFilters(value.workspaceFilters), purchaseOutputColumns: normalizePurchaseOutputColumns(value.purchaseOutputColumns), purchaseImportTemplates: normalizePurchaseImportTemplates(value.purchaseImportTemplates), purchaseDraftTemplates: normalizePurchaseDraftTemplates(value.purchaseDraftTemplates) };
};

export type RemoteAccountSettingsLoadResult =
  | { readonly kind: "missing" }
  | { readonly kind: "found"; readonly settings: AccountSettings }
  | { readonly kind: "invalid" };

export type RemoteAccountSettingsRepository = {
  readonly load: (userId: string, signal: AbortSignal) => Promise<RemoteAccountSettingsLoadResult>;
  readonly save: (userId: string, settings: AccountSettings, signal: AbortSignal) => Promise<void>;
};

class AccountSettingsRemoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountSettingsRemoteError";
  }
}

const loadRemoteAccountSettings = async (
  userId: string,
  signal: AbortSignal,
): Promise<RemoteAccountSettingsLoadResult> => {
  const { data, error } = await getSupabaseClient()
    .from(TABLE_NAME)
    .select("settings_version, settings")
    .eq("user_id", userId)
    .abortSignal(signal)
    .maybeSingle();
  if (error !== null) throw new AccountSettingsRemoteError(error.message);
  if (data === null) return { kind: "missing" };
  const settings = parseRemoteAccountSettings(data.settings_version, data.settings);
  return settings === null ? { kind: "invalid" } : { kind: "found", settings };
};

const saveRemoteAccountSettings = async (
  userId: string,
  settings: AccountSettings,
  signal: AbortSignal,
): Promise<void> => {
  const { error } = await getSupabaseClient()
    .from(TABLE_NAME)
    .upsert(
      {
        user_id: userId,
        settings_version: SETTINGS_VERSION,
        settings: serializeAccountSettings(settings),
      },
      { onConflict: "user_id" },
    )
    .abortSignal(signal);
  if (error !== null) throw new AccountSettingsRemoteError(error.message);
};

export const remoteAccountSettingsRepository = {
  load: loadRemoteAccountSettings,
  save: saveRemoteAccountSettings,
} as const satisfies RemoteAccountSettingsRepository;
