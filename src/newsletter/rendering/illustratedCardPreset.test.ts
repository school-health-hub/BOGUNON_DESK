import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { applyIllustratedCardPreset } from "./illustratedCardPreset"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { illustratedActionScene } from "./illustratedActionScene"

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
  expect(validateNewsletterScene(scene).filter(issue => issue.pageId === "card-cover" || issue.pageId === "card-topic-1")).toEqual([])
  expect(scene.pages[2]?.layers.filter(layer => layer.layerId.includes("-organic-field"))).toHaveLength(4)
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
