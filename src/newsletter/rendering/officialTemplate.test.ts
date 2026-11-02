import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene, validateNewsletterScene } from "./renderScene"
import { attachApprovedMascot } from "./bundledMascot"
import { mascotQualityWarnings } from "./mascotQuality"

const now = "2026-11-01T07:00:00.000Z"
async function fixture() {
  const project = await createNewsletterProject({ projectId: "official-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `topic-${i}`, title: `건강 주제 ${i + 1}`, text: "함께 실천해요\n1. 비누로 30초 손 씻기\n2. 음식은 충분히 익혀 먹기\n3. 물은 끓여 마시기\n4. 아프면 보호자와 보건실에 알리기" })) })
  let design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  design = applyEditorialLayout(design, { cardIndex: 0, layoutType: "A", now })
  design = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
  return { project, design }
}
it("preserves the existing render when a V2 document is saved without an official template", async () => {
  // Given
  const { project, design } = await fixture()
  const compile = (value: typeof design) => buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design: value, designRevision: value.designRevision }))
  // When
  const reopened = parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(design)))
  // Then
  expect(compile(reopened)).toEqual(compile(design))
})
it("stores a new free composition without changing any of the six other pages", async () => {
  // Given
  const { project, design } = await fixture()
  const { applyOfficialTemplate } = await import("./officialTemplate")
  const before = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision }))
  // When
  const next = applyOfficialTemplate(design, { cardIndices: [0, 1], now })
  const document = compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision })
  const after = buildNewsletterScene(document)
  // Then
  expect([after.pages[0], ...after.pages.slice(3)]).toEqual([before.pages[0], ...before.pages.slice(3)])
  expect(validateNewsletterScene(after).filter(issue => ["card-cover", "card-topic-1"].includes(issue.pageId))).toEqual([])
  expect(next.cardLayouts[0]?.officialTemplate?.elements.some(element => element.kind === "text" && element.binding === "month")).toBe(true)
  expect(next.cardLayouts[1]?.officialTemplate?.elements.filter(element => element.kind === "image")).toHaveLength(5)
  expect(after.pages[2]?.layers.flatMap(layer => layer.kind === "text" && layer.provenance.kind === "canonical-section" ? [layer.text] : [])).toEqual(expect.arrayContaining(["비누로 30초 손 씻기", "음식은 충분히 익혀 먹기", "물은 끓여 마시기", "아프면 보호자와 보건실에 알리기"]))
  expect(parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(next)))).toEqual(next)
})

it("warns about the actual enlarged official mascot frame instead of its unused legacy frame", async () => {
  // Given
  const { project, design } = await fixture()
  const { applyOfficialTemplate, updateOfficialElementFrame } = await import("./officialTemplate")
  const applied = applyOfficialTemplate(attachApprovedMascot(design, now), { cardIndices: [0], now })
  // When
  const enlarged = updateOfficialElementFrame(applied, { cardIndex: 0, elementId: "mascot", patch: { x: 100, y: 100, width: 1000, height: 1000 }, now })
  const document = compileRenderDocument({ project, projectRevision: 1, design: enlarged, designRevision: enlarged.designRevision })
  // Then
  expect(mascotQualityWarnings(document).some(warning => warning.includes("card-cover"))).toBe(true)
})
it("provides four assignable source-image slots on an ordinary V2 topic without selecting a legacy layout", async () => {
  // Given
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "ordinary-official", canonicalProjectRevision: 1, now }), now)
  const { applyOfficialTemplate } = await import("./officialTemplate")
  expect(design.cardLayouts[1]?.editorial).toBeUndefined()
  // When
  const applied = applyOfficialTemplate(design, { cardIndices: [1], now })
  // Then
  expect(applied.cardLayouts[1]?.editorial?.moduleImages).toHaveLength(4)
  expect(applied.cardLayouts[1]?.officialTemplate?.kind).toBe("education")
})
