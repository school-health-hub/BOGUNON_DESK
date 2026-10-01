import { describe, expect, it } from "vitest";
import { calculateChangeRate, calculatePartPercentage, calculatePercentageValue } from "./percentage";

describe("percentage calculations", () => {
  it("calculates part, percentage value, increase, decrease, and no change", () => {
    expect(calculatePartPercentage(356, 370)).toEqual({ status: "ready", value: 96.2 });
    expect(calculatePercentageValue(350000, 80)).toEqual({ status: "ready", value: 280000 });
    expect(calculateChangeRate(18, 24)).toEqual({ status: "ready", direction: "increase", value: 33.3 });
    expect(calculateChangeRate(24, 18)).toEqual({ status: "ready", direction: "decrease", value: 25 });
    expect(calculateChangeRate(20, 20)).toEqual({ status: "ready", direction: "same", value: 0 });
  });

  it("rejects zero denominators", () => {
    expect(calculatePartPercentage(1, 0)).toEqual({ status: "error" });
    expect(calculateChangeRate(0, 5)).toEqual({ status: "error" });
  });
});
