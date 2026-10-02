import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closePanels: vi.fn(),
  executeNativeDesktopAction: vi.fn(),
  loadLauncherLinks: vi.fn(),
  openToolSettings: vi.fn(),
  runExternalDesktopAction: vi.fn(),
  setActiveActionId: vi.fn(),
  setIsDesktopSettingsOpen: vi.fn(),
  setSettingsSectionId: vi.fn(),
}));

vi.mock("react", () => {
  const setters = [
    mocks.setActiveActionId,
    mocks.setIsDesktopSettingsOpen,
    mocks.setSettingsSectionId,
  ];
  let stateIndex = 0;
  return {
    useCallback: <Callback>(callback: Callback): Callback => callback,
    useState: <Value>(initial: Value): [Value, (value: Value) => void] => {
      const setter = setters[stateIndex] ?? vi.fn();
      stateIndex += 1;
      return [initial, setter];
    },
  };
});

vi.mock("../../desktop/actions", () => ({
  executeNativeDesktopAction: mocks.executeNativeDesktopAction,
  getDesktopErrorMessage: vi.fn(() => "오류"),
}));

vi.mock("../../desktop/runExternalDesktopAction", () => ({
  runExternalDesktopAction: mocks.runExternalDesktopAction,
}));

vi.mock("../../settings/settingsService", () => ({
  settingsService: { account: { loadLauncherLinks: mocks.loadLauncherLinks } },
}));

vi.mock("../desktop/useToolbox", () => ({
  useToolbox: () => ({
    clearSettingsTarget: vi.fn(),
    closePanels: mocks.closePanels,
    closeToolbox: vi.fn(),
    isLauncherSettingsLoading: false,
    isToolboxOpen: false,
    openToolbox: vi.fn(),
    openToolSettings: mocks.openToolSettings,
    runToolAction: vi.fn(),
    settingsUrlActionId: null,
  }),
}));

import { useDesktopNavigation } from "./useDesktopNavigation";

describe("desktop navigation record helper route", () => {
  it("opens the internal panel without loading BOGUNON settings or executing native code", async () => {
    const setIsCalculatorOpen = vi.fn();
    const setIsEditing = vi.fn();
    const setIsInboxOpen = vi.fn();
    const setIsOfficialDocumentOpen = vi.fn();
    const setIsPurchaseHelperOpen = vi.fn();
    const setIsQuickMemoOpen = vi.fn();
    const setIsRecordHelperOpen = vi.fn();
    const setIsWorkFoldersOpen = vi.fn();
    const navigation = useDesktopNavigation({
      setActivePanel: vi.fn(),
      setIsCalculatorOpen,
      setIsEditing,
      setIsInboxOpen,
      setIsOfficialDocumentOpen,
      setIsPurchaseHelperOpen,
      setIsQuickMemoOpen,
      setIsRecordHelperOpen,
      setIsWorkFoldersOpen,
      setNotice: vi.fn(),
      setSelectedWidgetId: vi.fn(),
    });

    await navigation.runDesktopAction("record-helper");

    expect(setIsRecordHelperOpen).toHaveBeenNthCalledWith(1, false);
    expect(setIsRecordHelperOpen).toHaveBeenNthCalledWith(2, true);
    expect(setIsOfficialDocumentOpen).toHaveBeenCalledWith(false);
    expect(setIsPurchaseHelperOpen).toHaveBeenCalledWith(false);
    expect(setIsCalculatorOpen).toHaveBeenCalledWith(false);
    expect(setIsInboxOpen).toHaveBeenCalledWith(false);
    expect(setIsQuickMemoOpen).toHaveBeenCalledWith(false);
    expect(setIsWorkFoldersOpen).toHaveBeenCalledWith(false);
    expect(setIsEditing).toHaveBeenCalledWith(false);
    expect(mocks.closePanels).toHaveBeenCalledOnce();
    expect(mocks.loadLauncherLinks).not.toHaveBeenCalled();
    expect(mocks.runExternalDesktopAction).not.toHaveBeenCalled();
    expect(mocks.executeNativeDesktopAction).not.toHaveBeenCalled();
  });
});
