import { describe, expect, it } from "vitest"
import { createNewsletterDesignState, parseNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"

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
    expect(() => parseNewsletterDesignState({ ...design, designSchemaVersion: 3 })).toThrow()
  })

  it("upgrades only through the explicit V2 converter and preserves V1 history", () => {
    const design = createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: "2026-01-01T00:00:00.000Z" })

    const upgraded = upgradeNewsletterDesignStateV2(design, "2026-01-02T00:00:00.000Z")

    expect(design.designSchemaVersion).toBe(1)
    expect(upgraded.designSchemaVersion).toBe(2)
    expect(upgraded.designRevision).toBe(2)
    expect(upgraded.revisionHistory[0]).toMatchObject({ revision: 1, snapshotVersion: 1, snapshot: design.revisionHistory[0]?.snapshot })
    expect(upgraded.revisionHistory[1]).toMatchObject({ revision: 2, snapshotVersion: 2 })
    expect(upgraded.templateVersion).toBe(2)
  })
})
