import { describe, expect, it } from "vitest"
import { mascotEnlargementWarning } from "./mascotQuality"

describe("mascot output resolution", () => {
  it("warns when the contained image exceeds native pixels", () => {
    // Given / When
    const warning = mascotEnlargementWarning({ width: 900, height: 1000 }, 1.5)
    // Then
    expect(warning).toContain("1254")
  })
  it("does not warn for native-sized contained images", () => {
    // Given / When
    const warning = mascotEnlargementWarning({ width: 250, height: 228 }, 2)
    // Then
    expect(warning).toBeUndefined()
  })
})
