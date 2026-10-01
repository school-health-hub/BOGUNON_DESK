import { describe, expect, it } from "vitest";
import { generateUpdaterDocuments } from "./generate-updater-manifest.mjs";

const validInput = {
  version: "0.2.0",
  publishedAt: "2026-09-29T05:00:00.000Z",
  notes: ["첫 공개 업데이트"],
  installerUrl: "https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/0.2.0/BOGUNON-DESK-0.2.0-Windows-x64-Setup.exe",
  signature: "fixture-signature-not-a-production-secret",
  sha256: "a".repeat(64),
  bytes: 123456,
};

describe("updater manifest generation", () => {
  it("generates updater and web metadata from one canonical input", () => {
    const result = generateUpdaterDocuments(validInput);

    expect(result.latest.version).toBe("0.2.0");
    expect(result.latest.pub_date).toBe(validInput.publishedAt);
    expect(result.latest.platforms["windows-x86_64"]).toEqual({
      url: validInput.installerUrl,
      signature: validInput.signature,
    });
    expect(result.metadata).toMatchObject({
      version: "0.2.0",
      publishedAt: validInput.publishedAt,
      notes: validInput.notes,
      installerUrl: validInput.installerUrl,
      sha256: validInput.sha256,
      bytes: validInput.bytes,
    });
  });

  it.each([
    ["malformed date", { publishedAt: "not-a-date" }],
    ["empty signature", { signature: "" }],
    ["empty installer URL", { installerUrl: "" }],
    ["non-HTTPS URL", { installerUrl: "http://example.com/setup.exe" }],
  ])("rejects %s", (_label, override) => {
    expect(() => generateUpdaterDocuments({ ...validInput, ...override })).toThrow();
  });

  it("does not copy unrelated environment secrets into output", () => {
    const secret = "fixture-private-key-value";
    const output = JSON.stringify(generateUpdaterDocuments(validInput));
    expect(output).not.toContain(secret);
  });
});
