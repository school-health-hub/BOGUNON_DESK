import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import { describe, expect, it } from "vitest";
import { getWeatherIcon } from "./weatherIcons";

describe("getWeatherIcon", () => {
  it.each([[0, Sun], [1, CloudSun], [3, Cloud], [45, CloudFog], [61, CloudRain], [80, CloudRain], [75, CloudSnow], [95, CloudLightning], [999, CloudSun]])("maps WMO code %i", (code, icon) => {
    expect(getWeatherIcon(code as number)).toBe(icon);
  });
});
