import { describe, expect, it } from "vitest";
import { formatMealDate } from "./MealDataContext";

describe("meal date lifecycle", () => {
  it("uses the local calendar date shared by widgets", () => {
    expect(formatMealDate(new Date(2026, 8, 21, 23, 59))).toBe("2026-09-21");
    expect(formatMealDate(new Date(2026, 8, 22, 0, 0))).toBe("2026-09-22");
  });
});
