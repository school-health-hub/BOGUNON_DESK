import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn(), isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: mocks.isTauri }));
vi.mock("../auth/supabaseClient", () => ({ getSupabaseClient: () => ({ auth: { getSession: mocks.getSession } }) }));

import { WeatherRepositoryError, weatherRepository } from "./weatherRepository";

describe("weather repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "temporary-access-token" } }, error: null });
    mocks.invoke.mockResolvedValue({ status: "school-missing" });
  });

  it("passes the current session token only to the native command", async () => {
    await weatherRepository.load();
    expect(mocks.invoke).toHaveBeenCalledWith("fetch_bogunon_weather", { accessToken: "temporary-access-token" });
  });

  it("does not invoke native transport without a current session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(weatherRepository.load()).rejects.toMatchObject<Partial<WeatherRepositoryError>>({ kind: "signedOut" });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("maps an unset BOGUNON URL", async () => {
    mocks.invoke.mockRejectedValue("BOGUNON 연결이 필요합니다.");
    await expect(weatherRepository.load()).rejects.toMatchObject<Partial<WeatherRepositoryError>>({ kind: "connectionRequired" });
  });
});
