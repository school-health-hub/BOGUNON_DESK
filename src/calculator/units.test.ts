import { describe, expect, it } from "vitest";
import { convertUnit } from "./units";

describe("unit conversion", () => {
  it.each([
    [1000, "mL", "L", 1],
    [1.5, "L", "mL", 1500],
    [1000, "g", "kg", 1],
    [2.5, "kg", "g", 2500],
    [100, "cm", "m", 1],
    [1000, "mm", "m", 1],
    [1, "m", "cm", 100],
  ] as const)("converts %s %s to %s", (value, from, to, expected) => {
    expect(convertUnit(value, from, to)).toEqual({ status: "ready", value: expected });
  });

  it("rejects invalid values and incompatible dimensions", () => {
    expect(convertUnit(Number.NaN, "mL", "L")).toEqual({ status: "error" });
    expect(convertUnit(1, "m", "kg")).toEqual({ status: "error" });
  });
});
