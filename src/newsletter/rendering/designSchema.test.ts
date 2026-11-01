import { describe, expect, it } from "vitest"
import { createNewsletterDesignState, parseNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
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
    expect(upgraded.a4Layout.brand).toMatchObject({ mascot: { slotId: "a4-header-mascot" }, seasonalDecoration: { slotId: "a4-seasonal-decoration" } })
    expect(upgraded.cardLayouts[0]?.brand).toMatchObject({ mascot: { slotId: "cover-mascot" }, seasonalDecoration: { slotId: "cover-seasonal-decoration" }, previewTopicCount: 4 })
    expect(upgraded.cardLayouts[1]?.brand).toMatchObject({ mascot: { slotId: "topic-mascot-1" } })
  })

  it("keeps persisted V2 sidecars readable when optional September brand frames are absent", () => {
    // Given
    const upgraded = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: "2026-01-01T00:00:00.000Z" }), "2026-01-02T00:00:00.000Z")
    const { brand: _a4Brand, ...legacyA4 } = upgraded.a4Layout
    const legacyCards = upgraded.cardLayouts.map(({ brand: _brand, ...card }) => card)
    const final = upgraded.revisionHistory[1]
    if (final?.snapshotVersion !== 2) throw new Error("expected V2 revision fixture")
    const { brand: _snapshotA4Brand, ...legacySnapshotA4 } = final.snapshot.a4Layout
    const legacySnapshotCards = final.snapshot.cardLayouts.map(({ brand: _brand, ...card }) => card)
    const legacy = { ...upgraded, a4Layout: legacyA4, cardLayouts: legacyCards, revisionHistory: [upgraded.revisionHistory[0], { ...final, snapshot: { ...final.snapshot, a4Layout: legacySnapshotA4, cardLayouts: legacySnapshotCards } }] }

    // When
    const parsed = parseNewsletterDesignStateV2(legacy)

    // Then
    expect(parsed.a4Layout.brand).toBeUndefined()
    expect(parsed.cardLayouts.every((card) => card.brand === undefined)).toBe(true)
  })
})
