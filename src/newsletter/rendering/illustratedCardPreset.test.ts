import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { applyIllustratedCardPreset } from "./illustratedCardPreset"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { illustratedActionScene } from "./illustratedActionScene"
import { ILLUSTRATED_CARD } from "./illustratedCardLayout"

it("changes only cover and selected TYPE B body when applying the illustrated preset", async () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "illustrated-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `건강 주제 ${index}`, text: "함께 실천해요\n1. 비누로 손 씻기\n2. 따뜻한 증기 가까이 가지 않기\n3. 끓인 물 식혀 마시기\n4. 아프면 보건실 방문하기" })) })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  const baseline = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision }))
  // When
  const next = applyIllustratedCardPreset(design, { cardIndex: 1, now })
  const document = compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision })
  const scene = buildNewsletterScene(document)
  // Then
  expect(next.a4Layout).toEqual(design.a4Layout)
  expect(scene.pages[0]).toEqual(baseline.pages[0])
  expect(scene.pages.slice(3)).toEqual(baseline.pages.slice(3))
  expect(document.cards[1]?.editorial?.layoutType).toBe("B")
  expect(document.cards[1]?.editorial?.modules).toHaveLength(4)
  expect(document.cards[1]?.editorial?.modules.every(module => module.action.lines.length <= 2)).toBe(true)
  expect(validateNewsletterScene(scene).filter(issue => issue.pageId === "card-cover" || issue.pageId === "card-topic-1")).toEqual([])
  expect(scene.pages[2]?.layers.filter(layer => layer.layerId.includes("-organic-field"))).toHaveLength(4)
  expect(scene.pages[1]?.layers.filter(layer => layer.layerId.includes("-preview-halo-"))).toHaveLength(4)
  expect(scene.pages[2]?.layers.filter(layer => layer.layerId.includes("-action-zone-"))).toHaveLength(4)
})

it("integrates the cover mascot with the student scene and uses four editorial topic previews", () => {
  // Given
  const { cover, previewFrames } = ILLUSTRATED_CARD
  const imageRight = cover.image.x + cover.image.width
  const mascotRight = cover.mascot.x + cover.mascot.width

  // When
  const horizontalOverlap = Math.min(imageRight, mascotRight) - Math.max(cover.image.x, cover.mascot.x)
  const verticalOverlap = Math.min(cover.image.y + cover.image.height, cover.mascot.y + cover.mascot.height) - Math.max(cover.image.y, cover.mascot.y)
  const fourthPreview = previewFrames[3]
  const previewLabel = { ...fourthPreview, y: fourthPreview.y + fourthPreview.height - 76, height: 76 }
  const labelOverlap = Math.min(cover.mascot.x + cover.mascot.width, previewLabel.x + previewLabel.width) - Math.max(cover.mascot.x, previewLabel.x)
  const labelVerticalOverlap = Math.min(cover.mascot.y + cover.mascot.height, previewLabel.y + previewLabel.height) - Math.max(cover.mascot.y, previewLabel.y)
  const fourthAction = ILLUSTRATED_CARD.actionFrames[3]
  const actionVerticalOverlap = Math.min(ILLUSTRATED_CARD.body.mascot.y + ILLUSTRATED_CARD.body.mascot.height, fourthAction.y + fourthAction.height) - Math.max(ILLUSTRATED_CARD.body.mascot.y, fourthAction.y)
  const closingOverlap = Math.min(ILLUSTRATED_CARD.body.mascot.x + ILLUSTRATED_CARD.body.mascot.width, ILLUSTRATED_CARD.body.closing.x + ILLUSTRATED_CARD.body.closing.width) - Math.max(ILLUSTRATED_CARD.body.mascot.x, ILLUSTRATED_CARD.body.closing.x)

  // Then
  expect(previewFrames).toHaveLength(4)
  expect(previewFrames.some(frame => Number(frame.width) !== Number(frame.height))).toBe(true)
  expect(previewFrames.every(frame => frame.width >= 230 && frame.height >= 190)).toBe(true)
  expect(cover.image.width * cover.image.height).toBeGreaterThan(560_000)
  expect(horizontalOverlap).toBeGreaterThan(100)
  expect(verticalOverlap).toBeGreaterThan(100)
  expect(labelOverlap <= 0 || labelVerticalOverlap <= 0).toBe(true)
  expect(actionVerticalOverlap).toBeLessThanOrEqual(0)
  expect(closingOverlap).toBeLessThanOrEqual(0)
  expect(ILLUSTRATED_CARD.body.mascot.y + ILLUSTRATED_CARD.body.mascot.height).toBeLessThanOrEqual(1140)
})

it("uses a neutral educational book for an unknown action instead of inventing a health scene", () => {
  // Given
  const frame = { x: 100, y: 100, width: 145, height: 145 }
  // When
  const layers = illustratedActionScene("unknown", "새로운 실천 문구", frame, frame)
  // Then
  expect(layers.some(layer => layer.layerId === "unknown-book")).toBe(true)
  expect(layers.some(layer => layer.layerId.includes("clinic"))).toBe(false)
})

