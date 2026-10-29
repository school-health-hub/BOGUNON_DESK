import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialA4Layout, applyEditorialLayout, restoreDesignRevision, updateA4EditorialCopy, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument } from "./renderDocument"

const now = "2026-10-30T00:00:00.000Z"
async function fixture() {
  const project = await createNewsletterProject({ projectId: "editorial-a4", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `topic-${i}`, title: `주제 ${i + 1}`, text: "실천 안내\n1. 비누로 손 씻기\n2. 손과 목 따뜻하게 하기\n3. 맨살에 대지 않기\n4. 핫팩을 떼어 놓기" })) })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  return { project, design }
}
describe("editorial A4 supplied copy", () => {
  it("prints supplied footer/source and all six card closings as editable design text", async () => {
    // Given
    const { project, design } = await fixture()
    let selected = applyEditorialA4Layout(design, { now })
    for (let i = 1; i <= 6; i += 1) {
      selected = applyEditorialLayout(selected, { cardIndex: i, layoutType: "B", now })
      const editorial = selected.cardLayouts[i]?.editorial
      if (editorial === undefined) throw new Error("fixture editorial missing")
      selected = parseNewsletterDesignStateV2(updateCardLayout(selected, { cardIndex: i, now, patch: { editorial: { ...editorial, closing: `마무리 ${i}` } } }))
    }
    const patch = { utilityText: "보건실 이용 안내\n몸이 불편하면 먼저 알려주세요.", closingText: "이번 달 한 줄 약속\n따뜻하게 입고, 안전하게 선택해요.", sourceText: "건강정보 참고: 질병관리청 | 2026.10.29 확인" }
    // When
    const changed = updateA4EditorialCopy(selected, { patch, now })
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(document.a4.utility?.text).toBe(patch.utilityText)
    expect(document.a4.closing?.text).toBe(patch.closingText)
    expect(document.a4.footer.text).toBe(patch.sourceText)
    expect(document.a4.modules.map(module => module.closing?.text)).toEqual(Array.from({ length: 6 }, (_, i) => `마무리 ${i + 1}`))
    expect(document.a4.modules.every(module => module.body.style.fontSize === 21)).toBe(true)
    expect(document.issues).toEqual([])
    expect(parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(changed))).a4Layout.brand?.sourceText).toBe(patch.sourceText)
    const restored = restoreDesignRevision(changed, { revision: selected.designRevision, now })
    if (restored.designSchemaVersion !== 2) throw new Error("fixture expected V2 restoration")
    expect(restored.a4Layout.brand?.sourceText).toBeUndefined()
  })
  it("requires explicit footer copy for the new A4 preset without changing legacy output", async () => {
    // Given
    const { project, design } = await fixture()
    // When
    const legacy = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    const changed = applyEditorialA4Layout(design, { now })
    const current = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(legacy.a4.footer.text).toContain("학교 보건소식")
    expect(current.a4.footer.text).toBe("")
    expect(current.issues.filter(issue => issue.kind === "missing-text" && issue.blockId.startsWith("a4-")).length).toBeGreaterThanOrEqual(3)
  })
})
