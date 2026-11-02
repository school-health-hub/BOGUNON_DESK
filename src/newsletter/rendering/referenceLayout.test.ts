import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout, restoreDesignRevision, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { applyReferenceLayout } from "./referenceLayout"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"

it("creates a scoped reference composition with source actions and a left story checklist", async () => {
  // Given
  const now = "2026-11-01T01:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "reference-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `주제 ${index}`, text: "함께 실천해요\n1. 비누로 손 씻기\n2. 음식은 충분히 익혀 먹기\n3. 물은 끓여 마시기\n4. 아프면 보호자와 보건실에 알리기" })) })
  let design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  for (const [cardIndex, layoutType] of [[0, "A"], [1, "B"], [2, "C"]] as const) design = applyEditorialLayout(design, { cardIndex, layoutType, now })
  const before = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision }))
  // When
  const next = applyReferenceLayout(design, { cardIndices: [0, 1, 2], now })
  const document = compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision })
  const scene = buildNewsletterScene(document)
  // Then
  expect(scene.pages[0]).toEqual(before.pages[0])
  expect(scene.pages.slice(4)).toEqual(before.pages.slice(4))
  expect(document.cards[2]?.editorial?.modules.every(module => module.action.frame.x < 600)).toBe(true)
  expect(document.cards[1]?.editorial?.modules.map(module => [module.action.text, module.description?.text].filter(Boolean).join(" "))).toEqual(["비누로 손 씻기", "음식은 충분히 익혀 먹기", "물은 끓여 마시기", "아프면 보호자와 보건실에 알리기"])
  expect(validateNewsletterScene(scene).filter(issue => ["card-cover", "card-topic-1", "card-topic-2"].includes(issue.pageId))).toEqual([])
  expect(parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(next)))).toEqual(next)
  expect(restoreDesignRevision(next, { revision: design.designRevision, now }).cardLayouts).toEqual(design.cardLayouts)
})

it("rejects applying reference composition to a service card", () => {
  // Given
  const now = "2026-11-01T01:00:00.000Z"
  const design = applyEditorialLayout(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "reference-test", canonicalProjectRevision: 1, now }), now), { cardIndex: 1, layoutType: "D", now })
  // When / Then
  expect(() => applyReferenceLayout(design, { cardIndices: [1], now })).toThrow("TYPE A/B/C")
})

it("rejects TYPE D reference flags in current state and historical snapshots", () => {
  // Given
  const now = "2026-11-01T01:00:00.000Z"
  const design = applyEditorialLayout(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "reference-test", canonicalProjectRevision: 1, now }), now), { cardIndex: 1, layoutType: "D", now })
  const cards = design.cardLayouts.map((card, index) => index === 1 && card.editorial !== undefined ? { ...card, editorial: { ...card.editorial, referenceLayout: true } } : card)
  const imported = { ...design, cardLayouts: cards, revisionHistory: design.revisionHistory.map(entry => entry.revision === design.designRevision ? { ...entry, snapshot: { ...entry.snapshot, cardLayouts: cards } } : entry) }
  // When / Then
  expect(() => parseNewsletterDesignStateV2(imported)).toThrow("visual finish requires TYPE A, B, or C")
  expect(() => parseNewsletterDesignStateV2({ ...imported, cardLayouts: design.cardLayouts })).toThrow("visual finish requires TYPE A, B, or C")
})

it("leaves the reference route when a regular layout is selected", () => {
  // Given
  const now = "2026-11-01T01:00:00.000Z"
  const initial = applyEditorialLayout(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "reference-test", canonicalProjectRevision: 1, now }), now), { cardIndex: 1, layoutType: "B", now })
  const reference = applyReferenceLayout(initial, { cardIndices: [1], now })
  // When
  const regular = applyEditorialLayout(reference, { cardIndex: 1, layoutType: "C", now })
  // Then
  expect(regular.cardLayouts[1]?.editorial?.referenceLayout).toBeUndefined()
})

const validMask = { assetId: "hero", sha256: "a".repeat(64), sourceWidth: 1536, sourceHeight: 1024, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }
function maskedFixture(patch: Partial<typeof validMask> = {}) {
  const now = "2026-11-01T01:00:00.000Z"
  const design = applyEditorialLayout(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "reference-test", canonicalProjectRevision: 1, now }), now), { cardIndex: 0, layoutType: "A", now })
  const assetManifest = [{ id: "hero", sha256: validMask.sha256, mediaType: "image/png" as const, approvalStatus: "approved" as const, originalName: "hero.png" }]
  const cards = design.cardLayouts.map((card, index) => index === 0 ? { ...card, image: { ...card.image, assetId: "hero" }, editorial: { ...card.editorial, foregroundMask: { ...validMask, ...patch } } } : card)
  return { ...design, assetManifest, cardLayouts: cards, revisionHistory: design.revisionHistory.map(entry => entry.revision === design.designRevision ? { ...entry, snapshot: { ...entry.snapshot, assetManifest, cardLayouts: cards } } : entry) }
}

it("accepts a complete mask bound to its original image and SHA", () => {
  // Given / When
  const parsed = parseNewsletterDesignStateV2(maskedFixture())
  // Then
  expect(parsed.cardLayouts[0]?.editorial?.foregroundMask).toEqual(validMask)
})

it.each([
  { points: validMask.points.slice(0, 2) },
  { points: Array.from({ length: 65 }, () => ({ x: 0, y: 0 })) },
  { points: [{ x: -1, y: 0 }, ...validMask.points] },
  { points: [{ x: 1.01, y: 0 }, ...validMask.points] },
  { points: [{ x: Number.NaN, y: 0 }, ...validMask.points] },
  { points: [{ x: 0, y: Number.POSITIVE_INFINITY }, ...validMask.points] },
  { sourceWidth: 0 }, { assetId: "another-hero" }, { sha256: "b".repeat(64) },
])("rejects an invalid-only mask perturbation at the saved-document boundary: %j", patch => {
  // Given
  const imported = maskedFixture(patch)
  // When / Then
  expect(() => parseNewsletterDesignStateV2(imported)).toThrow()
})

it("clears the bound foreground mask centrally when the hero is removed", () => {
  // Given
  const design = parseNewsletterDesignStateV2(maskedFixture())
  // When
  const next = updateCardLayout(design, { cardIndex: 0, now: "2026-11-01T02:00:00.000Z", patch: { image: { assetId: undefined } } })
  // Then
  expect(next.designSchemaVersion === 2 && next.cardLayouts[0]?.editorial?.foregroundMask).toBeUndefined()
})
