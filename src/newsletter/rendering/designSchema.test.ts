import { describe, expect, it } from "vitest"
import { createNewsletterDesignState, parseNewsletterDesignState } from "./designSchema"

describe("NewsletterDesignStateV1", () => {
  it("creates a six-topic A4 and seven-card design sidecar", () => {
    // Given / When
    const design = createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: "2026-01-01T00:00:00.000Z" })

    // Then
    expect(design.designSchemaVersion).toBe(1)
    expect(design.cardLayouts).toHaveLength(7)
    expect(design.a4Layout.modules).toHaveLength(6)
  })

  it("rejects unsupported future versions", () => {
    // Given
    const design = createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: "2026-01-01T00:00:00.000Z" })

    // When / Then
    expect(() => parseNewsletterDesignState({ ...design, designSchemaVersion: 2 })).toThrow()
  })
})
