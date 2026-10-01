import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { executeNativeDesktopAction, getDesktopErrorMessage } from "../../desktop/actions";
import { desktopActionRegistry } from "../../desktop/actionRegistry";
import { runExternalDesktopAction } from "../../desktop/runExternalDesktopAction";
import type { DesktopActionId, InternalDesktopTarget } from "../../desktop/types";
import { settingsService } from "../../settings/settingsService";
import { resolveWorkspaceEditorPanel, type SettingsSectionId, type WorkspaceEditorTarget } from "../../settings/settingsNavigation";
import { useToolbox } from "../desktop/useToolbox";

export type DashboardEditorPanel = "library" | "presets" | "appearance" | "dock" | null;

type UseDesktopNavigationOptions = {
  readonly setActivePanel: Dispatch<SetStateAction<DashboardEditorPanel>>;
  readonly setIsEditing: Dispatch<SetStateAction<boolean>>;
  readonly setIsCalculatorOpen: Dispatch<SetStateAction<boolean>>;
  readonly setIsPurchaseHelperOpen: Dispatch<SetStateAction<boolean>>;
  readonly setIsOfficialDocumentOpen: Dispatch<SetStateAction<boolean>>;
  readonly setIsInboxOpen: Dispatch<SetStateAction<boolean>>;
  readonly setIsQuickMemoOpen: Dispatch<SetStateAction<boolean>>;
  readonly setIsWorkFoldersOpen: Dispatch<SetStateAction<boolean>>;
  readonly setNotice: Dispatch<SetStateAction<string | null>>;
  readonly setSelectedWidgetId: Dispatch<SetStateAction<string | null>>;
};

