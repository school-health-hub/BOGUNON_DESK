import { expect, it } from "vitest"
import { createNewsletterDesignState } from "./designSchema"
import { applyEditorialLayout, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { applySkillMasterPreset } from "./skillMasterPreset"
import { createNewsletterProject } from "../project"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { renderNewsletterSceneSvg } from "../output/svgRenderer"

it("changes only the A4, cover and selected topic when applying the master", () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "master-test", canonicalProjectRevision: 1, now }), now)
  // When
  const next = applySkillMasterPreset(design, { cardIndex: 1, now })
  // Then
  expect(next.cardLayouts.slice(2)).toEqual(design.cardLayouts.slice(2))
  expect(next.cardLayouts[1]?.editorial?.compositionPreset).toBe("september-master")
  expect(next.cardLayouts[0]?.image.edgePolicy).toBe("none")
  expect(next.a4Layout.modules.every(module => module.image.edgePolicy !== undefined)).toBe(true)
})

it.each(["B", "C", "D"] as const)("leaves the master when choosing extension %s", (layoutType) => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "master-test", canonicalProjectRevision: 1, now }), now)
  const master = applySkillMasterPreset(design, { cardIndex: 1, now })
  // When
  const next = applyEditorialLayout(master, { cardIndex: 1, layoutType, now })
  // Then
  expect(next.cardLayouts[1]?.editorial?.compositionPreset).toBeUndefined()
  expect(next.cardLayouts[1]?.editorial?.layoutType).toBe(layoutType)
})

it.each([3, 5])("blocks master output when the canonical source has %s actions", async (count) => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "master-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `주제 ${index}`, text: Array.from({ length: count }, (_, action) => `${action + 1}. 실천 행동 ${action + 1}`).join("\n") })) })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  const next = applySkillMasterPreset(design, { cardIndex: 1, now })
  // When
  const document = compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision })
  // Then
  expect(document.issues.some(issue => issue.pageId === "card-topic-1" && issue.message.includes("정확히 4개"))).toBe(true)
})

it("removes unused extension illustration references when selecting the master", () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "master-test", canonicalProjectRevision: 1, now }), now)
  const extension = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
  const editorial = extension.cardLayouts[1]?.editorial
  if (editorial === undefined) throw new Error("missing extension")
  const withImages = updateCardLayout(extension, { cardIndex: 1, now, patch: { editorial: { ...editorial, moduleImages: Array.from({ length: 4 }, (_, index) => ({ slotId: `module-${index}`, assetId: "unused-unapproved", frame: { x: 100, y: 400, width: 100, height: 100 }, fit: "contain" })) } } })
  if (withImages.designSchemaVersion !== 2) throw new Error("missing V2")
  // When
  const next = applySkillMasterPreset(withImages, { cardIndex: 1, now })
  // Then
  expect(next.cardLayouts[1]?.editorial?.moduleImages).toBeUndefined()
  expect(withImages.cardLayouts[1]?.editorial?.moduleImages?.[0]?.assetId).toBe("unused-unapproved")
})

it("keeps five body Scenes identical and places master content within nonoverlapping bounds", async () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "master-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index}`, title: `건강 주제 ${index}`, text: "건강한 학교생활의 시작!\n1. 비누로 30초 이상 손 씻기\n2. 기침할 때 옷소매로 가리기\n3. 몸이 아프면 바로 알리기\n4. 교실 환기 자주 하기" })) })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  const baseline = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision }))
  // When
  const next = applySkillMasterPreset(design, { cardIndex: 1, now })
  const scene = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision }))
  // Then
  expect(scene.pages.slice(3)).toEqual(baseline.pages.slice(3))
  expect(validateNewsletterScene(scene).filter(issue => issue.pageId === "card-topic-1" || issue.pageId === "card-cover")).toEqual([])
  const body = scene.pages[2]
  if (body === undefined) throw new Error("missing body scene")
  const background = body.layers.find(layer => layer.layerId.endsWith("-background"))
  const season = body.layers.find(layer => layer.layerId.includes("-season-"))
  expect(background?.zOrder).toBeLessThan(season?.zOrder ?? 0)
  const svg = renderNewsletterSceneSvg(body, new Map())
  expect(svg).toContain("master-main-art")
  expect(svg).not.toContain("clip-card-topic-1-topic-image-1")
})
