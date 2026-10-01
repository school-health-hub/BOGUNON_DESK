import { describe, expect, it } from "vitest";
import { createDashboardLayout, createDefaultDashboardLayout, defaultAppearance, defaultWidgetLayouts } from "../dashboard/layouts";
import { getDashboardPreset } from "../dashboard/presets";
import { createDefaultDockLayout } from "../dock/storage";
import { parseRemoteAccountSettings, serializeAccountSettings } from "./remoteAccountSettings";
import type { AccountSettings } from "./types";
import { defaultWorkspaceFilters } from "./workspaceFilters";
import { defaultPurchaseOutputColumns } from "../purchase/types";

const createSettings = (): AccountSettings => ({
  workspace: createDefaultDashboardLayout(),
  dock: createDefaultDockLayout(),
  launcherLinks: {
    onlineHealthRoomUrl: "https://health.example.com/",
    bogunonUrl: "https://bogunon.example.com/",
    checkupToolUrl: null,
  },
  workspaceFilters: defaultWorkspaceFilters,
  purchaseOutputColumns: defaultPurchaseOutputColumns,
  purchaseImportTemplates: [],
  purchaseDraftTemplates: [],
});

describe("remote AccountSettings boundary", () => {
  it("serializes only account-scoped fields and excludes widget content", () => {
    const settings = createSettings();
    const withLocalOnlyWidgetData: AccountSettings = {
      ...settings,
      workspace: {
        ...settings.workspace,
        widgets: settings.workspace.widgets.map((widget, index) => index === 0
          ? { ...widget, settings: { memo: "학생 건강정보" } }
          : widget),
      },
    };

    const serialized = serializeAccountSettings(withLocalOnlyWidgetData);
    const raw = JSON.stringify(serialized);

    expect(Object.keys(serialized)).toEqual(["workspace", "dock", "launcherLinks", "workspaceFilters", "purchaseOutputColumns", "purchaseImportTemplates", "purchaseDraftTemplates"]);
    expect(raw).not.toContain("학생 건강정보");
    expect(serialized.workspace.widgets.every((widget) => !("settings" in widget))).toBe(true);
    expect(raw).not.toContain("workFolder");
    expect(raw).not.toContain("closeToTray");
    expect(raw).not.toContain("autostart");
    expect(raw).not.toContain("workPortalUrl");
    expect(raw).not.toContain("workPortalAutoOpenDelay");
    expect(raw).not.toContain("neis_school");
    expect(raw).not.toContain("schoolInfo");
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("provider");
    expect(raw).not.toContain("connectionStatus");
  });

  it("parses a valid remote payload while discarding extra device fields", () => {
    const source = serializeAccountSettings(createSettings());
    const parsed = parseRemoteAccountSettings(1, {
      ...source,
      workFolder: "C:/private",
      closeToTray: false,
      autostartEnabled: true,
      workPortalUrl: "https://portal.example.com/",
      workPortalAutoOpenDelay: "20s",
    });

    expect(parsed).toEqual(source);
    expect(parsed === null ? [] : Object.keys(parsed)).toEqual(["workspace", "dock", "launcherLinks", "workspaceFilters", "purchaseOutputColumns", "purchaseImportTemplates", "purchaseDraftTemplates"]);
  });

  it("uses default workspace filters for a legacy payload", () => {
    const source = serializeAccountSettings(createSettings());
    const { workspaceFilters: _legacyMissing, ...legacy } = source;
    expect(parseRemoteAccountSettings(1, legacy)?.workspaceFilters).toEqual(defaultWorkspaceFilters);
  });

  it("defaults legacy output columns and normalizes malformed column IDs", () => {
    const source = serializeAccountSettings(createSettings());
    const { purchaseOutputColumns: _legacyMissing, ...legacy } = source;
    expect(parseRemoteAccountSettings(1, legacy)?.purchaseOutputColumns).toEqual(defaultPurchaseOutputColumns);
    expect(parseRemoteAccountSettings(1, { ...source, purchaseOutputColumns: ["amount", "amount", "unknown"] })?.purchaseOutputColumns).toEqual(["amount", "name"]);
  });

  it("round-trips purchase output column order", () => {
    const settings = { ...createSettings(), purchaseOutputColumns: ["name", "amount", "vendor"] as const };
    expect(parseRemoteAccountSettings(1, serializeAccountSettings(settings))?.purchaseOutputColumns).toEqual(settings.purchaseOutputColumns);
  });

  it("keeps legacy version-one payloads valid without import templates", () => {
    const source = serializeAccountSettings(createSettings());
    const { purchaseImportTemplates: _legacyMissing, ...legacy } = source;
    expect(parseRemoteAccountSettings(1, legacy)?.purchaseImportTemplates).toEqual([]);
  });

  it("round-trips only import template metadata and mappings", () => {
    const purchaseImportTemplates = [{ id: "template-1", name: "학교장터", headerSignature: ["상품", "수량"], mapping: { name: 0, quantity: 1 } }] as const;
    const settings = { ...createSettings(), purchaseImportTemplates };
    const serialized = serializeAccountSettings(settings);
    expect(parseRemoteAccountSettings(1, serialized)?.purchaseImportTemplates).toEqual(purchaseImportTemplates);
    expect(JSON.stringify(serialized)).not.toContain("실제 품목");
  });

  it("keeps version-one payloads valid and syncs only reusable draft template metadata", () => {
    const source = serializeAccountSettings(createSettings());
    const { purchaseDraftTemplates: _legacyMissing, ...legacy } = source;
    expect(parseRemoteAccountSettings(1, legacy)?.purchaseDraftTemplates).toEqual([]);
    const purchaseDraftTemplates = [{ id: "draft-1", name: "행정실 양식", titlePattern: "{{title}}", introPattern: "{{purpose}}", detailFieldOrder: ["amount", "summary", "vendor", "budgetItem"], attachmentPhrase: "붙임  품목내역 1부.  끝.", includeAttachment: true }] as const;
    const serialized = serializeAccountSettings({ ...createSettings(), purchaseDraftTemplates });
    expect(parseRemoteAccountSettings(1, serialized)?.purchaseDraftTemplates).toEqual(purchaseDraftTemplates);
    expect(JSON.stringify(serialized)).not.toContain("실제 구매처");
  });

  it("round-trips workspace filters through account sync payloads", () => {
    const settings = { ...createSettings(), workspaceFilters: { ...defaultWorkspaceFilters, personal: true } };
    const serialized = serializeAccountSettings(settings);
    expect(parseRemoteAccountSettings(1, serialized)?.workspaceFilters).toEqual(settings.workspaceFilters);
  });

  it("round-trips the desk preset through account sync payloads", () => {
    const settings = { ...createSettings(), workspace: getDashboardPreset("desk").layout };
    const serialized = serializeAccountSettings(settings);

    expect(parseRemoteAccountSettings(1, serialized)?.workspace.presetId).toBe("desk");
  });

  it("preserves an existing balanced workspace through account sync", () => {
    const workspace = createDashboardLayout(
      defaultWidgetLayouts.map((widget) => widget.type === "clock" ? { ...widget, x: 2, y: 12 } : widget),
      defaultAppearance,
      "default",
    );
    const settings = { ...createSettings(), workspace };

    expect(parseRemoteAccountSettings(1, serializeAccountSettings(settings))?.workspace).toEqual(workspace);
  });

  it.each([
    [2, serializeAccountSettings(createSettings())],
    [1, { ...serializeAccountSettings(createSettings()), workspace: { version: 99 } }],
    [1, { ...serializeAccountSettings(createSettings()), dock: { version: 2, items: [{ id: "unknown", visible: true }] } }],
    [1, { ...serializeAccountSettings(createSettings()), launcherLinks: { onlineHealthRoomUrl: "file:///C:/private", bogunonUrl: null, checkupToolUrl: null } }],
  ])("rejects invalid remote version, layout, dock, or URL", (version, payload) => {
    expect(parseRemoteAccountSettings(version, payload)).toBeNull();
  });
});
