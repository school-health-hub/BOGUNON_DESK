import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, type NewsletterDesignStateV2 } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { applySkillMasterPreset } from "./skillMasterPreset"

const NOW = "2026-11-13T00:00:00.000Z"

function applyAllCards(design: NewsletterDesignStateV2): NewsletterDesignStateV2 {
  return Array.from({ length: 6 }, (_, index) => index + 1).reduce(
    (current, cardIndex) => applySkillMasterPreset(current, { cardIndex, now: NOW }),
    design,
  )
}

async function documentFor(title: string, action: string) {
  const project = await createNewsletterProject({
    projectId: "ns03-layout",
    title,
    now: NOW,
    topics: Array.from({ length: 6 }, (_, index) => ({
      id: `topic-${index + 1}`,
      title: index === 0 ? title : `건강 주제 ${index + 1}`,
      text: `학교생활에서 함께 확인해요\n1. ${action}\n2. ${action}\n3. ${action}\n4. ${action}`,
    })),
  })
  const initial = upgradeNewsletterDesignStateV2(
    createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }),
    NOW,
  )
  const design = applyAllCards(initial)
  return { initial, design, document: compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision }) }
}

describe("NS-03 September-master reconstruction", () => {
  it("keeps A4 layout and stored geometry unchanged while applying card layouts", async () => {
    // Given
    const { initial, design } = await documentFor("11월 건강한 학교생활", "비누로 30초 이상 꼼꼼하게 손 씻기")

    // Then
    expect(design.a4Layout).toEqual(initial.a4Layout)
    expect(design.cardLayouts.every((card) => card.editorial?.compositionPreset === "september-master")).toBe(true)
  })

  it("fits four cover previews and long Korean copy without layout issues", async () => {
    // Given
    const { document } = await documentFor(
      "감염병을 예방하는 건강한 학교생활 실천 안내",
      "교실로 돌아오기 전에 흐르는 물과 비누로 손바닥과 손가락 사이를 꼼꼼하게 씻기",
    )

    // When
    const scene = buildNewsletterScene(document)
    const cardIssues = document.issues.filter((issue) => issue.pageId.startsWith("card-") && !issue.message.includes("대표 장면"))

    // Then
    expect(cardIssues).toEqual([])
    expect(validateNewsletterScene(scene).filter((issue) => issue.pageId.startsWith("card-"))).toEqual([])
    expect(document.issues.some((issue) => issue.pageId === "card-cover" && issue.message.includes("대표 장면"))).toBe(true)
  })

  it("uses an explicit unassigned-art state instead of an abstract image placeholder", async () => {
    // Given
    const { document } = await documentFor("11월 건강한 학교생활", "비누로 30초 이상 꼼꼼하게 손 씻기")

    // When
    const scene = buildNewsletterScene(document)
    const cards = scene.pages.slice(1)

    // Then
    expect(cards.every((page) => page.layers.some((layer) => layer.kind === "text" && layer.text.includes("삽화 미지정")))).toBe(true)
    expect(cards.every((page) => page.layers.every((layer) => layer.kind !== "image" || layer.assetId !== undefined))).toBe(true)
  })
})
