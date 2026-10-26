import { describe, expect, it } from "vitest"
import { applyUserEdit } from "../editing"
import { canonicalJson, semanticHashSync } from "../hash"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { restoreDesignRevision, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { RenderAssetNotApprovedError, compileRenderDocument } from "./renderDocument"

const NOW = "2026-01-01T00:00:00.000Z"

describe("Newsletter render document", () => {
  it("compiles one A4 page and exactly seven cards from the selected canonical revision", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "9월 보건소식", now: NOW })
    const edited = await applyUserEdit(project, { topicId: project.topics[0]?.id ?? "missing", text: "사용자가 고친 실제 문구", now: "2026-01-02T00:00:00.000Z" })
    const design = createNewsletterDesignState({ projectId: edited.projectId, canonicalProjectRevision: edited.projectRevision, now: NOW })

    // When
    const document = compileRenderDocument({ project: edited, projectRevision: edited.projectRevision, design, designRevision: design.designRevision })

    // Then
    expect(document.a4.modules).toHaveLength(6)
    expect(document.cards).toHaveLength(7)
    expect(document.cards[1]?.body.text).toBe("사용자가 고친 실제 문구")
  })

  it("keeps canonical copy and non-target cards unchanged after a card-only edit", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 소식지", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: project.projectRevision, now: NOW })
    const before = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 1 })
    const canonicalBefore = canonicalJson(project.canonicalCopy)

    // When
    const changed = updateCardLayout(design, { cardIndex: 2, patch: { background: "#fff4dc" }, now: "2026-01-02T00:00:00.000Z" })
    const after = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: 2 })

    // Then
    expect(canonicalJson(project.canonicalCopy)).toBe(canonicalBefore)
    expect(after.cards.map((card) => semanticHashSync(card))).toEqual(before.cards.map((card, index) => index === 2 ? semanticHashSync(after.cards[index]) : semanticHashSync(card)))
    expect(restoreDesignRevision(changed, { revision: 1, now: "2026-01-03T00:00:00.000Z" }).cardLayouts[2]).toEqual(design.cardLayouts[2])
  })

  it("reports overflow instead of truncating long Korean and mixed text", async () => {
    // Given
    const longText = "응급상황에서 반드시 기억해야 하는 아주 긴 한글 제목 ABC-123과 필수 보건정보 ".repeat(18)
    const project = await createNewsletterProject({ projectId: "project-1", title: longText, now: NOW, topics: ["가", "나", "다", "라", "마", "바"].map((title, index) => ({ id: `topic-${index + 1}`, title: `${longText}${title}`, text: longText })) })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })

    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 1 })

    // Then
    expect(document.issues.some((issue) => issue.kind === "overflow")).toBe(true)
    expect(document.cards[1]?.body.text).toContain("필수 보건정보")
    expect(document.cards[1]?.body.text.endsWith("…")).toBe(false)
  })

  it("blocks a referenced asset until its approval status is approved", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 소식지", now: NOW })
    const base = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const firstCard = base.cardLayouts[0]
    if (firstCard === undefined) throw new Error("test fixture has no cover card")
    const design = parseWithUnapprovedAsset(base, firstCard)

    // When / Then
    expect(() => compileRenderDocument({ project, projectRevision: 1, design, designRevision: 1 })).toThrow(RenderAssetNotApprovedError)
  })

  it("preserves one to four explicit actions and changes only their presentation markers", async () => {
    const source = "실천 안내\n1. 물 자주 마시기\n2. 손 씻기\n3. 충분히 자기\n4. 아프면 알리기"
    const topics = Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index + 1}`, title: `주제 ${index + 1}`, text: index === 0 ? source : `일반 문장 ${index + 1}` }))
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 소식지", topics, now: NOW })
    const v2 = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), "2026-01-02T00:00:00.000Z")
    const marked = updateCardLayout(v2, { cardIndex: 1, patch: { listMarkerStyle: "check" }, now: "2026-01-03T00:00:00.000Z" })
    const document = compileRenderDocument({ project, projectRevision: 1, design: marked, designRevision: 3 })

    expect(document.cards[1]?.lead?.text).toBe("실천 안내")
    expect(document.cards[1]?.body.text).toBe("✓ 물 자주 마시기\n✓ 손 씻기\n✓ 충분히 자기\n✓ 아프면 알리기")
    expect(document.cards[1]?.body.provenance).toMatchObject({ kind: "canonical-section", sourceText: source })
  })
})

function parseWithUnapprovedAsset(
  design: ReturnType<typeof createNewsletterDesignState>,
  firstCard: ReturnType<typeof createNewsletterDesignState>["cardLayouts"][number],
): ReturnType<typeof createNewsletterDesignState> {
  return {
    ...design,
    assetManifest: [{ id: "asset-1", sha256: "a".repeat(64), mediaType: "image/png", approvalStatus: "reference-only", originalName: "reference.png" }],
    cardLayouts: [{ ...firstCard, image: { ...firstCard.image, assetId: "asset-1" } }, ...design.cardLayouts.slice(1)],
    revisionHistory: [{ ...design.revisionHistory[0], snapshot: { ...design.revisionHistory[0]?.snapshot, cardLayouts: [{ ...firstCard, image: { ...firstCard.image, assetId: "asset-1" } }, ...design.cardLayouts.slice(1)], assetManifest: [{ id: "asset-1", sha256: "a".repeat(64), mediaType: "image/png", approvalStatus: "reference-only", originalName: "reference.png" }] } }],
  }
}
