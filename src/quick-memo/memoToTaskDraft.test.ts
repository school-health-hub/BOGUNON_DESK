import { describe, expect, it } from "vitest";
import { memoToTaskDraft } from "./memoToTaskDraft";

describe("memoToTaskDraft", () => {
  it("returns null when no non-empty line exists", () => {
    expect(memoToTaskDraft("\n  \n")).toBeNull();
  });

  it("normalizes only the first non-empty line", () => {
    expect(memoToTaskDraft("\n  결핵검진   결과 공문 확인  \n두 번째 줄"))
      .toBe("결핵검진 결과 공문 확인");
  });

  it("limits the draft to the Quick Add title boundary", () => {
    expect(memoToTaskDraft("가".repeat(121))).toBe("가".repeat(120));
  });
});
