import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout, restoreDesignRevision, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { applyEditorialVisualFinish } from "./editorialVisualFinish"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { compileRenderDocument } from "./renderDocument"

it("finishes only the three selected A/B/C cards and restores the preceding revision", async () => {
  // Given
  const now = "2026-11-01T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "finish-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `주제 ${index}`, text: "함께 실천해요\n1. 비누로 손 씻기\n2. 음식은 충분히 익혀 먹기\n3. 물은 끓여 마시기\n4. 아프면 보호자와 보건실에 알리기" })) })
  let design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  for (const [cardIndex, layoutType] of [[0, "A"], [1, "B"], [2, "C"]] as const) {
    design = applyEditorialLayout(design, { cardIndex, layoutType, now })
    const editorial = design.cardLayouts[cardIndex]?.editorial
    if (editorial === undefined) throw new Error("missing editorial fixture")
    design = parseNewsletterDesignStateV2(updateCardLayout(design, { cardIndex, now, patch: { editorial: { ...editorial, moduleImages: Array.from({ length: 4 }, (_, index) => ({ slotId: `card-${cardIndex}-image-${index}`, fit: "contain", frame: { x: 100, y: 400, width: 100, height: 100 } })) } } }))
  }
  const original = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision }))
  // When
  const next = applyEditorialVisualFinish(design, { cardIndices: [0, 1, 2], now })
  const document = compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision })
  const scene = buildNewsletterScene(document)
  // Then
  expect(scene.pages[0]).toEqual(original.pages[0])
  expect(scene.pages.slice(4)).toEqual(original.pages.slice(4))
  expect(next.cardLayouts.slice(0, 3).map(card => card.editorial?.layoutType)).toEqual(["A", "B", "C"])
  expect(next.cardLayouts[1]?.editorial?.moduleImages?.every(image => image.frame.width === 472 && image.frame.height === 225)).toBe(true)
  expect(next.cardLayouts[2]?.editorial?.moduleImages?.every(image => image.frame.width === 240 && image.frame.height === 180)).toBe(true)
  expect(validateNewsletterScene(scene).filter(issue => ["card-cover", "card-topic-1", "card-topic-2"].includes(issue.pageId))).toEqual([])
  expect(document.cards[1]?.editorial?.modules.map(module => module.action.text)).toEqual(["비누로 손 씻기", "음식은 충분히 익혀 먹기", "물은 끓여 마시기", "아프면 보호자와 보건실에 알리기"])
  expect(restoreDesignRevision(next, { revision: design.designRevision, now }).cardLayouts).toEqual(design.cardLayouts)
})

it("keeps a legacy design untouched until the explicit action is invoked", () => {
  // Given
  const now = "2026-11-01T00:00:00.000Z"
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "finish-test", canonicalProjectRevision: 1, now }), now)
  // When / Then
  expect(() => applyEditorialVisualFinish(design, { cardIndices: [1], now })).toThrow("기존 TYPE A/B/C")
  expect(design.cardLayouts.every(card => card.editorial?.visualFinish === undefined)).toBe(true)
})

it("rejects imported TYPE D visual-finish flags in current state and snapshots", () => {
  // Given
  const now = "2026-11-01T00:00:00.000Z"
  const design = applyEditorialLayout(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "finish-test", canonicalProjectRevision: 1, now }), now), { cardIndex: 1, layoutType: "D", now })
  const cards = design.cardLayouts.map((card, index) => index === 1 && card.editorial !== undefined ? { ...card, editorial: { ...card.editorial, visualFinish: true } } : card)
  const imported = { ...design, cardLayouts: cards, revisionHistory: design.revisionHistory.map(entry => entry.revision === design.designRevision ? { ...entry, snapshot: { ...entry.snapshot, cardLayouts: cards } } : entry) }
  // When / Then
  expect(() => parseNewsletterDesignStateV2(imported)).toThrow("visual finish requires TYPE A, B, or C")
  expect(() => parseNewsletterDesignStateV2({ ...imported, cardLayouts: design.cardLayouts })).toThrow("visual finish requires TYPE A, B, or C")
})
