import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { upgradeNewsletterDesignStateV2, restoreDesignRevision } from "./designState"
import { applyBEditableComposition } from "./bEditableComposition"
import { updateOfficialElementFrame, updateOfficialTemplateClosing } from "./officialTemplate"
import { compileRenderDocument } from "./renderDocument"
import { buildNewsletterScene } from "./renderScene"
import { referencedDesignAssets, resolveDesignAssets } from "./assetResolution"

const now = "2026-11-01T12:00:00.000Z"
const ids = { background: "b-background", students: "b-students", props: ["b-prop-0", "b-prop-1", "b-prop-2", "b-prop-3"], season: "b-season", actions: ["b-action-0", "b-action-1", "b-action-2", "b-action-3"] } as const
async function fixture() {
  const project = await createNewsletterProject({ projectId: "b-editable", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `topic-${i}`, title: `주제 ${i}`, text: "함께 지켜요\n1. 비누로 손 씻기\n2. 음식 익히기\n3. 물 끓이기\n4. 보호자와 보건실에 알리기" })) })
  const base = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  const assetManifest = [ids.background, ids.students, ...ids.props, ids.season, ...ids.actions].map((id, index) => ({ id, sha256: index.toString(16).repeat(64), localReference: `asset:${index.toString(16).repeat(64)}`, originalName: `${id}.png`, mediaType: "image/png", approvalStatus: "approved", exportApproval: "pending" }))
  const design = parseNewsletterDesignStateV2({ ...base, assetManifest, revisionHistory: base.revisionHistory.map((entry, index) => index === base.revisionHistory.length - 1 ? { ...entry, snapshot: { ...entry.snapshot, assetManifest } } : entry) })
  return { project, design }
}
it("keeps B images independent, hides but retains brand and seasonal layers, and preserves six other scenes", async () => {
  const { project, design } = await fixture()
  const render = (selected: typeof design) => buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design: selected, designRevision: selected.designRevision }))
  const before = render(design)
  const next = applyBEditableComposition(design, { cardIndices: [0, 1], assets: ids, now })
  const after = render(next)
  expect([after.pages[0], ...after.pages.slice(3)]).toEqual([before.pages[0], ...before.pages.slice(3)])
  expect(next.canonicalProjectRevision).toBe(design.canonicalProjectRevision)
  expect(next.assetManifest).toEqual(design.assetManifest)
  expect(next.cardLayouts[0]?.officialTemplate?.elements.find(element => element.id === "mascot")).toMatchObject({ visible: false })
  expect(after.pages[1]?.layers.filter(layer => layer.kind === "image").map(layer => layer.assetId)).toEqual(expect.arrayContaining([ids.background, ids.students, ...ids.props]))
  expect(after.pages[1]?.layers.some(layer => layer.kind === "image" && layer.assetId === ids.season)).toBe(false)
  expect(after.pages[1]?.layers.flatMap(layer => layer.kind === "text" ? [layer.text] : [])).toEqual(expect.arrayContaining(["주제 0", "주제 1", "주제 2", "주제 5"]))
})
it("collects direct image references including hidden sources without losing the SHA and pending approval gate", async () => {
  const { design } = await fixture()
  const next = applyBEditableComposition(design, { cardIndices: [0, 1], assets: ids, now })
  expect(referencedDesignAssets(next, next.designRevision).map(asset => asset.id)).toEqual(expect.arrayContaining([ids.students, ids.season, ...ids.props, ...ids.actions]))
  await expect(resolveDesignAssets(next, next.designRevision, { resolve: async () => new Uint8Array([1]) })).rejects.toThrow("SHA-256")
  const pending = { ...next, assetManifest: next.assetManifest.map(asset => ({ ...asset, approvalStatus: "reference-only" })), revisionHistory: next.revisionHistory.map(entry => entry.revision === next.designRevision ? { ...entry, snapshot: { ...entry.snapshot, assetManifest: next.assetManifest.map(asset => ({ ...asset, approvalStatus: "reference-only" })) } } : entry) }
  await expect(resolveDesignAssets(parseNewsletterDesignStateV2(pending), next.designRevision)).rejects.toThrow("approval")
})
it("persists direct asset and hidden state through edit, reopen, and revision restore", async () => {
  const { design } = await fixture()
  const applied = applyBEditableComposition(design, { cardIndices: [0], assets: ids, now })
  const changed = updateOfficialElementFrame(applied, { cardIndex: 0, elementId: "students", patch: { x: 10, width: 1180 }, visible: false, assetId: ids.props[0], now })
  const reopened = parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(changed)))
  expect(reopened.cardLayouts[0]?.officialTemplate?.elements.find(element => element.id === "students")).toMatchObject({ visible: false, assetId: ids.props[0], frame: { x: 10, width: 1180 } })
  expect(parseNewsletterDesignStateV2(restoreDesignRevision(reopened, { revision: applied.designRevision, now })).cardLayouts[0]?.officialTemplate).toEqual(applied.cardLayouts[0]?.officialTemplate)
})
it("rejects direct assets absent from current and historical manifest", async () => {
  const { design } = await fixture()
  expect(() => applyBEditableComposition(design, { cardIndices: [0], assets: { ...ids, students: "missing" }, now })).toThrow("asset")
})
it("keeps direct image visibility opt-in compatible when the visibility field is absent", async () => {
  const { project, design } = await fixture()
  const applied = applyBEditableComposition(design, { cardIndices: [0], assets: ids, now })
  const cards = applied.cardLayouts.map((card, index) => index === 0 ? { ...card, officialTemplate: { ...card.officialTemplate, elements: card.officialTemplate?.elements.map(element => {
    if (element.id !== "students" || element.kind !== "image") return element
    const { visible: removed, ...rest } = element
    void removed
    return rest
  }) } } : card)
  const reopened = parseNewsletterDesignStateV2({ ...applied, cardLayouts: cards, revisionHistory: applied.revisionHistory.map(entry => entry.revision === applied.designRevision ? { ...entry, snapshot: { ...entry.snapshot, cardLayouts: cards } } : entry) })
  const scene = buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design: reopened, designRevision: reopened.designRevision }))
  expect(scene.pages[1]?.layers.some(layer => layer.kind === "image" && layer.assetId === ids.students)).toBe(true)
})
it("edits B closing text without changing the shared A4 or legacy editorial closing", async () => {
  const { project, design } = await fixture()
  const applied = applyBEditableComposition(design, { cardIndices: [0, 1], assets: ids, now, closingText: "서로 배려하고 함께 지켜요.\n건강한 11월을 응원합니다!" })
  const render = (selected: typeof design) => buildNewsletterScene(compileRenderDocument({ project, projectRevision: 1, design: selected, designRevision: selected.designRevision }))
  const before = render(applied)
  expect(before.pages[0]).toEqual(render(design).pages[0])
  const changed = updateOfficialTemplateClosing(applied, { cardIndex: 1, text: "오늘도 함께 지켜요.", now })
  expect(render(changed).pages[0]).toEqual(before.pages[0])
  expect(changed.cardLayouts[1]?.editorial?.closing).toEqual(design.cardLayouts[1]?.editorial?.closing)
  expect(parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(changed))).cardLayouts[1]?.officialTemplate?.closingText).toBe("오늘도 함께 지켜요.")
})
