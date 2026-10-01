import { describe, expect, it } from "vitest";
import { calculateDateDifference } from "./dateDifference";

describe("local calendar date difference", () => {
  it.each([
    ["2026-09-22", "2026-09-22", 0, 1],
    ["2026-09-22", "2026-10-08", 16, 17],
    ["2026-09-30", "2026-10-01", 1, 2],
    ["2026-12-31", "2027-01-01", 1, 2],
    ["2028-02-28", "2028-03-01", 2, 3],
  ])("calculates %s through %s", (start, end, days, inclusiveDays) => {
    expect(calculateDateDifference(start, end)).toEqual({ status: "ready", days, inclusiveDays });
  });

  it("rejects reverse and invalid ranges", () => {
    expect(calculateDateDifference("2026-10-08", "2026-09-22")).toEqual({ status: "reversed" });
    expect(calculateDateDifference("2026-02-30", "2026-03-01")).toEqual({ status: "invalid" });
  });
});
