import { describe, expect, it } from "vitest";
import { filterWorkFolderFavorites } from "./workFolderService";

const favorites = [
  { id: "1", name: "검진", path: "C:\\School\\2026\\건강검진", displayPath: "...\\2026\\건강검진", available: true },
  { id: "2", name: "공문", path: "C:\\School\\문서", displayPath: "...\\School\\문서", available: false },
] as const;

describe("work folder search", () => {
  it("matches a one-character favorite name query", () => {
    expect(filterWorkFolderFavorites(favorites, "검").map((item) => item.id)).toEqual(["1"]);
  });

  it("matches the folder basename without searching the full path", () => {
    expect(filterWorkFolderFavorites(favorites, "건강").map((item) => item.id)).toEqual(["1"]);
    expect(filterWorkFolderFavorites(favorites, "School")).toEqual([]);
  });
});
