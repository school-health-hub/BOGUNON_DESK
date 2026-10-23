// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeatherSurfaceWidget } from "./CompactSurfaceWidgets";
import type { SurfaceWeather } from "../projection";

afterEach(cleanup);

const weather = (state: SurfaceWeather["state"]): SurfaceWeather => ({
  state,
  temperatureCelsius: state === "ready" ? 18 : null,
  condition: state === "ready" ? "합성 맑음" : null,
  iconCode: state === "ready" ? "sunny" : null,
  updatedAt: state === "ready" ? "2026-10-23T09:35:00+09:00" : null,
});

describe("WeatherSurfaceWidget", () => {
  it.each([
    ["loading", "날씨를 불러오는 중입니다."],
    ["empty", "표시할 합성 날씨가 없습니다."],
    ["error", "날씨 정보를 불러오지 못했습니다."],
  ] as const)("renders the %s state", (state, message) => {
    render(<WeatherSurfaceWidget weather={weather(state)} />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("renders ready weather with the latest synthetic observation", () => {
    render(<WeatherSurfaceWidget weather={weather("ready")} />);
    expect(screen.getByText("18°")).toBeTruthy();
    expect(screen.getByText("합성 맑음")).toBeTruthy();
  });
});
