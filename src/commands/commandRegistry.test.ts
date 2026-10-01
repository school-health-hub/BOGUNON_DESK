import { describe, expect, it, vi } from "vitest";
import { desktopActionIds } from "../desktop/types";
import {
  commandDefinitions,
  commandGroupIds,
  commandIds,
  executeCommand,
  filterCommands,
} from "./commandRegistry";

describe("command registry", () => {
  it("keeps command IDs unique and contains every required command", () => {
    expect(new Set(commandIds).size).toBe(commandIds.length);
    expect(commandIds).toEqual([
      "quick-add", "home", "today-tasks", "inbox", "calculator", "purchase-helper", "official-document", "toolbox", "quick-memo", "settings",
      "online-health-room", "bogunon", "work-folder", "work-portal",
      "workspace", "widget-library", "presets", "appearance", "dock-editor",
    ]);
  });

  it("uses valid desktop action references and stable group ordering", () => {
    const desktopCommands = commandDefinitions.filter((command) => command.kind === "desktopAction");
    expect(desktopCommands.every((command) => desktopActionIds.includes(command.actionId))).toBe(true);
    expect(commandGroupIds).toEqual(["quick", "connection", "screen"]);
    expect([...new Set(commandDefinitions.map((command) => command.group))]).toEqual(commandGroupIds);
  });
});

describe("command search", () => {
  it.each([
    ["빠른 추가", "quick-add"],
    ["오늘 처리할 보건업무", "today-tasks"],
    ["aed", "toolbox"],
    ["BOGUNON", "bogunon"],
    ["보그논", "bogunon"],
    ["포털", "work-portal"],
    ["neis", "work-portal"],
    ["미처리", "inbox"],
    ["inbox", "inbox"],
    ["퍼센트", "calculator"],
    ["calculator", "calculator"],
    ["견적", "purchase-helper"],
    ["장바구니", "purchase-helper"],
    ["공문", "official-document"],
  ])("matches %s using labels, descriptions, keywords, and case-insensitive text", (query, expectedId) => {
    expect(filterCommands(query).map((command) => command.id)).toContain(expectedId);
  });

  it("returns every command for a blank query and none for an unknown query", () => {
    expect(filterCommands("   ")).toEqual(commandDefinitions);
    expect(filterCommands("존재하지않는기능")).toEqual([]);
  });
});

describe("command execution", () => {
  it("uses the compact customization vocabulary across command entry points", () => {
    const customizationLabels = commandDefinitions
      .filter((command) => ["widget-library", "presets", "appearance", "dock-editor"].includes(command.id))
      .map((command) => command.label);

    expect(customizationLabels).toEqual(["위젯", "배치", "스타일", "Dock"]);
  });

  it.each([
    ["quick-add", "quickAdd", undefined],
    ["bogunon", "desktopAction", "bogunon"],
    ["toolbox", "desktopAction", "toolbox"],
    ["settings", "desktopAction", "settings"],
    ["work-folder", "desktopAction", "work-folder"],
    ["work-portal", "desktopAction", "work-portal"],
    ["inbox", "desktopAction", "inbox"],
    ["calculator", "desktopAction", "calculator"],
    ["purchase-helper", "desktopAction", "purchase-helper"],
    ["official-document", "desktopAction", "official-document"],
    ["workspace", "workspaceEditor", "workspace"],
    ["widget-library", "widgetLibrary", undefined],
    ["presets", "workspaceEditor", "presets"],
    ["appearance", "workspaceEditor", "appearance"],
    ["dock-editor", "workspaceEditor", "dock"],
  ] as const)("routes %s through existing handlers", async (commandId, expectedHandler, expectedValue) => {
    const handlers = {
      openQuickAdd: vi.fn(),
      runDesktopAction: vi.fn().mockResolvedValue(undefined),
      openWorkspaceEditor: vi.fn(),
      openWidgetLibrary: vi.fn(),
    };

    await executeCommand(commandId, handlers);

    if (expectedHandler === "quickAdd") expect(handlers.openQuickAdd).toHaveBeenCalledOnce();
    if (expectedHandler === "desktopAction") expect(handlers.runDesktopAction).toHaveBeenCalledWith(expectedValue);
    if (expectedHandler === "workspaceEditor") expect(handlers.openWorkspaceEditor).toHaveBeenCalledWith(expectedValue);
    if (expectedHandler === "widgetLibrary") expect(handlers.openWidgetLibrary).toHaveBeenCalledOnce();
  });
});
