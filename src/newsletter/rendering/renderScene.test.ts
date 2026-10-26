import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, newsletterSceneHash, validateNewsletterScene } from "./renderScene"
import { renderA4Svg, renderCardSvg } from "../output/svgRenderer"

const NOW = "2026-01-01T00:00:00.000Z"

describe("Newsletter common render scene", () => {
  it("keeps the legacy V1 readable but reports its historical overlaps", async () => {
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 1 })

    expect(document.cards).toHaveLength(7)
    expect(document.a4.modules).toHaveLength(6)
    expect(document.issues.some((issue) => issue.kind === "layout-collision")).toBe(true)
  })

  it("builds collision-free V2 A4 and seven-card scenes with stable provenance", async () => {
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })
    const scene = buildNewsletterScene(document)

    expect(scene.pages).toHaveLength(8)
    expect(scene.pages[1]?.layers.filter((layer) => layer.layerId.includes("-topic-") && layer.kind === "text")).toHaveLength(6)
    expect(scene.pages[1]?.layers.some((layer) => layer.layerId === "card-cover-badge")).toBe(true)
    expect(scene.pages[0]?.layers.some((layer) => layer.kind === "text" && layer.provenance.kind === "canonical-section")).toBe(true)
    expect(validateNewsletterScene(scene)).toEqual([])
    expect(document.issues).toEqual([])
    expect(newsletterSceneHash(scene)).toHaveLength(64)
  })

  it("serializes preview and export from the same ordered scene layers", async () => {
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })
    const scene = buildNewsletterScene(document)
    const a4Svg = renderA4Svg(document.a4, new Map())
    const card = document.cards[0]
    if (card === undefined) throw new Error("test card is missing")
    const cardSvg = renderCardSvg(card, new Map())

    for (const layer of scene.pages[0]?.layers ?? []) expect(a4Svg).toContain(`id="${layer.layerId}"`)
    for (const layer of scene.pages[1]?.layers ?? []) expect(cardSvg).toContain(`id="${layer.layerId}"`)
  })

  it("preserves explicit canonical lines and their source provenance without inference", async () => {
    const text = "실천 안내\n1. 비누로 30초 이상 손 씻기\n• 교실 환기하기"
    const topics = Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index + 1}`, title: `주제 ${index + 1}`, text: index === 0 ? text : `일반 문장 ${index + 1}` }))
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW, topics })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")

    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })
    const first = document.a4.modules[0]

    expect(first?.lead?.text).toBe("실천 안내")
    expect(first?.body.text).toBe("1. 비누로 30초 이상 손 씻기\n• 교실 환기하기")
    expect(first?.body.provenance).toMatchObject({ kind: "canonical-section", sourceText: text })
  })
})
