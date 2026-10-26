import { describe, expect, it } from "vitest"
import { createNewsletterDesignState } from "./designSchema"
import { restoreDesignRevision, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"

const NOW = "2026-01-01T00:00:00.000Z"

describe("Newsletter design revision compatibility", () => {
  it("restores a V2 snapshot as a new contiguous V2 revision", () => {
    const v1 = createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: NOW })
    const v2 = upgradeNewsletterDesignStateV2(v1, "2026-01-02T00:00:00.000Z")
    const changed = updateCardLayout(v2, { cardIndex: 2, patch: { background: "#fff4dc" }, now: "2026-01-03T00:00:00.000Z" })

    const restored = restoreDesignRevision(changed, { revision: 2, now: "2026-01-04T00:00:00.000Z" })

    expect(restored.designSchemaVersion).toBe(2)
    expect(restored.designRevision).toBe(4)
    expect(restored.revisionHistory[3]).toMatchObject({ revision: 4, restoredFromRevision: 2, snapshotVersion: 2 })
    expect(restored.cardLayouts[2]).toEqual(v2.cardLayouts[2])
  })

  it("restores a preserved V1 snapshot only after the explicit V2 upgrade", () => {
    const v1 = createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: NOW })
    const v2 = upgradeNewsletterDesignStateV2(v1, "2026-01-02T00:00:00.000Z")

    const restored = restoreDesignRevision(v2, { revision: 1, now: "2026-01-03T00:00:00.000Z" })

    expect(restored.designSchemaVersion).toBe(2)
    expect(restored.designRevision).toBe(3)
    expect(restored.revisionHistory[2]).toMatchObject({ restoredFromRevision: 1, snapshotVersion: 2 })
    expect(restored.revisionHistory[0]).toMatchObject({ snapshotVersion: 1, snapshot: v1.revisionHistory[0]?.snapshot })
  })
})
