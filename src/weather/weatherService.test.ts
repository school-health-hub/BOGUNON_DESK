import { describe, expect, it, vi } from "vitest";
import { WeatherRepositoryError } from "./weatherRepository";
import { loadWeatherState } from "./weatherService";
import type { WeatherRepository } from "./types";

const ready = {
  status: "ready" as const,
  schoolName: "테스트고",
  observedAt: "2026-09-21T09:00:00+09:00",
  temperatureC: 24.2,
  apparentTemperatureC: 24,
  weatherCode: 1,
  conditionLabel: "대체로 맑음",
  highC: 27,
  lowC: 18,
};

describe("loadWeatherState", () => {
  it("does not call native repository while signed out", async () => {
    const load = vi.fn();
    expect(await loadWeatherState({ authStatus: "signedOut", repository: { load } })).toEqual({ status: "signedOut" });
    expect(load).not.toHaveBeenCalled();
  });

  it("passes through every safe response status", async () => {
    for (const response of [ready, { status: "school-missing" as const }, { status: "disabled" as const, schoolName: "테스트고" }, { status: "location-unavailable" as const, schoolName: "테스트고" }]) {
      const repository: WeatherRepository = { load: vi.fn().mockResolvedValue(response) };
      expect(await loadWeatherState({ authStatus: "signedIn", repository })).toEqual(response);
    }
  });

  it("maps connection and transport failures", async () => {
    const connection: WeatherRepository = { load: vi.fn().mockRejectedValue(new WeatherRepositoryError("connectionRequired", "missing")) };
    const transport: WeatherRepository = { load: vi.fn().mockRejectedValue(new WeatherRepositoryError("transport", "failed")) };
    expect(await loadWeatherState({ authStatus: "signedIn", repository: connection })).toEqual({ status: "connectionRequired" });
    expect(await loadWeatherState({ authStatus: "signedIn", repository: transport })).toMatchObject({ status: "error", code: "WEATHER_TRANSPORT_ERROR" });
  });
});
