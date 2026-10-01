import { describe, expect, it } from "vitest";
import { validateUpdaterReleaseConfiguration } from "./updater-release-preflight.mjs";

const endpoint = "https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/latest.json";
const valid = {
  updater: { pubkey: "fixture-public-key", endpoints: [endpoint], windows: { installMode: "passive" } },
  releaseBundle: { createUpdaterArtifacts: true },
  notes: ["fixture release note"],
  signingKeyConfigured: true,
  signingPasswordConfigured: true,
  publishedAt: "2026-09-29T05:00:00.000Z",
};

describe("updater release preflight", () => {
  it("accepts the release-only updater configuration", () => {
    expect(() => validateUpdaterReleaseConfiguration(valid)).not.toThrow();
  });

  it.each([
    ["missing public key", { updater: { ...valid.updater, pubkey: "" } }],
    ["wrong endpoint", { updater: { ...valid.updater, endpoints: ["https://example.com/latest.json"] } }],
    ["non-passive install", { updater: { ...valid.updater, windows: { installMode: "quiet" } } }],
    ["artifacts disabled", { releaseBundle: { createUpdaterArtifacts: false } }],
    ["missing signing key", { signingKeyConfigured: false }],
    ["missing password", { signingPasswordConfigured: false }],
    ["missing published date", { publishedAt: undefined }],
    ["malformed published date", { publishedAt: "2026-09-29" }],
  ])("rejects %s", (_label, override) => {
    expect(() => validateUpdaterReleaseConfiguration({ ...valid, ...override })).toThrow();
  });
});
