import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: mocks.isTauri }));

import { openBogunonSearchResult } from "./actions";

describe("BOGUNON search result desktop action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockResolvedValue({ status: "completed", message: null });
  });

  it("passes only typed result coordinates to the native launcher", async () => {
    await openBogunonSearchResult({ kind: "event", id: "event-1", date: "2026-09-18" });
    expect(mocks.invoke).toHaveBeenCalledWith("open_bogunon_search_result", {
      kind: "event",
      id: "event-1",
      date: "2026-09-18",
    });
  });
});
