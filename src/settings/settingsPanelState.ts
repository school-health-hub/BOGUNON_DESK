import type { ConfigurableUrlActionId } from "../desktop/types";
import { findUrlSetting, type SettingsSectionId } from "./settingsNavigation";
import type { AccountLauncherLinks } from "./types";

export type SettingsTargetState = {
  readonly activeSection: SettingsSectionId;
  readonly editingUrl: ConfigurableUrlActionId | null;
  readonly urlDraft: string;
};

export const createSettingsTargetState = (
  actionId: ConfigurableUrlActionId | null,
  launcherLinks: AccountLauncherLinks,
): SettingsTargetState => {
  if (actionId === null) {
    return { activeSection: "account", editingUrl: null, urlDraft: "" };
  }
  const definition = findUrlSetting(actionId);
  return {
    activeSection: "connections",
    editingUrl: actionId,
    urlDraft: launcherLinks[definition.settingsKey] ?? "",
  };
};
