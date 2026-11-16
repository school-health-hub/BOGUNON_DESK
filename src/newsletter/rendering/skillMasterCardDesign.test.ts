import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { SEPTEMBER_INNER_TEMPLATE, SEPTEMBER_INNER_TOKENS, septemberInnerActionStyle, septemberInnerTitleStyle } from "./skillMasterCardDesign"
import { applySkillMasterPreset } from "./skillMasterPreset"

const NOW = "2026-11-16T12:00:00.000Z"
const actions = [
  "식사 전과 화장실 이용 후 비누로 손 씻기",
  "기침이나 재채기를 할 때 휴지나 옷소매로 입과 코 가리기",
  "사용한 휴지는 바로 휴지통에 버리고 손 씻기",
  "발열·기침 등 몸 상태가 평소와 다르면 보호자나 보건교사에게 알리기",
] as const

async function fixture(title = "손 위생과 기침 예절") {
  const project = await createNewsletterProject({ projectId: "ns13-card-design", title: "2026년 11월 보건소식지", now: NOW, topics: Array.from({ length: 6 }, (_, index) => ({ id: `topic-${index + 1}`, title: index === 0 ? title : `건강 주제 ${index + 2}`, text: ["교실과 공용 공간에서 함께 지킬 위생 습관을 알아봅니다.", ...actions.map((action, actionIndex) => `${actionIndex + 1}. ${action}`)].join("\n") })) })
  const initial = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW, issueLabel: "2026년 11월" }), NOW)
  return { project, design: applySkillMasterPreset(initial, { cardIndex: 1, now: NOW }) }
}

describe("measured September inner-card template", () => {
  it("compiles the reference-derived hierarchy without card-grid variants", async () => {
    const { project, design } = await fixture()
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    const page = document.cards[1]
    expect(page?.title.frame).toEqual(SEPTEMBER_INNER_TEMPLATE.title)
    expect(page?.title.style).toMatchObject(SEPTEMBER_INNER_TOKENS.type.title)
    expect(page?.image.frame).toEqual(SEPTEMBER_INNER_TEMPLATE.image)
    expect(page?.editorial?.modules.map(module => module.frame)).toEqual(SEPTEMBER_INNER_TEMPLATE.actions)
    expect(validateNewsletterScene(buildNewsletterScene(document)).filter(issue => issue.pageId === "card-topic-1")).toEqual([])
  })

  it("keeps long titles readable without shrinking body copy", async () => {
    const title = "감염병을 예방하는 건강한 학교생활 실천 안내"
    const { project, design } = await fixture(title)
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    expect(document.cards[1]?.title.style).toMatchObject(septemberInnerTitleStyle(title))
    expect(document.cards[1]?.editorial?.modules.map(module => module.action.style.fontSize)).toEqual(actions.map(action => septemberInnerActionStyle(action).fontSize))
    expect(septemberInnerActionStyle(actions[1]).fontSize).toBe(25)
  })

  it("exposes four independent mini-illustration slots", async () => {
    const { project, design } = await fixture()
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    expect(document.cards[1]?.editorial?.modules).toHaveLength(4)
    expect(SEPTEMBER_INNER_TEMPLATE.miniArt).toHaveLength(4)
  })
})
