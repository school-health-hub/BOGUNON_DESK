import { describe, expect, it } from "vitest";
import { calculateRemainingDays, calendarCells, formatDday, toLocalDateKey } from "./date";

describe("surface date helpers", () => {
  it("builds complete month rows and local date keys", () => {
    expect(calendarCells(2026, 9)).toHaveLength(35);
    expect(calendarCells(2026, 9).filter((day) => day !== null)).toHaveLength(31);
    expect(toLocalDateKey(new Date(2026, 9, 3))).toBe("2026-10-03");
  });

  it.each([["2026-10-23", 0, "D-Day"], ["2026-10-30", 7, "D-7"], ["2026-10-19", -4, "D+4"]] as const)(
    "formats %s relative to the synthetic base date",
    (target, difference, label) => {
      expect(calculateRemainingDays(target, new Date(2026, 9, 23))).toBe(difference);
      expect(formatDday(difference)).toBe(label);
    },
  );
});
