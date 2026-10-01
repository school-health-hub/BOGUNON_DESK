import { urlSettingDefinitions } from "../settings/settingsNavigation";
import type { AccountLauncherLinks } from "../settings/types";
import type { ConfigurableUrlActionId, DesktopActionId, DesktopActionOutcome } from "./types";

export type ExternalDesktopActionDependencies = {
  readonly execute: (actionId: DesktopActionId) => Promise<DesktopActionOutcome>;
  readonly loadLauncherLinks: () => Promise<AccountLauncherLinks>;
  readonly onPrepareLaunch: () => void;
  readonly onUnavailable: (message: string, actionId: ConfigurableUrlActionId) => void;
};

export const runExternalDesktopAction = async (
  actionId: DesktopActionId,
  dependencies: ExternalDesktopActionDependencies,
): Promise<DesktopActionOutcome | null> => {
  const urlSetting = urlSettingDefinitions.find((definition) => definition.id === actionId);
  if (urlSetting !== undefined) {
    const launcherLinks = await dependencies.loadLauncherLinks();
    if (launcherLinks[urlSetting.settingsKey] === null) {
      dependencies.onUnavailable(urlSetting.unavailableMessage, urlSetting.id);
      return null;
    }
  }
  dependencies.onPrepareLaunch();
  return dependencies.execute(actionId);
};
