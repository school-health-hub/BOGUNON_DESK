import { describe, expect, it, vi } from "vitest";
import { copyOfficialDocumentText } from "./clipboard";

describe("official document clipboard", () => {
  it("copies the exact result without persistence", async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(copyOfficialDocumentText(writeText, "본문", "1. 관련: 테스트")).resolves.toBe(
      "본문을(를) 복사했습니다.",
    );
    expect(writeText).toHaveBeenCalledWith("1. 관련: 테스트");
  });
});
