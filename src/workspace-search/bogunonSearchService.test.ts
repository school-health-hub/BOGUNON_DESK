import { describe, expect, it, vi } from "vitest";
import { defaultWorkspaceFilters } from "../settings/workspaceFilters";
import { searchBogunonItems } from "./bogunonSearchService";
import type { BogunonSearchRepository } from "./types";

const repository: BogunonSearchRepository = {
  search: vi.fn(async () => ({
    tasks: [{
      id: "task-1", title: " 결핵 결과 확인 ", area: "healthWork", status: "completed", priority: "normal",
      scheduled_date: null, due_date: "2026-09-18", follow_up_date: "2026-09-19",
    }],
    events: [{
      id: "event-1", title: "학생 결핵검진", area: "schoolSchedule", start_date: "2026-09-18",
      end_date: "2026-09-18", is_all_day: false, start_time: "14:00:00", end_time: "15:00:00",
    }],
  } as const)),
};

describe("BOGUNON search service", () => {
  it.each(["", " ", "가"])("does not search queries shorter than two characters: %j", async (query) => {
    const search = vi.fn();
    const result = await searchBogunonItems({ authStatus: "signedIn", userId: "user-1", query, filters: defaultWorkspaceFilters, repository: { search } });
    expect(result).toEqual({ status: "idle" });
    expect(search).not.toHaveBeenCalled();
  });

  it("does not call the repository while signed out", async () => {
    const search = vi.fn();
    const result = await searchBogunonItems({ authStatus: "signedOut", userId: null, query: "결핵", filters: defaultWorkspaceFilters, repository: { search } });
    expect(result).toEqual({ status: "signedOut" });
    expect(search).not.toHaveBeenCalled();
  });

  it("trims the query, applies enabled areas, and maps task and event display data", async () => {
    const result = await searchBogunonItems({ authStatus: "signedIn", userId: "user-1", query: " 결핵 ", filters: defaultWorkspaceFilters, repository });
    expect(repository.search).toHaveBeenCalledWith("user-1", "결핵", ["healthWork", "schoolSchedule"]);
    expect(result).toEqual({
      status: "ready",
      items: [
        { kind: "task", id: "task-1", title: "결핵 결과 확인", date: "2026-09-18", secondary: "업무 · 9.18 · 완료" },
        { kind: "event", id: "event-1", title: "학생 결핵검진", date: "2026-09-18", secondary: "일정 · 9.18 · 14:00" },
      ],
    });
  });
});
