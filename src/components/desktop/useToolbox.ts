import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  executeNativeDesktopAction,
  getDesktopErrorMessage,
} from "../../desktop/actions";
import type {
  ConfigurableUrlActionId,
  DesktopActionId,
} from "../../desktop/types";
import { emptyAccountLauncherLinks } from "../../settings/accountSettings";
import { settingsService } from "../../settings/settingsService";
import { accountSyncService } from "../../settings/accountSyncService";
import type { AccountLauncherLinks } from "../../settings/types";
import { healthToolRegistry, type HealthToolId } from "../../tools/toolRegistry";

type UseToolboxOptions = {
  readonly setActiveActionId: Dispatch<SetStateAction<DesktopActionId>>;
  readonly setIsDesktopSettingsOpen: Dispatch<SetStateAction<boolean>>;
  readonly setNotice: Dispatch<SetStateAction<string | null>>;
};

export const subscribeToToolboxLauncherLinks = (
  listener: (launcherLinks: AccountLauncherLinks) => void,
): (() => void) => accountSyncService.subscribeApplied((settings) => {
  listener(settings.launcherLinks);
});

export function useToolbox({
  setActiveActionId,
  setIsDesktopSettingsOpen,
  setNotice,
}: UseToolboxOptions) {
  const [isToolboxOpen, setIsToolboxOpen] = useState(false);
  const [settingsUrlActionId, setSettingsUrlActionId] =
    useState<ConfigurableUrlActionId | null>(null);
  const [launcherSettings, setLauncherSettings] =
    useState<AccountLauncherLinks>(emptyAccountLauncherLinks);
  const [isLauncherSettingsLoading, setIsLauncherSettingsLoading] = useState(true);

  useEffect(() => subscribeToToolboxLauncherLinks(setLauncherSettings), []);

  const closePanels = useCallback(() => {
    setIsToolboxOpen(false);
  }, []);

  const openToolbox = useCallback(() => {
    setIsToolboxOpen(true);
    setIsLauncherSettingsLoading(true);
    void settingsService.account.loadLauncherLinks()
      .then(setLauncherSettings)
      .catch((error: unknown) => setNotice(getDesktopErrorMessage(error)))
      .finally(() => setIsLauncherSettingsLoading(false));
  }, [setNotice]);

  const closeToolbox = useCallback(() => {
    setIsToolboxOpen(false);
    setActiveActionId("home");
  }, [setActiveActionId]);

  const openToolSettings = useCallback((actionId: ConfigurableUrlActionId) => {
    setIsToolboxOpen(false);
    setSettingsUrlActionId(actionId);
    setActiveActionId("settings");
    setIsDesktopSettingsOpen(true);
  }, [setActiveActionId, setIsDesktopSettingsOpen]);

  const runToolAction = useCallback((actionId: HealthToolId) => {
    const definition = healthToolRegistry[actionId];
    if (launcherSettings[definition.settingsKey] === null) {
      setNotice(definition.settingsActionId === "bogunon"
        ? "BOGUNON이 아직 연결되지 않았습니다."
        : "이 도구는 아직 연결되지 않았습니다.");
      openToolSettings(definition.settingsActionId);
      return;
    }
    setActiveActionId("toolbox");
    void executeNativeDesktopAction(definition.launchActionId)
      .then((outcome) => {
        if (outcome.message !== null) setNotice(outcome.message);
      })
      .catch((error: unknown) => setNotice(getDesktopErrorMessage(error)));
  }, [launcherSettings, openToolSettings, setActiveActionId, setNotice]);

  const clearSettingsTarget = useCallback(() => setSettingsUrlActionId(null), []);

  return {
    clearSettingsTarget,
    closePanels,
    closeToolbox,
    isToolboxOpen,
    isLauncherSettingsLoading,
    openToolbox,
    openToolSettings,
    runToolAction,
    settingsUrlActionId,
  };
}
