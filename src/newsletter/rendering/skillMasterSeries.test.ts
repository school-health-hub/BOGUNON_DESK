import { describe, expect, it } from "vitest"
import { layoutText } from "./typography"
import { SEPTEMBER_INNER_TEMPLATE, septemberInnerTitleStyle, septemberActionHighlights } from "./skillMasterCardDesign"
import { educationArtForAction, educationArtLayers } from "./skillMasterEducationArt"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { applySkillMasterPreset } from "./skillMasterPreset"
import { compileRenderDocument } from "./renderDocument"
import { buildCardScene } from "./renderScene"
import { ns09ActionArtLayers } from "./ns09ActionArt"

describe("November review series", () => {
  it.each(["손 위생과 기침 예절", "추워지는 날씨, 안전한 학교생활", "나의 생활 리듬 점검", "시험 기간, 마음 돌보기", "급식 시간, 건강한 식사 습관", "몸과 경계를 존중하기"])("fits the editable title: %s", title => {
    const style = { ...septemberInnerTitleStyle(title), fontFamily: "Pretendard" as const, color: "#061E4A", align: "center" as const }
    expect(layoutText(title, style, SEPTEMBER_INNER_TEMPLATE.title).overflow).toBe(false)
  })
  it("maps action meanings to distinct artwork and leaves unknown actions unresolved", () => {
    expect(educationArtForAction("먼저 동의 구하기")).toBe("consent")
    expect(educationArtForAction("사적인 사진을 공유하지 않기")).toBe("privacy")
    expect(educationArtForAction("휴대전화 사용 줄이기")).toBe("phone-rest")
    expect(educationArtForAction("알 수 없는 교육 주제")).toBeUndefined()
    const frame = { x: 0, y: 0, width: 120, height: 120 }
    expect(educationArtLayers("consent", "consent", frame)).not.toEqual(educationArtLayers("privacy", "privacy", frame))
  })
  it("highlights actions rather than symptoms", () => {
    expect(septemberActionHighlights("발열·기침이 있으면 보건교사에게 알리기")).toEqual(["알리기"])
    expect(septemberActionHighlights("천천히 호흡하기")).toEqual(["호흡하기"])
  })
  it("keeps missing main illustrations explicit instead of repeating vector students", async () => {
    const now = "2026-11-16T14:00:00.000Z"
    const titles = ["시험 기간, 마음 돌보기", "급식 시간, 건강한 식사 습관", "몸과 경계를 존중하기"]
    const project = await createNewsletterProject({ projectId: "ns16b-main-policy", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, title: titles[i % 3] ?? "건강", text: "시험과 일정에 관한 마음을 표현하고 도움을 요청하는 방법을 알아봅니다.\n1. 오늘의 기분을 그림으로 표현하기\n2. 해야 할 일을 작은 단위로 나누기\n3. 친구의 고민을 들어주기\n4. 보호자에게 도움 요청하기" })) })
    let design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
    for (let i = 1; i <= 3; i += 1) design = applySkillMasterPreset(design, { cardIndex: i, now })
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    for (const page of document.cards.slice(1, 4)) {
      const scene = buildCardScene(page)
      expect(scene.layers.some(layer => layer.layerId.endsWith("-art-unassigned-label"))).toBe(true)
      expect(scene.layers.some(layer => layer.layerId.includes("-local-main-"))).toBe(false)
      const lead = page.lead
      expect(lead).toBeDefined()
      if (lead !== undefined) expect(layoutText(lead.text, lead.style, lead.frame).overflow).toBe(false)
    }
  })
  it("does not guess unfamiliar NS09 action artwork", () => {
    expect(ns09ActionArtLayers("알 수 없는 교육 주제", "unknown", { x: 0, y: 0, width: 100, height: 100 })).toBeUndefined()
  })
})
