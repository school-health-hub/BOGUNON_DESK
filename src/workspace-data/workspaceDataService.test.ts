import { describe, expect, it, vi } from "vitest";
import { loadWorkspaceData } from "./workspaceDataService";
import type { WorkspaceDataRepository } from "./types";
import { defaultWorkspaceFilters } from "../settings/workspaceFilters";

const now = new Date(2026, 8, 23, 9);

describe("workspace data service", () => {
  it("does not query while signed out", async () => {
    const repository: WorkspaceDataRepository = { load: vi.fn() };
    const state = await loadWorkspaceData({ authStatus: "signedOut", userId: null, now, repository, filters: defaultWorkspaceFilters });
    expect(state).toEqual({ status: "signedOut" });
    expect(repository.load).not.toHaveBeenCalled();
  });

  it("queries signed-in data and never mixes mock fixtures into an empty response", async () => {
    const repository: WorkspaceDataRepository = {
      load: vi.fn().mockResolvedValue({
        tasks: [], events: [], ddayTasks: [], ddayEvents: [], notificationTasks: [],
      }),
    };
    const state = await loadWorkspaceData({ authStatus: "signedIn", userId: "user-1", now, repository, filters: defaultWorkspaceFilters });
    expect(repository.load).toHaveBeenCalledWith("user-1", {
      today: "2026-09-23",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    }, ["healthWork", "schoolSchedule"]);
    expect(state).toMatchObject({
      status: "ready",
      data: { todayTasks: [], calendarEvents: [], upcomingEvents: [], ddayItems: [], notifications: [], inboxItems: [], summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 } },
    });
  });

  it("returns a compact error state when the network query fails", async () => {
    const repository: WorkspaceDataRepository = { load: vi.fn().mockRejectedValue(new Error("network")) };
    await expect(loadWorkspaceData({ authStatus: "signedIn", userId: "user-1", now, repository, filters: defaultWorkspaceFilters }))
      .resolves.toEqual({ status: "error" });
  });

  it("refetches with the updated enabled areas", async () => {
    const repository: WorkspaceDataRepository = {
      load: vi.fn().mockResolvedValue({
        tasks: [], events: [], ddayTasks: [], ddayEvents: [], notificationTasks: [],
      }),
    };
    await loadWorkspaceData({ authStatus: "signedIn", userId: "user-1", now, repository, filters: defaultWorkspaceFilters });
    await loadWorkspaceData({
      authStatus: "signedIn",
      userId: "user-1",
      now,
      repository,
      filters: { ...defaultWorkspaceFilters, personal: true },
    });
    expect(repository.load).toHaveBeenNthCalledWith(1, "user-1", expect.any(Object), ["healthWork", "schoolSchedule"]);
    expect(repository.load).toHaveBeenNthCalledWith(2, "user-1", expect.any(Object), ["healthWork", "schoolSchedule", "personal"]);
  });
});
