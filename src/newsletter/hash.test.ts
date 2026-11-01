import { describe, expect, it } from "vitest"
import { canonicalJson, semanticHashSync } from "./hash"

describe("semantic hash", () => {
  it("matches the platform SHA-256 digest of canonical JSON", async () => {
    // Given
    const payload = { userEdit: { text: "Teacher" }, aiGenerated: { text: "Draft", generatedAt: "2026-01-01T00:00:00.000Z" } }
    const bytes = new TextEncoder().encode(canonicalJson(payload))

    // When
    const platformDigest = await crypto.subtle.digest("SHA-256", bytes)
    const expected = Array.from(new Uint8Array(platformDigest), (byte) => byte.toString(16).padStart(2, "0")).join("")

    // Then
    expect(semanticHashSync(payload)).toBe(expected)
  })
})
