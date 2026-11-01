import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { canonicalJson } from "../hash"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout, restoreDesignRevision, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { compileRenderDocument, RenderAssetNotApprovedError } from "./renderDocument"
import { buildNewsletterScene } from "./renderScene"
import { assetExportPending, referencedDesignAssets, resolveDesignAssets } from "./assetResolution"
import { attachApprovedMascot, OTTER_ASSET_ID } from "./bundledMascot"
import { editorialFrames } from "./editorialLayout"

const now = "2026-10-30T00:00:00.000Z"
async function fixture(count = 4, topicTitle?: string) {
  const project = await createNewsletterProject({ projectId: "editorial-test", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `topic-${i + 1}`, title: topicTitle ?? `주제 ${i + 1}`, text: "실천하는 건강생활\n" + Array.from({ length: count }, (_, n) => `${n + 1}. 행동 ${n + 1}을 함께 실천해요`).join("\n") })) })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  return { project, design }
}
describe("editorial monthly layouts", () => {
  it.each(["A", "B", "C", "D"] as const)("compiles type %s into the shared Scene without changing canonical content", async layoutType => {
    // Given
    const { project, design } = await fixture()
    const canonical = canonicalJson(project)
    const cardIndex = layoutType === "A" ? 0 : 1
    // When
    const changed = applyEditorialLayout(design, { cardIndex, layoutType, now })
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    const scene = buildNewsletterScene(document)
    // Then
    expect(scene.pages).toHaveLength(8)
    expect(document.cards[cardIndex]?.editorial?.layoutType).toBe(layoutType)
    expect(scene.pages[cardIndex + 1]?.layers.some(layer => layer.layerId.includes("editorial"))).toBe(true)
    if (layoutType === "B" || layoutType === "C") expect(scene.pages[cardIndex + 1]?.layers.filter(layer => layer.kind === "path").length).toBeGreaterThanOrEqual(3)
    expect(document.issues.filter(issue => !issue.message.includes("대표 장면"))).toEqual([])
    expect(canonicalJson(project)).toBe(canonical)
    expect(parseNewsletterDesignStateV2(changed).cardLayouts[cardIndex]?.editorial?.layoutType).toBe(layoutType)
    expect(restoreDesignRevision(changed, { revision: 2, now }).cardLayouts).toEqual(design.cardLayouts)
  })
  it("reports unavailable four-module content without inventing extra rules", async () => {
    // Given
    const { project, design } = await fixture(3)
    const changed = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(document.issues.some(issue => issue.message.includes("4개"))).toBe(true)
    expect(document.cards[1]?.editorial?.modules).toHaveLength(3)
  })
  it("checks additional module image approval before resolving or rendering it", async () => {
    // Given
    const { project, design } = await fixture()
    const selected = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
    const editorial = selected.cardLayouts[1]?.editorial
    if (editorial === undefined) throw new Error("fixture editorial missing")
    const changed = updateCardLayout(selected, { cardIndex: 1, now, patch: { editorial: { ...editorial, moduleImages: Array.from({ length: 4 }, (_, i) => ({ slotId: `module-${i}`, frame: { x: 100, y: 400, width: 200, height: 200 }, fit: "contain", assetId: "unknown-asset" })) } } })
    // When / Then
    expect(() => compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })).toThrow(RenderAssetNotApprovedError)
    expect(() => referencedDesignAssets(changed, changed.designRevision)).toThrow(/manifest entry is missing/)
  })
  it("blocks a cover with no scene for the explicitly selected student composition", async () => {
    // Given
    const { project, design } = await fixture()
    const changed = applyEditorialLayout(design, { cardIndex: 0, layoutType: "A", now })
    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(document.issues.some(issue => issue.message.includes("대표 장면"))).toBe(true)
  })
  it("verifies SHA and pending publication policy for an asset used only by an editorial module", async () => {
    // Given
    const { design } = await fixture()
    const selected = applyEditorialLayout(design, { cardIndex: 2, layoutType: "B", now })
    const editorial = selected.cardLayouts[2]?.editorial
    if (editorial === undefined) throw new Error("fixture editorial missing")
    const changed = updateCardLayout(selected, { cardIndex: 2, now, patch: { editorial: { ...editorial, moduleImages: Array.from({ length: 4 }, (_, i) => ({ slotId: `only-module-${i}`, frame: { x: 100, y: 400, width: 200, height: 200 }, fit: "contain", ...(i === 2 ? { assetId: "module-only" } : {}) })) } } })
    const asset = { id: "module-only", sha256: "a".repeat(64), mediaType: "image/png", approvalStatus: "approved", exportApproval: "pending", localReference: `asset:${"a".repeat(64)}`, originalName: "module.png", registry: { classification: "AI_GENERATED", purpose: "illustration", usageScope: "newsletter-output" } }
    const bound = parseNewsletterDesignStateV2({ ...changed, assetManifest: [asset], revisionHistory: changed.revisionHistory.map(entry => entry.revision === changed.designRevision ? { ...entry, snapshot: { ...entry.snapshot, assetManifest: [asset] } } : entry) })
    // When / Then
    expect(referencedDesignAssets(bound, bound.designRevision).map(item => item.id)).toEqual(["module-only"])
    expect(referencedDesignAssets(bound, bound.designRevision).every(assetExportPending)).toBe(true)
    await expect(resolveDesignAssets(bound, bound.designRevision, { resolve: async () => new Uint8Array([1, 2, 3]) })).rejects.toThrow(/SHA-256/)
  })
  it("restores legacy geometry after clearing editorial layout while preserving selected assets", async () => {
    // Given
    const { project, design } = await fixture()
    const branded = attachApprovedMascot(design, now)
    const selected = applyEditorialLayout(branded, { cardIndex: 1, layoutType: "B", now })
    const imageSelected = updateCardLayout(selected, { cardIndex: 1, now, patch: { image: { assetId: OTTER_ASSET_ID } } })
    // When
    const legacy = updateCardLayout(imageSelected, { cardIndex: 1, now, patch: { editorial: null } })
    const document = compileRenderDocument({ project, projectRevision: 1, design: legacy, designRevision: legacy.designRevision })
    // Then
    expect(legacy.cardLayouts[1]?.titleFrame).toEqual(branded.cardLayouts[1]?.titleFrame)
    expect(legacy.cardLayouts[1]?.image.assetId).toBe(OTTER_ASSET_ID)
    expect(document.issues).toEqual([])
  })
  it.each(["C", "D"] as const)("remaps bound module frames when switching B to %s", async layoutType => {
    // Given
    const { project, design } = await fixture()
    const branded = attachApprovedMascot(design, now)
    const selected = applyEditorialLayout(branded, { cardIndex: 1, layoutType: "B", now })
    const editorial = selected.cardLayouts[1]?.editorial
    if (editorial === undefined) throw new Error("fixture editorial missing")
    const bound = updateCardLayout(selected, { cardIndex: 1, now, patch: { editorial: { ...editorial, moduleImages: editorialFrames("B").moduleImageFrames.map((frame, i) => ({ slotId: `bound-${i}`, assetId: OTTER_ASSET_ID, fit: "contain", frame })) } } })
    if (bound.designSchemaVersion !== 2) throw new Error("fixture expected V2")
    // When
    const changed = applyEditorialLayout(bound, { cardIndex: 1, layoutType, now })
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(changed.cardLayouts[1]?.editorial?.moduleImages?.map(image => image.frame)).toEqual(editorialFrames(layoutType).moduleImageFrames)
    expect(changed.cardLayouts[1]?.editorial?.moduleImages?.every(image => image.assetId === OTTER_ASSET_ID)).toBe(true)
    expect(document.issues).toEqual([])
  })
  it("rejects imported cover anatomy on a topic card instead of hiding its four actions", async () => {
    // Given
    const { design } = await fixture()
    const selected = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
    const editorial = selected.cardLayouts[1]?.editorial
    if (editorial === undefined) throw new Error("fixture editorial missing")
    // When / Then
    expect(() => updateCardLayout(selected, { cardIndex: 1, now, patch: { editorial: { ...editorial, layoutType: "A" } } })).toThrow()
  })
  it("honors an explicitly edited lead frame instead of resetting it during compilation", async () => {
    // Given
    const { project, design } = await fixture()
    const selected = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
    const changed = updateCardLayout(selected, { cardIndex: 1, now, patch: { leadFrame: { y: 320 } } })
    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(document.cards[1]?.lead?.frame.y).toBe(320)
  })
  it("identifies user-authored design text separately from canonical health rules", async () => {
    // Given
    const { project, design } = await fixture()
    const selected = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
    const editorial = selected.cardLayouts[1]?.editorial
    if (editorial === undefined) throw new Error("fixture editorial missing")
    const changed = updateCardLayout(selected, { cardIndex: 1, now, patch: { editorial: { ...editorial, slogan: "직접 편집한 부제", closing: "직접 편집한 마무리" } } })
    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design: changed, designRevision: changed.designRevision })
    // Then
    expect(document.cards[1]?.lead?.provenance).toEqual({ kind: "design-text", pageId: "card-topic-1", field: "slogan" })
    expect(document.cards[1]?.closing?.provenance).toEqual({ kind: "design-text", pageId: "card-topic-1", field: "closing" })
    expect(document.cards[1]?.editorial?.modules.every(module => module.action.provenance.kind === "canonical-section")).toBe(true)
  })
  it("reports long Korean title overflow without dropping or shrinking the source title", async () => {
    // Given
    const title = "고등학생이 함께 실천하는 아주 긴 한글 건강교육 제목과 ABC 안내"
    const { project, design } = await fixture(4, title)
    const selected = applyEditorialLayout(design, { cardIndex: 1, layoutType: "B", now })
    // When
    const document = compileRenderDocument({ project, projectRevision: 1, design: selected, designRevision: selected.designRevision })
    // Then
    expect(document.issues.some(issue => issue.kind === "overflow" && issue.blockId === "card-topic-1-title")).toBe(true)
    expect(document.cards[1]?.title.text).toBe(title)
    expect(document.cards[1]?.title.style.fontSize).toBe(84)
  })
})
