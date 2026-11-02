// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopNavigation } from "./useDesktopNavigation";

const closePanels = vi.fn();
const openToolbox = vi.fn();
const openToolSettings = vi.fn();
const clearSettingsTarget = vi.fn();

vi.mock("../desktop/useToolbox", () => ({
  useToolbox: () => ({
    clearSettingsTarget,
    closePanels,
    closeToolbox: vi.fn(),
    isToolboxOpen: false,
    isLauncherSettingsLoading: false,
    openToolbox,
    openToolSettings,
    runToolAction: vi.fn(),
    settingsUrlActionId: null,
  }),
}));

const createOptions = () => ({
  setActivePanel: vi.fn(),
  setIsEditing: vi.fn(),
  setIsCalculatorOpen: vi.fn(),
  setIsInventoryManagementOpen: vi.fn(),
  setIsPurchaseHelperOpen: vi.fn(),
  setIsOfficialDocumentOpen: vi.fn(),
  setIsRecordHelperOpen: vi.fn(),
  setIsInboxOpen: vi.fn(),
  setIsQuickMemoOpen: vi.fn(),
  setIsWorkFoldersOpen: vi.fn(),
  setNotice: vi.fn(),
  setSelectedWidgetId: vi.fn(),
});

describe("Inventory desktop navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens Inventory exclusively when its desktop action runs", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useDesktopNavigation(options));

    await act(() => result.current.runDesktopAction("inventory-management"));

    expect(options.setIsInventoryManagementOpen).toHaveBeenLastCalledWith(true);
    expect(options.setIsCalculatorOpen).toHaveBeenCalledWith(false);
    expect(options.setIsPurchaseHelperOpen).toHaveBeenCalledWith(false);
    expect(options.setIsOfficialDocumentOpen).toHaveBeenCalledWith(false);
    expect(options.setIsRecordHelperOpen).toHaveBeenCalledWith(false);
    expect(options.setIsInboxOpen).toHaveBeenCalledWith(false);
    expect(options.setIsQuickMemoOpen).toHaveBeenCalledWith(false);
    expect(options.setIsWorkFoldersOpen).toHaveBeenCalledWith(false);
    expect(closePanels).toHaveBeenCalledOnce();
  });

  it("closes Inventory before another internal panel opens", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useDesktopNavigation(options));

    await act(() => result.current.runDesktopAction("calculator"));

    expect(options.setIsInventoryManagementOpen).toHaveBeenCalledWith(false);
    expect(options.setIsCalculatorOpen).toHaveBeenLastCalledWith(true);
  });
});
