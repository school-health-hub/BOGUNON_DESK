import { describe, expect, it } from "vitest";
import { getWeekDates, isSameLocalDate } from "./dateSource";

const calendarParts = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe("getWeekDates", () => {
  it("returns the Monday-through-Sunday range when now is Monday", () => {
    const dates = getWeekDates(new Date(2026, 8, 21, 9));

    expect(dates.map(calendarParts)).toEqual([
      [2026, 9, 21], [2026, 9, 22], [2026, 9, 23], [2026, 9, 24],
      [2026, 9, 25], [2026, 9, 26], [2026, 9, 27],
    ]);
  });

  it("returns the same range when now is midweek", () => {
    const dates = getWeekDates(new Date(2026, 8, 23, 15));

    expect(dates.map(calendarParts)).toEqual([
      [2026, 9, 21], [2026, 9, 22], [2026, 9, 23], [2026, 9, 24],
      [2026, 9, 25], [2026, 9, 26], [2026, 9, 27],
    ]);
  });

  it("crosses a month boundary using local calendar dates", () => {
    const dates = getWeekDates(new Date(2026, 9, 1, 12));

    expect(dates.map(calendarParts)).toEqual([
      [2026, 9, 28], [2026, 9, 29], [2026, 9, 30], [2026, 10, 1],
      [2026, 10, 2], [2026, 10, 3], [2026, 10, 4],
    ]);
  });

  it("crosses a year boundary using local calendar dates", () => {
    const dates = getWeekDates(new Date(2027, 0, 1, 12));

    expect(dates.map(calendarParts)).toEqual([
      [2026, 12, 28], [2026, 12, 29], [2026, 12, 30], [2026, 12, 31],
      [2027, 1, 1], [2027, 1, 2], [2027, 1, 3],
    ]);
  });

  it("matches exactly one computed date as today", () => {
    const now = new Date(2026, 8, 23, 15);
    const dates = getWeekDates(now);

    expect(dates.filter((date) => isSameLocalDate(now, date))).toHaveLength(1);
    expect(calendarParts(dates[2])).toEqual([2026, 9, 23]);
  });
});