export function useDesktopNavigation(options: UseDesktopNavigationOptions) {
  const { setActivePanel, setIsCalculatorOpen, setIsPurchaseHelperOpen, setIsOfficialDocumentOpen, setIsEditing, setIsInboxOpen, setIsQuickMemoOpen, setIsWorkFoldersOpen, setNotice, setSelectedWidgetId } = options;
  const [activeActionId, setActiveActionId] = useState<DesktopActionId>("home");
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false);
  const [settingsSectionId, setSettingsSectionId] = useState<SettingsSectionId>("account");
  const toolbox = useToolbox({
    setActiveActionId,
    setIsDesktopSettingsOpen,
    setNotice,
  });
  const {
    clearSettingsTarget,
    closePanels,
    openToolbox,
    openToolSettings,
  } = toolbox;

  const focusInternalTarget = useCallback((target: InternalDesktopTarget) => {
    setActiveActionId(target);
    setIsOfficialDocumentOpen(false);
    if (target === "work-folder") {
      setIsDesktopSettingsOpen(false);
      setIsInboxOpen(false);
      setIsCalculatorOpen(false);
      setIsPurchaseHelperOpen(false);
      setIsQuickMemoOpen(false);
      setIsEditing(false);
      setActivePanel(null);
      closePanels();
      setIsWorkFoldersOpen(true);
      return;
    }
    setIsWorkFoldersOpen(false);
    if (target === "official-document") {
      setIsDesktopSettingsOpen(false);
      setIsInboxOpen(false);
      setIsCalculatorOpen(false);
      setIsPurchaseHelperOpen(false);
      setIsQuickMemoOpen(false);
      setIsEditing(false);
      setActivePanel(null);
      closePanels();
      setIsOfficialDocumentOpen(true);
      return;
    }
    if (target === "purchase-helper") {
      setIsDesktopSettingsOpen(false);
      setIsInboxOpen(false);
      setIsCalculatorOpen(false);
      setIsQuickMemoOpen(false);
      setIsEditing(false);
      setActivePanel(null);
      closePanels();
      setIsPurchaseHelperOpen(true);
      return;
    }
    setIsPurchaseHelperOpen(false);
    if (target === "quick-memo") {
      setIsDesktopSettingsOpen(false);
      setIsInboxOpen(false);
      setIsCalculatorOpen(false);
      setIsEditing(false);
      setActivePanel(null);
      closePanels();
      setIsQuickMemoOpen(true);
      return;
    }
    setIsQuickMemoOpen(false);
    if (target === "calculator") {
      setIsDesktopSettingsOpen(false);
      setIsInboxOpen(false);
      closePanels();
      setIsCalculatorOpen(true);
      return;
    }
    setIsCalculatorOpen(false);
    if (target === "inbox") {
      setIsDesktopSettingsOpen(false);
      closePanels();
      setIsInboxOpen(true);
      return;
    }
    setIsInboxOpen(false);
    if (target === "settings") {
      setIsEditing(false);
      setActivePanel(null);
      clearSettingsTarget();
      setSettingsSectionId("account");
      setIsDesktopSettingsOpen(true);
      closePanels();
      return;
    }
    if (target === "toolbox") {
      setIsEditing(false);
      setActivePanel(null);
      setIsDesktopSettingsOpen(false);
      openToolbox();
      return;
    }
    setIsDesktopSettingsOpen(false);
    closePanels();
    if (target === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const widget = document.querySelector<HTMLElement>(`[data-widget-type="${target}"]`);
    if (widget === null) {
      setNotice("오늘의 보건업무 위젯이 현재 숨겨져 있습니다.");
      return;
    }
    widget.scrollIntoView({ behavior: "smooth", block: "center" });
    widget.focus({ preventScroll: true });
  }, [clearSettingsTarget, closePanels, openToolbox, setActivePanel, setIsCalculatorOpen, setIsPurchaseHelperOpen, setIsOfficialDocumentOpen, setIsEditing, setIsInboxOpen, setIsQuickMemoOpen, setIsWorkFoldersOpen, setNotice]);

  const runDesktopAction = useCallback(async (actionId: DesktopActionId) => {
    const action = desktopActionRegistry[actionId];
    if (action.kind === "internal") {
      focusInternalTarget(action.target);
      return;
    }
    try {
      const outcome = await runExternalDesktopAction(actionId, {
        execute: executeNativeDesktopAction,
        loadLauncherLinks: settingsService.account.loadLauncherLinks,
        onPrepareLaunch: () => {
          setIsInboxOpen(false);
          setIsCalculatorOpen(false);
          setIsQuickMemoOpen(false);
          setIsWorkFoldersOpen(false);
          setIsPurchaseHelperOpen(false);
          setIsOfficialDocumentOpen(false);
          setIsDesktopSettingsOpen(false);
          clearSettingsTarget();
          closePanels();
          setActiveActionId("home");
        },
        onUnavailable: (message, settingsActionId) => {
          setNotice(message);
          openToolSettings(settingsActionId);
        },
      });
      if (outcome?.message !== null && outcome?.message !== undefined) {
        setNotice(outcome.message);
      }
    } catch (error) {
      setNotice(getDesktopErrorMessage(error));
    }
  }, [clearSettingsTarget, closePanels, focusInternalTarget, openToolSettings, setIsCalculatorOpen, setIsPurchaseHelperOpen, setIsOfficialDocumentOpen, setIsInboxOpen, setIsQuickMemoOpen, setIsWorkFoldersOpen, setNotice]);

  const openWorkspaceEditor = useCallback((target: WorkspaceEditorTarget) => {
    setIsDesktopSettingsOpen(false);
    setIsInboxOpen(false);
    setIsCalculatorOpen(false);
    setIsQuickMemoOpen(false);
    setIsWorkFoldersOpen(false);
    setIsPurchaseHelperOpen(false);
    setIsOfficialDocumentOpen(false);
    clearSettingsTarget();
    closePanels();
    setActiveActionId("home");
    setSelectedWidgetId(null);
    setIsEditing(true);
    setActivePanel(resolveWorkspaceEditorPanel(target));
  }, [clearSettingsTarget, closePanels, setActivePanel, setIsCalculatorOpen, setIsPurchaseHelperOpen, setIsOfficialDocumentOpen, setIsEditing, setIsInboxOpen, setIsQuickMemoOpen, setIsWorkFoldersOpen, setSelectedWidgetId]);

  const openSettingsSection = useCallback((sectionId: SettingsSectionId) => {
    setIsOfficialDocumentOpen(false);
    setIsPurchaseHelperOpen(false);
    setIsCalculatorOpen(false);
    setIsInboxOpen(false);
    setIsQuickMemoOpen(false);
    setIsWorkFoldersOpen(false);
    setIsEditing(false);
    setActivePanel(null);
    clearSettingsTarget();
    closePanels();
    setSettingsSectionId(sectionId);
    setActiveActionId("settings");
    setIsDesktopSettingsOpen(true);
  }, [clearSettingsTarget, closePanels, setActivePanel, setIsCalculatorOpen, setIsInboxOpen, setIsOfficialDocumentOpen, setIsPurchaseHelperOpen, setIsQuickMemoOpen, setIsWorkFoldersOpen]);

  const closeSettings = useCallback(() => {
    setIsDesktopSettingsOpen(false);
    clearSettingsTarget();
    setActiveActionId("home");
  }, [clearSettingsTarget]);

  return {
    activeActionId,
    closeSettings,
    isDesktopSettingsOpen,
    openSettingsSection,
    openWorkspaceEditor,
    runDesktopAction,
    settingsSectionId,
    toolbox,
  };
}
