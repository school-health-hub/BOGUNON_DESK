import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: mocks.isTauri }));
vi.mock("../auth/supabaseClient", () => ({
  getSupabaseClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

import { MealRepositoryError, mealRepository } from "./mealRepository";

describe("meal repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "temporary-access-token" } },
      error: null,
    });
    mocks.invoke.mockResolvedValue({
      status: "ready",
      date: "2026-09-21",
      schoolName: "테스트고",
      menu: ["밥"],
      calories: null,
    });
  });

  it("passes the current session token only to the native command", async () => {
    await mealRepository.load("2026-09-21");
    expect(mocks.invoke).toHaveBeenCalledWith("fetch_bogunon_meal", {
      accessToken: "temporary-access-token",
      date: "2026-09-21",
    });
  });

  it("does not invoke native transport without a current session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(mealRepository.load("2026-09-21")).rejects.toMatchObject<Partial<MealRepositoryError>>({ kind: "signedOut" });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("maps an unset BOGUNON URL without exposing transport details", async () => {
    mocks.invoke.mockRejectedValue("BOGUNON 연결이 필요합니다.");
    await expect(mealRepository.load("2026-09-21")).rejects.toMatchObject<Partial<MealRepositoryError>>({ kind: "connectionRequired" });
  });
});