it.each([
  ["겨울 장염 예방", "soap"], ["추위와 건강", "scarf"], ["항생제 바로 알기", "pill"], ["카페인 줄이기", "cup"],
  ["식사 전·화장실 후 비누로 30초 손 씻기", "soap"], ["음식은 속까지 충분히 익혀 먹기", "pot"], ["물은 끓여 마시기", "boiled-steam"], ["구토·설사가 있으면 보호자·보건실에 알리기", "door"],
] as const)("selects meaningful filled artwork for %s", (copy, expected) => {
  // Given
  const frame = { x: 100, y: 100, width: 145, height: 145 }
  // When
  const layers = illustratedActionScene("scene", copy, frame, frame)
  // Then
  const field = layers.find(layer => layer.layerId === "scene-organic-field")
  const artwork = layers.find(layer => layer.layerId === `scene-${expected}`)
  expect(artwork).toBeDefined()
  expect(artwork?.zOrder).toBeGreaterThan(field?.zOrder ?? 0)
})

it("preserves four approved module assets when applying the illustrated preset", async () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "illustrated-assets", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `건강 주제 ${index}`, text: "함께 실천해요\n1. 비누로 손 씻기\n2. 음식 익혀 먹기\n3. 물 끓여 마시기\n4. 아프면 알리기" })) })
  const upgraded = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  const moduleImages = Array.from({ length: 4 }, (_, index) => ({ slotId: `action-${index + 1}`, assetId: `action-asset-${index + 1}`, frame: { x: 1, y: 1, width: 1, height: 1 }, fit: "contain" as const }))
  const withAssets = parseNewsletterDesignStateV2(updateCardLayout(upgraded, { cardIndex: 1, now, patch: { editorial: { layoutType: "B", studentComposition: "mixed", season: "autumn", moduleImages } } }))

  // When
  const applied = applyIllustratedCardPreset(withAssets, { cardIndex: 1, now })

  // Then
  expect(applied.cardLayouts[1]?.editorial?.moduleImages?.map((image) => image.assetId)).toEqual(["action-asset-1", "action-asset-2", "action-asset-3", "action-asset-4"])
  expect(applied.cardLayouts[1]?.editorial?.moduleImages?.every((image) => image.frame.width === 145 && image.frame.height === 145)).toBe(true)
})

it("renders approved illustrated module assets instead of vector fallbacks", async () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "illustrated-scene-assets", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `건강 주제 ${index}`, text: "함께 실천해요\n1. 비누로 손 씻기\n2. 음식 익혀 먹기\n3. 물 끓여 마시기\n4. 아프면 알리기" })) })
  const upgraded = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  const manifest = Array.from({ length: 4 }, (_, index) => ({ id: `action-asset-${index + 1}`, sha256: String(index + 1).repeat(64), mediaType: "image/png" as const, approvalStatus: "approved" as const, exportApproval: "approved" as const, originalName: `action-${index + 1}.png`, localReference: `asset:${String(index + 1).repeat(64)}`, registry: { classification: "AI_GENERATED" as const, purpose: "illustration" as const, usageScope: "newsletter-output" as const } }))
  const withManifest = parseNewsletterDesignStateV2({ ...upgraded, assetManifest: manifest, revisionHistory: upgraded.revisionHistory.map((entry, index, entries) => index === entries.length - 1 && entry.snapshotVersion === 2 ? { ...entry, snapshot: { ...entry.snapshot, assetManifest: manifest } } : entry) })
  const moduleImages = Array.from({ length: 4 }, (_, index) => ({ slotId: `action-${index + 1}`, assetId: `action-asset-${index + 1}`, frame: { x: 1, y: 1, width: 1, height: 1 }, fit: "contain" as const }))
  const withAssets = parseNewsletterDesignStateV2(updateCardLayout(withManifest, { cardIndex: 1, now, patch: { editorial: { layoutType: "B", studentComposition: "mixed", season: "autumn", moduleImages } } }))
  const applied = applyIllustratedCardPreset(withAssets, { cardIndex: 1, now })

  // When
  const document = compileRenderDocument({ project, projectRevision: 1, design: applied, designRevision: applied.designRevision })
  const page = buildNewsletterScene(document).pages[2]

  // Then
  expect(page?.layers.filter((layer) => layer.kind === "image" && layer.layerId.includes("action-")).map((layer) => layer.kind === "image" ? layer.assetId : undefined)).toEqual(["action-asset-1", "action-asset-2", "action-asset-3", "action-asset-4"])
  expect(page?.layers.some((layer) => layer.layerId.includes("action-scene"))).toBe(false)
  expect(new Set(page?.layers.map((layer) => layer.layerId)).size).toBe(page?.layers.length)
})
