import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["./**/*.ts", "./**/*.tsx"], { eager: true, query: "?raw", import: "default" });

describe("surface renderer import boundary", () => {
  it("does not import privileged Main providers or native commands", () => {
    const productionSources = Object.entries(sources).filter(([path]) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"));
    const forbidden = ["supabaseClient", "AuthContext", "WorkspaceDataContext", "@tauri-apps/api", "invoke(", "Finance"];
    for (const [path, source] of productionSources) {
      expect(typeof source, path).toBe("string");
      if (typeof source === "string") for (const marker of forbidden) expect(source, `${path} contains ${marker}`).not.toContain(marker);
    }
  });
});
