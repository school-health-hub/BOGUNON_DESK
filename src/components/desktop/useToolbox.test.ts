import { describe, expect, it, vi } from "vitest";
import { createDefaultDashboardLayout } from "../../dashboard/layouts";
import { createDefaultDockLayout } from "../../dock/storage";
import { accountSyncService } from "../../settings/accountSyncService";
import type { AccountLauncherLinks } from "../../settings/types";
import { subscribeToToolboxLauncherLinks } from "./useToolbox";
import { defaultWorkspaceFilters } from "../../settings/workspaceFilters";
import { defaultPurchaseOutputColumns } from "../../purchase/types";

describe("Toolbox launcher settings subscription", () => {
  it("applies launcher links delivered by account sync", () => {
    const launcherLinks: AccountLauncherLinks = {
      onlineHealthRoomUrl: "https://health.example.com/",
      bogunonUrl: "https://bogunon.example.com/",
      checkupToolUrl: "https://checkup.example.com/",
    };
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(accountSyncService, "subscribeApplied")
      .mockImplementation((listener) => {
        listener({
          workspace: createDefaultDashboardLayout(),
          dock: createDefaultDockLayout(),
          launcherLinks,
          workspaceFilters: defaultWorkspaceFilters,
          purchaseOutputColumns: defaultPurchaseOutputColumns,
          purchaseImportTemplates: [],
          purchaseDraftTemplates: [],
        });
        return unsubscribe;
      });
    const listener = vi.fn();

    const cleanup = subscribeToToolboxLauncherLinks(listener);

    expect(subscribe).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(launcherLinks);
    expect(cleanup).toBe(unsubscribe);
    subscribe.mockRestore();
  });
});
