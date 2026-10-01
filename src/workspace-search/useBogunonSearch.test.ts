import { describe, expect, it } from "vitest";
import { createSearchSequence } from "./useBogunonSearch";

describe("BOGUNON search stale-result guard", () => {
  it("accepts only the latest request sequence", () => {
    const sequence = createSearchSequence();
    const first = sequence.next();
    const second = sequence.next();

    expect(sequence.isCurrent(first)).toBe(false);
    expect(sequence.isCurrent(second)).toBe(true);
  });
});
