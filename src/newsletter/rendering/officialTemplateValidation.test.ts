import { createNewsletterProject } from "../project"
import { compileRenderDocument } from "./renderDocument"
import { expect, it } from "vitest"
import { createNewsletterDesignState, parseNewsletterDesignStateV2, type CardDesignLayoutV2, type NewsletterDesignStateV2 } from "./designSchema"
import { upgradeNewsletterDesignStateV2, updateCardLayout, restoreDesignRevision, applyEditorialLayout } from "./designState"
import { applyOfficialTemplate, updateOfficialElementFrame, removeOfficialTemplate } from "./officialTemplate"
import { officialTemplateSchema, type OfficialTemplate } from "./officialTemplateSchema"

const now = "2026-11-01T07:00:00.000Z"
const sha = "a".repeat(64)
const template: OfficialTemplate = { version: 1, kind: "cover", elements: [
  { kind: "text", id: "title", label: "제목", binding: "title", frame: { x: 50, y: 50, width: 1000, height: 100 }, zOrder: 10, style: { fontFamily: "Pretendard", fontSize: 60, fontWeight: 800, lineHeight: 1.1, color: "#122B4E", align: "left" } },
  { kind: "image", id: "foreground", label: "전경", binding: "main", frame: { x: 0, y: 300, width: 1200, height: 800 }, zOrder: 9, fit: "contain", edgePolicy: "none", mask: { assetId: "hero", sha256: sha, sourceWidth: 1536, sourceHeight: 1024, points: [{ x: 0, y: .5 }, { x: 1, y: .5 }, { x: 1, y: 1 }, { x: 0, y: 1 }] } },
] }
function maskedDesign(): NewsletterDesignStateV2 {
  const base = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "official-validation", canonicalProjectRevision: 1, now }), now)
  const assetManifest = [{ id: "hero", sha256: sha, mediaType: "image/png" as const, originalName: "hero.png", approvalStatus: "approved" as const, localReference: `asset:${sha}`, registry: { classification: "USER_CREATED" as const, purpose: "illustration" as const, usageScope: "newsletter-output" as const } }]
  const cardLayouts = base.cardLayouts.map((card, index): CardDesignLayoutV2 => index === 0 ? { ...card, image: { ...card.image, assetId: "hero" }, officialTemplate: template } : card)
  const snapshot = { ...base.revisionHistory[base.revisionHistory.length - 1]?.snapshot, designSchemaVersion: 2, assetManifest, cardLayouts }
  return parseNewsletterDesignStateV2({ ...base, assetManifest, cardLayouts, revisionHistory: base.revisionHistory.map((entry, index) => index === base.revisionHistory.length - 1 ? { ...entry, snapshot } : entry) })
}
it("rejects out-of-bounds independent frames and duplicate layer IDs", () => {
  // Given
  expect(() => officialTemplateSchema.parse(template)).not.toThrow()
  // When / Then
  expect(() => officialTemplateSchema.parse({ ...template, elements: template.elements.map((element, index) => index === 0 ? { ...element, frame: { x: 1190, y: 50, width: 1000, height: 100 } } : element) })).toThrow("inside")
  expect(() => officialTemplateSchema.parse({ ...template, elements: [...template.elements, template.elements[0]] })).toThrow("unique")
})
it.each([Number.NaN, Infinity, -0.01, 1.01])("rejects invalid independent mask coordinate %s", coordinate => {
  // Given
  expect(() => officialTemplateSchema.parse(template)).not.toThrow()
  // When
  const changed = { ...template, elements: template.elements.map(element => element.kind === "image" ? { ...element, mask: { ...element.mask, points: [{ x: coordinate, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] } } : element) }
  // Then
  expect(() => officialTemplateSchema.parse(changed)).toThrow()
})
it("rejects current and historical mask bindings that differ from the approved source", () => {
  // Given
  const design = maskedDesign()
  const wrong = { ...template, elements: template.elements.map(element => element.kind === "image" ? { ...element, mask: { ...element.mask, assetId: "different" } } : element) }
  // When / Then
  expect(() => parseNewsletterDesignStateV2({ ...design, cardLayouts: design.cardLayouts.map((card, index) => index === 0 ? { ...card, officialTemplate: wrong } : card) })).toThrow("bound asset")
  expect(() => parseNewsletterDesignStateV2({ ...design, revisionHistory: design.revisionHistory.map((entry, index) => index === 0 ? { ...entry, snapshotVersion: 2, snapshot: { ...design.revisionHistory[1]?.snapshot, cardLayouts: design.cardLayouts.map((card, cardIndex) => cardIndex === 0 ? { ...card, officialTemplate: wrong } : card) } } : entry) })).toThrow("bound asset")
})
it("clears a stale independent mask when its source image is removed", () => {
  // Given
  const design = maskedDesign()
  // When
  const changed = updateCardLayout(design, { cardIndex: 0, now, patch: { image: { assetId: undefined } } })
  // Then
  expect(changed.designSchemaVersion === 2 && changed.cardLayouts[0]?.officialTemplate?.elements.some(element => element.kind === "image" && element.mask !== undefined)).toBe(false)
})
it("creates a stored revision when one free element is edited and restores its previous geometry", () => {
  // Given
  const design = applyOfficialTemplate(maskedDesign(), { cardIndices: [0], now })
  const element = design.cardLayouts[0]?.officialTemplate?.elements.find(value => value.id === "month")
  // When
  const changed = updateOfficialElementFrame(design, { cardIndex: 0, elementId: "month", patch: { x: 75 }, now })
  // Then
  expect(changed.cardLayouts[0]?.officialTemplate?.elements.find(value => value.id === "month")?.frame.x).toBe(75)
  expect(parseNewsletterDesignStateV2(restoreDesignRevision(changed, { revision: design.designRevision, now })).cardLayouts[0]?.officialTemplate?.elements.find(value => value.id === "month")).toEqual(element)
})
it("keeps the old card definitions available and exits the new template on legacy selection", () => {
  // Given
  const design = maskedDesign()
  const applied = applyOfficialTemplate(design, { cardIndices: [0], now })
  // When
  const returned = removeOfficialTemplate(applied, { cardIndex: 0, now })
  const legacy = applyEditorialLayout(applied, { cardIndex: 0, layoutType: "A", now })
  // Then
  expect(returned.cardLayouts[0]?.image).toEqual(design.cardLayouts[0]?.image)
  expect(returned.cardLayouts[0]?.officialTemplate).toBeUndefined()
  expect(legacy.cardLayouts[0]?.officialTemplate).toBeUndefined()
})
it("does not render an unmasked auxiliary image after a module asset is replaced", async () => {
  // Given
  const base = maskedDesign()
  const assetManifest = [...base.assetManifest, { ...base.assetManifest[0], id: "replacement", sha256: "b".repeat(64), localReference: `asset:${"b".repeat(64)}` }]
  const latest = base.revisionHistory[base.revisionHistory.length - 1]
  const design = parseNewsletterDesignStateV2({ ...base, assetManifest, revisionHistory: base.revisionHistory.map(entry => entry === latest ? { ...entry, snapshot: { ...entry.snapshot, assetManifest } } : entry) })
  const sourceImages = [0, 1, 2, 3].map(index => ({ slotId: `module-${index}`, assetId: "hero", frame: { x: 0, y: 0, width: 100, height: 100 }, fit: "contain" as const }))
  const auxiliary = { ...template, elements: template.elements.map(element => element.kind === "image" ? { ...element, binding: "module-0" as const, maskedOnly: true as const } : element) }
  const bound = parseNewsletterDesignStateV2(updateCardLayout(design, { cardIndex: 0, now, patch: { officialTemplate: auxiliary, editorial: { layoutType: "A", studentComposition: "mixed", season: "autumn", moduleImages: sourceImages } } }))
  const project = await createNewsletterProject({ projectId: design.projectId, title: "11월 소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `topic-${i}`, title: `주제 ${i}`, text: "1. 손 씻기\n2. 음식 익히기\n3. 물 끓이기\n4. 아프면 알리기" })) })
  // When
  const changed = parseNewsletterDesignStateV2(updateCardLayout(bound, { cardIndex: 0, now, patch: { editorial: { layoutType: "A", studentComposition: "mixed", season: "autumn", moduleImages: sourceImages.map((image, index) => index === 0 ? { ...image, assetId: "replacement" } : image) } } }))
  const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
  // Then
  expect(document.cards[0]?.officialLayers?.some(layer => layer.kind === "image" && layer.layerId.endsWith("foreground"))).toBe(false)
})

it("clears a direct element mask when its independent asset is replaced", () => {
  const base = maskedDesign()
  const replacement = { ...base.assetManifest[0], id: "replacement", sha256: "b".repeat(64), localReference: `asset:${"b".repeat(64)}` }
  const manifest = [...base.assetManifest, replacement]
  const latest = base.revisionHistory[base.revisionHistory.length - 1]
  const direct = { ...template, elements: template.elements.map(element => element.kind === "image" ? { ...element, assetId: "hero" } : element) }
  const cardLayouts = base.cardLayouts.map((card, index) => index === 0 ? { ...card, officialTemplate: direct } : card)
  const design = parseNewsletterDesignStateV2({ ...base, assetManifest: manifest, cardLayouts, revisionHistory: base.revisionHistory.map(entry => entry === latest ? { ...entry, snapshot: { ...entry.snapshot, assetManifest: manifest, cardLayouts } } : entry) })
  const changed = updateOfficialElementFrame(design, { cardIndex: 0, elementId: "foreground", patch: {}, assetId: "replacement", now })
  const element = changed.cardLayouts[0]?.officialTemplate?.elements.find(value => value.id === "foreground")
  expect(element).toMatchObject({ kind: "image", assetId: "replacement" })
  expect(element?.kind === "image" && element.mask).toBeUndefined()
  expect(changed.cardLayouts[0]?.image).toEqual(base.cardLayouts[0]?.image)
})