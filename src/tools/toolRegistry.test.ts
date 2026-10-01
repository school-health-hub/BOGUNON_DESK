import { describe, expect, it } from "vitest";
import { defaultDockItemIds } from "../dock/types";
import { dockRegistry } from "../dock/dockRegistry";
import { desktopActionRegistry } from "../desktop/actionRegistry";
import { urlSettingRegistry } from "../settings/settingsNavigation";
import { healthToolCategories, healthToolDefinitions } from "./toolRegistry";

describe("desktop launcher registries", () => {
  it("keeps the Dock limited to the seven top-level launchers", () => {
    expect(defaultDockItemIds).toEqual([
      "home",
      "online-health-room",
      "bogunon",
      "toolbox",
      "work-folder",
      "quick-memo",
      "settings",
    ]);
  });

  it("groups only the registered tools into the health and records categories", () => {
    expect(healthToolCategories.map((category) => ({
      id: category.id,
      tools: category.tools.map((tool) => tool.id),
    }))).toEqual([
      { id: "health", tools: ["aed-check", "checkup-tools"] },
      { id: "records", tools: ["record-helper", "purchase-helper", "official-document"] },
      { id: "general", tools: ["calculator"] },
    ]);
  });

  it("registers the official document workspace as a records internal tool", () => {
    const records = healthToolCategories.find((category) => category.id === "records");
    const officialDocument = records?.tools.find((tool) => tool.id === "official-document");
    expect(officialDocument).toMatchObject({
      kind: "internalTool",
      label: "공문 작업실",
      launchActionId: "official-document",
    });
  });

  it("keeps Dock and tool actions coherent with their execution registries", () => {
    for (const dockItemId of defaultDockItemIds) {
      expect(desktopActionRegistry[dockRegistry[dockItemId].actionId]).toBeDefined();
    }
    for (const tool of healthToolDefinitions) {
      expect(desktopActionRegistry[tool.launchActionId]).toBeDefined();
      expect(urlSettingRegistry[tool.settingsActionId].settingsKey).toBe(tool.settingsKey);
    }
  });
});
