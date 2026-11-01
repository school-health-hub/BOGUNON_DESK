import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "./project"
import { createNewsletterDesignState } from "./rendering/designSchema"
import { updateCardLayout, upgradeNewsletterDesignStateV2 } from "./rendering/designState"
import { addStudioAssetFiles, parseStudioDocument, serializeStudioDocument } from "./studioDocument"

describe("portable Newsletter document", () => {
  it("round trips existing V1 sidecars without changing canonical content", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "portable-studio", title: "학교 보건소식지", now: "2026-10-30T00:00:00.000Z" })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: project.projectRevision, now: "2026-10-30T00:00:00.000Z" })
    // When
    const restored = parseStudioDocument(JSON.parse(serializeStudioDocument({ project, design })))
    // Then
    expect(restored).toEqual({ project, design })
    expect(() => parseStudioDocument({ project, design: { ...design, projectId: "another-project" } })).toThrow(/동일한 프로젝트/)
    expect(() => parseStudioDocument({ project: {}, design })).toThrow()
    const v2 = upgradeNewsletterDesignStateV2(design, "2026-10-30T00:00:00.000Z")
    expect(parseStudioDocument(JSON.parse(serializeStudioDocument({ project, design: v2 }))).design).toEqual(v2)
    const unknownRevision = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 2, now: "2026-10-30T00:00:00.000Z" })
    expect(() => parseStudioDocument({ project, design: unknownRevision })).toThrow(/원고 Revision/)
  })
  it("rejects an image whose SHA is absent from the document manifest", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "portable-assets", title: "보건소식", now: "2026-10-30T00:00:00.000Z" })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: "2026-10-30T00:00:00.000Z" })
    // When / Then
    await expect(addStudioAssetFiles(design, new Map(), [{ name: "unexpected.png", arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }])).rejects.toThrow(/원장에 없는/)
  })
  it("rejects schema-valid missing and unapproved image references at import", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "portable-policy", title: "보건소식", now: "2026-10-30T00:00:00.000Z" })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: "2026-10-30T00:00:00.000Z" })
    const cardLayouts = design.cardLayouts.map((card, index) => index === 0 ? { ...card, image: { ...card.image, assetId: "missing-image" } } : card)
    const referenced = { ...design, cardLayouts, revisionHistory: design.revisionHistory.map(entry => ({ ...entry, snapshot: { ...entry.snapshot, cardLayouts } })) }
    // When / Then
    expect(() => parseStudioDocument({ project, design: referenced })).toThrow(/not approved/)
    const asset = { id: "missing-image", sha256: "a".repeat(64), mediaType: "image/png", approvalStatus: "reference-only", originalName: "reference.png", localReference: `asset:${"a".repeat(64)}` }
    const unapproved = { ...referenced, assetManifest: [asset], revisionHistory: referenced.revisionHistory.map(entry => ({ ...entry, snapshot: { ...entry.snapshot, assetManifest: [asset] } })) }
    expect(() => parseStudioDocument({ project, design: unapproved })).toThrow(/not approved/)
    const v2 = upgradeNewsletterDesignStateV2(design, "2026-10-30T00:00:00.000Z")
    const topic = v2.cardLayouts[1]
    if (topic === undefined) throw new Error("Missing topic fixture")
    const moduleReference = updateCardLayout(v2, { cardIndex: 1, now: "2026-10-30T00:00:00.000Z", patch: { editorial: { layoutType: "B", studentComposition: "objects", season: "none", moduleImages: Array.from({ length: 4 }, (_, index) => ({ ...topic.image, slotId: `module-${index + 1}`, assetId: "missing-image" })) } } })
    expect(() => parseStudioDocument({ project, design: moduleReference })).toThrow(/not approved/)
  })
  it("rejects invalid historical-only assets before a later Revision restore can crash", async () => {
    // Given: the current snapshot is valid; only revision one references the bad image.
    const project = await createNewsletterProject({ projectId: "portable-history", title: "보건소식", now: "2026-10-30T00:00:00.000Z" })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: "2026-10-30T00:00:00.000Z" })
    const initial = design.revisionHistory[0]
    if (initial === undefined) throw new Error("Missing initial revision")
    const cards = design.cardLayouts.map((card, index) => index === 0 ? { ...card, image: { ...card.image, assetId: "historical-image" } } : card)
    const historyOnly = { ...design, designRevision: 2, revisionHistory: [{ ...initial, snapshot: { ...initial.snapshot, cardLayouts: cards } }, { ...initial, revision: 2 }] }
    // When / Then
    expect(() => parseStudioDocument({ project, design: historyOnly })).toThrow(/not approved/)
    const asset = { id: "historical-image", sha256: "a".repeat(64), mediaType: "image/png", approvalStatus: "reference-only", originalName: "reference.png", localReference: `asset:${"a".repeat(64)}` }
    const unapprovedHistory = { ...historyOnly, revisionHistory: [{ ...initial, snapshot: { ...initial.snapshot, cardLayouts: cards, assetManifest: [asset] } }, { ...initial, revision: 2 }] }
    expect(() => parseStudioDocument({ project, design: unapprovedHistory })).toThrow(/not approved/)
  })
})
