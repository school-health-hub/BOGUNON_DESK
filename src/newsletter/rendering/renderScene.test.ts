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
    expect(scene.pages[1]?.layers.filter((layer) => layer.layerId.includes("-topic-") && layer.kind === "text")).toHaveLength(4)
    expect(scene.pages[1]?.layers.some((layer) => layer.layerId === "card-cover-badge")).toBe(true)
    expect(scene.pages[0]?.layers.some((layer) => layer.layerId === "a4-page-a4-header-mascot")).toBe(true)
    expect(scene.pages[1]?.layers.some((layer) => layer.layerId === "card-cover-cover-mascot")).toBe(true)
    expect(scene.pages[2]?.layers.some((layer) => layer.layerId === "card-topic-1-topic-mascot-1")).toBe(true)
    expect(new Set(scene.pages[0]?.layers.filter((layer) => layer.kind === "image").map((layer) => layer.placeholderKind))).toEqual(new Set(["mascot", "seasonal", "topic-1", "topic-2", "topic-3", "topic-4", "topic-5", "topic-6"]))
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

  it("reflows a two-line Korean A4 lead without changing title or card geometry", async () => {
    // Given
    const qaText = "일교차가 큰 날에는 얇은 옷을 겹쳐 입어요.\n1. 등교 전 기온을 확인해요.\n2. 물을 자주 마셔요."
    const topics = Array.from({ length: 6 }, (_, index) => ({
      id: `topic-${index + 1}`,
      title: index === 0 ? "환절기 건강 습관 QA" : `주제 ${index + 1}`,
      text: index === 0 ? qaText : `일반 문장 ${index + 1}`,
    }))
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW, topics })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")
    const normalTopics = topics.map((topic, index) => ({ ...topic, title: `주제 ${index + 1}`, text: index === 0 ? "짧은 안내\n1. 등교 전 기온을 확인해요.\n2. 물을 자주 마셔요." : topic.text }))
    const normalProject = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW, topics: normalTopics })
    const normal = compileRenderDocument({ project: normalProject, projectRevision: 1, design, designRevision: 2 })

    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })
    const first = document.a4.modules[0]
    const normalFirst = normal.a4.modules[0]

    // Then
    expect(first?.title.text).toBe("환절기 건강 습관 QA")
    expect(first?.title.frame).toEqual(normalFirst?.title.frame)
    expect(first?.image.frame).toEqual(normalFirst?.image.frame)
    expect(document.cards.map((card) => ({ title: card.title.frame, body: card.body.frame, image: card.image.frame }))).toEqual(normal.cards.map((card) => ({ title: card.title.frame, body: card.body.frame, image: card.image.frame })))
    expect(first?.lead?.lines).toHaveLength(2)
    expect(first?.lead?.lines.join("").replace(/\s/gu, "")).toBe("일교차가큰날에는얇은옷을겹쳐입어요.")
    expect(document.issues.filter((issue) => ["overflow", "layout-collision", "clip-bounds"].includes(issue.kind))).toEqual([])
    expect(validateNewsletterScene(buildNewsletterScene(document))).toEqual([])
  })

  it("reflows a two-line Korean A4 module title without changing one-line or card geometry", async () => {
    // Given
    const longTitle = "환절기 건강 습관과 안전한 학교생활 안내"
    const topics = Array.from({ length: 6 }, (_, index) => ({
      id: `topic-${index + 1}`,
      title: index === 0 ? longTitle : `주제 ${index + 1}`,
      text: `일반 문장 ${index + 1}`,
    }))
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW, topics })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")
    const normalProject = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const normal = compileRenderDocument({ project: normalProject, projectRevision: 1, design, designRevision: 2 })

    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })
    const first = document.a4.modules[0]
    const normalFirst = normal.a4.modules[0]

    // Then
    expect(first?.title.text).toBe(longTitle)
    expect(first?.title.lines).toHaveLength(2)
    expect(first?.title.lines.join("").replace(/\s/gu, "")).toBe(longTitle.replace(/\s/gu, ""))
    expect(first?.title.frame.height).toBe(75)
    expect(first?.title.frame.x).toBe(normalFirst?.title.frame.x)
    expect(first?.title.frame.y).toBe(normalFirst?.title.frame.y)
    expect(first?.title.frame.width).toBe(normalFirst?.title.frame.width)
    expect(first?.image.frame.y).toBeGreaterThan(normalFirst?.image.frame.y ?? Number.POSITIVE_INFINITY)
    expect((first?.image.frame.y ?? 0) + (first?.image.frame.height ?? 0)).toBe((normalFirst?.image.frame.y ?? 0) + (normalFirst?.image.frame.height ?? 0))
    expect(normalFirst?.title.frame.height).toBe(48)
    expect(document.a4.modules.slice(1).map((module) => ({ title: module.title.frame, body: module.body.frame, image: module.image.frame }))).toEqual(normal.a4.modules.slice(1).map((module) => ({ title: module.title.frame, body: module.body.frame, image: module.image.frame })))
    expect(document.cards.map((card) => ({ title: card.title.frame, body: card.body.frame, image: card.image.frame }))).toEqual(normal.cards.map((card) => ({ title: card.title.frame, body: card.body.frame, image: card.image.frame })))
    expect(document.issues.filter((issue) => ["overflow", "layout-collision", "clip-bounds"].includes(issue.kind))).toEqual([])
    expect(validateNewsletterScene(buildNewsletterScene(document))).toEqual([])
  })

  it("reflows a lead after a two-line Korean A4 module title without negative frames", async () => {
    // Given
    const longTitle = "환절기 건강 습관과 안전한 학교생활 안내"
    const sourceText = "짧은 안내\n1. 등교 전 기온을 확인해요.\n2. 물을 자주 마셔요."
    const topics = Array.from({ length: 6 }, (_, index) => ({
      id: `topic-${index + 1}`,
      title: index === 0 ? longTitle : `주제 ${index + 1}`,
      text: index === 0 ? sourceText : `일반 문장 ${index + 1}`,
    }))
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW, topics })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")

    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })
    const first = document.a4.modules[0]

    // Then
    expect(first?.title.lines).toHaveLength(2)
    expect(first?.title.lines.join("").replace(/\s/gu, "")).toBe(longTitle.replace(/\s/gu, ""))
    expect(first?.lead?.lines.join("").replace(/\s/gu, "")).toBe("짧은안내")
    expect(first?.body.lines.join("").replace(/\s/gu, "")).toBe("1.등교전기온을확인해요.2.물을자주마셔요.")
    expect([first?.title.frame, first?.lead?.frame, first?.body.frame, first?.image.frame].every((frame) => frame !== undefined && frame.width >= 0 && frame.height >= 0)).toBe(true)
    expect(document.issues.filter((issue) => ["overflow", "layout-collision", "clip-bounds"].includes(issue.kind))).toEqual([])
    expect(validateNewsletterScene(buildNewsletterScene(document))).toEqual([])
  })
})
