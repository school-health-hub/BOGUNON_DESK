import { describe, expect, it } from "vitest";
import { extractMemoUrls } from "./extractMemoUrls";

describe("extractMemoUrls", () => {
  it("extracts unique http and https URLs without trailing punctuation", () => {
    const memo = "https://example.com). http://school.example.kr/page. https://example.com";

    expect(extractMemoUrls(memo)).toEqual([
      "https://example.com/",
      "http://school.example.kr/page",
    ]);
  });

  it("rejects unsupported and malformed URLs", () => {
    const memo = "javascript:alert(1) file:///C:/secret mailto:test@example.com https://";

    expect(extractMemoUrls(memo)).toEqual([]);
  });

  it("limits the visible URLs to five", () => {
    const memo = Array.from({ length: 7 }, (_, index) => `https://example.com/${index}`).join("\n");

    expect(extractMemoUrls(memo)).toHaveLength(5);
  });
});
