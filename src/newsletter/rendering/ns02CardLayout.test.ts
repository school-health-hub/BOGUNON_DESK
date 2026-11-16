import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"

const NOW = "2026-11-13T00:00:00.000Z"

async function ns02Scene() {
  const topics = Array.from({ length: 6 }, (_, index) => ({
    id: `topic-${index + 1}`,
    title: `합성 주제 ${index + 1}`,
    text: `합성 소개 ${index + 1}\n1. 수칙 하나\n2. 수칙 둘\n3. 수칙 셋\n4. 수칙 넷`,
  }))
  const project = await createNewsletterProject({ projectId: "ns02-r1", title: "11월 합성 소식지", now: NOW, topics })
  const design = upgradeNewsletterDesignStateV2(
    createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }),
    NOW,
  )
  return buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 }))
}

describe("NS-02 card layout", () => {
  it("keeps missing optional brand art out of the cover scene", async () => {
    // Given
    const scene = await ns02Scene()
    const cover = scene.pages[1]

    // When
    const optionalPlaceholders = cover?.layers.filter(
      (layer) => layer.kind === "image" && ["mascot", "seasonal"].includes(layer.placeholderKind),
    )

    // Then
    expect(optionalPlaceholders).toEqual([])
    expect(cover?.layers.some((layer) => layer.kind === "image" && layer.placeholderKind === "cover")).toBe(true)
  })

  it("renders four cover teasers with source leads", async () => {
    // Given
    const scene = await ns02Scene()
    const cover = scene.pages[1]

    // When
    const teasers = cover?.layers.filter((layer) => layer.kind === "text" && layer.layerId.includes("card-cover-topic-")) ?? []

    // Then
    expect(teasers).toHaveLength(4)
    expect(teasers.map((layer) => layer.kind === "text" ? layer.text : "")).toEqual([
      "합성 주제 1\n합성 소개 1",
      "합성 주제 2\n합성 소개 2",
      "합성 주제 3\n합성 소개 3",
      "합성 주제 4\n합성 소개 4",
    ])
  })

  it("uses four readable action rows on every topic card", async () => {
    // Given
    const scene = await ns02Scene()

    // When
    const actionRows = scene.pages.slice(2).map((page) => page.layers.filter((layer) => layer.layerId.includes("-action-row-") && layer.kind === "text"))

    // Then
    expect(actionRows.map((rows) => rows.length)).toEqual([4, 4, 4, 4, 4, 4])
    expect(validateNewsletterScene(scene)).toEqual([])
  })
})
