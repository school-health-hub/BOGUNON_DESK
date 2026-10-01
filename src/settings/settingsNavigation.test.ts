import { describe, expect, it } from "vitest";
import {
  findUrlSetting,
  resolveWorkspaceEditorPanel,
  screenSettingDefinitions,
  settingsNavigationDefinitions,
  urlSettingDefinitions,
} from "./settingsNavigation";
import { createSettingsTargetState } from "./settingsPanelState";

const launcherLinks = {
  onlineHealthRoomUrl: "https://health.example.com/",
  bogunonUrl: "https://bogunon.example.com/",
  checkupToolUrl: null,
} as const;

describe("settings navigation registry", () => {
  it("exposes the five settings center sections in display order", () => {
    expect(settingsNavigationDefinitions.map((section) => section.id)).toEqual([
      "account",
      "screen",
      "connections",
      "ai",
      "device",
    ]);
  });

  it("maps each account launcher to its existing persistence key", () => {
    expect(urlSettingDefinitions.map((definition) => [definition.id, definition.settingsKey, definition.unavailableMessage])).toEqual([
      ["online-health-room", "onlineHealthRoomUrl", "온라인 보건실이 아직 연결되지 않았습니다."],
      ["bogunon", "bogunonUrl", "BOGUNON이 아직 연결되지 않았습니다."],
      ["checkup-tools", "checkupToolUrl", "검진 도구가 아직 연결되지 않았습니다."],
    ]);
    expect(findUrlSetting("bogunon")?.settingsKey).toBe("bogunonUrl");
  });

  it("targets a requested connection and returns to Account when the target is cleared", () => {
    expect(createSettingsTargetState("bogunon", launcherLinks)).toEqual({
      activeSection: "connections",
      editingUrl: "bogunon",
      urlDraft: "https://bogunon.example.com/",
    });
    expect(createSettingsTargetState(null, launcherLinks)).toEqual({
      activeSection: "account",
      editingUrl: null,
      urlDraft: "",
    });
  });

  it("maps screen entries to the existing workspace editor panels", () => {
    expect(screenSettingDefinitions.map(({ label }) => label)).toEqual(["화면 꾸미기", "배치", "스타일", "Dock"]);
    expect(resolveWorkspaceEditorPanel("workspace")).toBeNull();
    expect(resolveWorkspaceEditorPanel("presets")).toBe("presets");
    expect(resolveWorkspaceEditorPanel("appearance")).toBe("appearance");
    expect(resolveWorkspaceEditorPanel("dock")).toBe("dock");
  });
});
