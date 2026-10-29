import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
import { parseWebSearchResult, searchChatGptWebNative, supportedWebSearchModel } from "./webSearch";
import { invoke } from "@tauri-apps/api/core";

describe("ChatGPT structured web search", () => {
  it("gates exact supported models", () => {
    expect(supportedWebSearchModel("gpt-6-astra")).toBe(true);
    expect(supportedWebSearchModel("gpt-6-astra-other")).toBe(false);
  });
  it("accepts provider evidence envelope", () => {
    expect(parseWebSearchResult({ text: "synthetic", sources: [{ url: "https://example.org", title: "source" }], checkedAt: "2026-10-22T00:00:00Z" }).sources).toHaveLength(1);
  });
  it.each([{ sources: [] }, { sources: [{ url: "javascript:alert(1)", title: "bad" }] }, { sources: [{ url: "https://user:password@example.org", title: "bad" }] }])("rejects absent or unsafe sources", ({ sources }) => {
    expect(() => parseWebSearchResult({ text: "claim", sources, checkedAt: "2026-10-22T00:00:00Z" })).toThrow();
  });
  it("does not dispatch unsupported models", async () => {
    vi.mocked(invoke).mockClear();
    await expect(searchChatGptWebNative("unknown", "synthetic")).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});
