import { describe, expect, it } from "vitest"
import { createNewsletterDesignState } from "./designSchema"
import { applyA4LayoutVariant, applyCardImageTextRatio, applyCardLayoutVariant, restoreDesignRevision, updateA4ModuleLayout, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { canonicalJson } from "../hash"

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

  it("records V2 module and card variants without changing canonical linkage or non-target layouts", () => {
    const v1 = createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 7, now: NOW })
    const v2 = upgradeNewsletterDesignStateV2(v1, "2026-01-02T00:00:00.000Z")
    const untouchedCards = canonicalJson(v2.cardLayouts.slice(1))
    const cardChanged = applyCardLayoutVariant(v2, { cardIndex: 0, variant: "image-focus", now: "2026-01-03T00:00:00.000Z" })
    const moduleChanged = applyA4LayoutVariant(cardChanged, { moduleIndex: 2, variant: "text-focus", now: "2026-01-04T00:00:00.000Z" })

    expect(moduleChanged.canonicalProjectRevision).toBe(7)
    expect(moduleChanged.designRevision).toBe(4)
    expect(canonicalJson(moduleChanged.cardLayouts.slice(1))).toBe(untouchedCards)
    expect(moduleChanged.a4Layout.modules[2]?.imageTextColumnRatio).toBe(0.3)
    expect(moduleChanged.revisionHistory[3]?.changedPageIds).toEqual(["a4-page"])
  })

  it("supports ratio, marker, accent, and frame edits as independent revisions", () => {
    const v2 = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "project-1", canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")
    const ratio = applyCardImageTextRatio(v2, { cardIndex: 1, ratio: 0.45, now: "2026-01-03T00:00:00.000Z" })
    const card = updateCardLayout(ratio, { cardIndex: 1, now: "2026-01-04T00:00:00.000Z", patch: { accent: "#5f8fb9", listMarkerStyle: "check", closingFrame: { height: 96 } } })
    if (card.designSchemaVersion !== 2) throw new Error("expected V2 fixture")
    const module = updateA4ModuleLayout(card, { moduleIndex: 0, now: "2026-01-05T00:00:00.000Z", patch: { listMarkerStyle: "number", image: { fit: "cover" } } })

    expect(module.designRevision).toBe(5)
    expect(module.cardLayouts[1]).toMatchObject({ imageTextColumnRatio: 0.45, accent: "#5f8fb9", listMarkerStyle: "check", closingFrame: { height: 96 } })
    expect(module.a4Layout.modules[0]).toMatchObject({ listMarkerStyle: "number", image: { fit: "cover" } })
  })
})
