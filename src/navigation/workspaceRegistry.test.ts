import { describe, expect, it } from "vitest";
import { desktopActionIds } from "../desktop/types";
import { DOCK_LAYOUT_VERSION, dockItemIds } from "../dock/types";
import {
  workspaceCategoryIds,
  workspaceActionRoutes,
  workspaceDefinitions,
  workspaceRegistry,
  type WorkspaceModuleId,
} from "./workspaceRegistry";

const expectedModuleIds = [
  "home",
  "toolbox",
  "today-tasks",
  "local-calendar",
  "quick-memo",
  "work-folder",
  "calculator",
  "record-helper",
  "official-document",
  "newsletter",
  "education-video-finder",
  "purchase-helper",
  "personal-inventory",
  "finance",
  "school-profile",
  "school-admin",
  "school-workspace",
  "online-health-room",
  "work-portal",
  "aed-check",
  "checkup-tools",
  "bogunon",
  "settings",
] as const satisfies readonly WorkspaceModuleId[];

describe("workspace registry", () => {
  it("maps every implemented workspace to one primary category", () => {
    // Given: the approved UX-02 module inventory.
    const ids = workspaceDefinitions.map((definition) => definition.id);

    // When: registry IDs and category assignments are inspected.
    const uniqueIds = new Set(ids);

    // Then: every module appears exactly once under a supported top-level category.
    expect(ids).toEqual(expectedModuleIds);
    expect(uniqueIds.size).toBe(expectedModuleIds.length);
    expect(workspaceDefinitions.every((definition) => workspaceCategoryIds.includes(definition.categoryId))).toBe(true);
  });

  it("places Finance under schedule work and Finder under documents and education", () => {
    // Given: the UX-01 corrections approved for UX-02.
    const finance = workspaceRegistry.finance;
    const finder = workspaceRegistry["education-video-finder"];

    // When: their primary navigation categories are read.
    const placement = [finance.categoryId, finder.categoryId];

    // Then: security is metadata, not the Finance menu category, and Finder remains with documents.
    expect(placement).toEqual(["schedule-work", "documents-education"]);
    expect(finance.storageScope).toBe("device-encrypted");
    expect(finance.lifecycle).toBe("unmount-guard-draft");
    expect(finder.storageScope).toBe("device");
  });

  it("records current lifecycle owners without changing their behavior", () => {
    // Given: modules with intentionally different mount and cleanup contracts.
    const contracts = {
      record: workspaceRegistry["record-helper"].lifecycle,
      official: workspaceRegistry["official-document"].lifecycle,
      purchase: workspaceRegistry["purchase-helper"].lifecycle,
      newsletter: workspaceRegistry.newsletter.lifecycle,
      school: workspaceRegistry["school-workspace"].access,
    };

    // When: the registry is used as the future App Shell source of truth.
    // Then: it describes, rather than normalizes, the current owners.
    expect(contracts).toEqual({
      record: "unmount-confirm-clear",
      official: "unmount-confirm-discard",
      purchase: "controlled-open",
      newsletter: "keep-alive-hidden",
      school: "school-role",
    });
  });

  it("preserves the existing Dock storage contract", () => {
    // Given: the persisted Dock version and IDs used by existing profiles.
    const version = DOCK_LAYOUT_VERSION;
    const ids = [...dockItemIds];

    // When: the navigation registry is introduced.
    // Then: no Dock identifier or storage version is redefined by it.
    expect(version).toBe(2);
    expect(ids).toEqual([
      "home",
      "online-health-room",
      "bogunon",
      "toolbox",
      "official-document",
      "aed-check",
      "record-helper",
      "checkup-tools",
      "work-folder",
      "quick-memo",
      "settings",
    ]);
    expect(workspaceDefinitions.every((definition) => !("dockVersion" in definition))).toBe(true);
  });

  it("routes every existing desktop action without changing its persisted ID", () => {
    // Given: every action ID already used by Dock, commands, or saved settings.
    const routedActionIds = Object.keys(workspaceActionRoutes);

    // When: the future App Shell resolves current actions through the registry.
    const targets = Object.values(workspaceActionRoutes);

    // Then: all current IDs remain accepted and every route targets an implemented module definition.
    expect(routedActionIds).toEqual([...desktopActionIds]);
    expect(targets.every((target) => workspaceRegistry[target] !== undefined)).toBe(true);
    expect(workspaceActionRoutes.inbox).toBe("today-tasks");
    expect(workspaceActionRoutes["bogunon-school-settings"]).toBe("school-profile");
  });
});
