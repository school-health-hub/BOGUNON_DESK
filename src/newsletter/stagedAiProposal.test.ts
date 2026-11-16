import { describe, expect, it } from "vitest"
import { parseNewsletterAiImageCandidate, parseNewsletterAiPatch, parseNewsletterAiProposal, type NewsletterAiProposal } from "../../electron-p0/newsletter-ai-protocol"
import { canonicalJson } from "./hash"
import { applyUserEdit } from "./editing"
import { createNewsletterProject } from "./project"
import { createNewsletterDesignState } from "./rendering/designSchema"
import { restoreDesignRevision, upgradeNewsletterDesignStateV2 } from "./rendering/designState"
import { restoreRevision } from "./editing"
import { parseStudioDocument } from "./studioDocument"
import { applyNewsletterAiProposal, collectChangedDesignPageIds, createNewsletterAiBaseline, NewsletterAiProposalConflictError } from "./stagedAiProposal"

const NOW = "2026-11-13T00:00:00.000Z"
const LATER = "2026-11-13T00:01:00.000Z"

async function fixture() {
  const project = await createNewsletterProject({ projectId: "ai-stage", title: "합성 보건소식", now: NOW })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), NOW)
  return { project, design }
}

function proposal(baseline: ReturnType<typeof createNewsletterAiBaseline>, topicIds: readonly string[]): NewsletterAiProposal {
  return parseNewsletterAiProposal({
    schemaVersion: 1,
    proposalId: "proposal-1",
    provider: "mock",
    model: "deterministic-v1",
    mock: true,
    month: 11,
    schoolType: "coeducational",
    baseline,
    requestId: "request-1",
    promptHash: "a".repeat(64),
    usage: { costStatus: "unknown" },
    topics: topicIds.map((id, index) => ({
      id,
      title: `제안 제목 ${index + 1}`,
      lead: `제안 소개 ${index + 1}`,
      actions: Array.from({ length: 4 }, (_, action) => `제안 수칙 ${index + 1}-${action + 1}`),
      closing: `제안 마무리 ${index + 1}`,
      sources: [{ title: "합성 출처", publisher: "합성 기관" }],
      currentFactReview: "verification-required",
    })),
  })
}

describe("staged Newsletter AI proposal", () => {
  it("changes only the selected field and appends one contiguous revision", async () => {
    // Given
    const document = await fixture()
    const before = structuredClone(document)
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId: document.project.topics[0]?.id, fields: ["title"] }] })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })

    // Then
    expect(result.project.topics[0]?.title).toBe("제안 제목 1")
    expect(result.project.canonicalCopy).toEqual(before.project.canonicalCopy)
    expect(result.project.projectRevision).toBe(before.project.projectRevision + 1)
    expect(result.project.revisionHistory).toHaveLength(before.project.revisionHistory.length + 1)
    expect(result.design.cardLayouts).toEqual(before.design.cardLayouts)
    expect(result.design.designRevision).toBe(before.design.designRevision + 1)
    expect(document).toEqual(before)
  })

  it("applies one topic copy without changing other sections, user edits, or design coordinates", async () => {
    // Given
    const document = await fixture()
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const selectedId = document.project.topics[1]?.id
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId: selectedId, fields: ["lead", "actions", "closing"] }] })
    const otherSections = document.project.canonicalCopy.sections.filter((section) => section.topicId !== selectedId)
    const coordinates = canonicalJson({ a4: document.design.a4Layout, cards: document.design.cardLayouts })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })

    // Then
    expect(result.project.canonicalCopy.sections.filter((section) => section.topicId !== selectedId)).toEqual(otherSections)
    expect(result.project.canonicalCopy.sections[1]?.aiGenerated.text).toContain("제안 수칙 2-4")
    expect(result.project.canonicalCopy.sections[1]?.topicSelection?.closing).toBe("제안 마무리 2")
    expect(result.project.revisionHistory.at(-1)?.changedSectionIds).toEqual([document.project.canonicalCopy.sections[1]?.id])
    expect(canonicalJson({ a4: result.design.a4Layout, cards: result.design.cardLayouts })).toBe(coordinates)
    expect(result.design.canonicalProjectRevision).toBe(result.project.projectRevision)
    expect(result.design.designRevision).toBe(document.design.designRevision + 1)
  })

  it("does not create a project revision when selected text is already identical", async () => {
    // Given
    const document = await fixture()
    const generated = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const candidate = parseNewsletterAiProposal({ ...generated, topics: generated.topics.map((topic, index) => index === 0 ? { ...topic, title: document.project.topics[0]?.title } : topic) })
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId: candidate.topics[0]?.id, fields: ["title"] }] })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })

    // Then
    expect(result.project).toEqual(document.project)
  })

  it("rejects a stale baseline before mutating serialized bytes", async () => {
    // Given
    const document = await fixture()
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId: document.project.topics[0]?.id, fields: ["title"] }] })
    const changed = { ...document, project: { ...document.project, title: "동시 수동 변경" } }
    const before = JSON.stringify(changed)

    // When / Then
    expect(() => applyNewsletterAiProposal({ document: changed, proposal: candidate, patch, now: LATER })).toThrow(NewsletterAiProposalConflictError)
    expect(JSON.stringify(changed)).toBe(before)
  })

  it("preserves an existing user edit while replacing the selected AI copy", async () => {
    // Given
    const base = await fixture()
    const topicId = base.project.topics[2]?.id
    if (topicId === undefined) throw new Error("fixture topic is missing")
    const project = await applyUserEdit(base.project, { topicId, text: "사용자 확정 원고", now: LATER })
    const document = { ...base, project }
    const candidate = proposal(createNewsletterAiBaseline(document), project.topics.map((topic) => topic.id))
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId, fields: ["lead", "actions"] }] })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: "2026-11-13T00:02:00.000Z" })

    // Then
    expect(result.project.canonicalCopy.sections[2]?.userEdit).toEqual(project.canonicalCopy.sections[2]?.userEdit)
    expect(result.project.canonicalCopy.sections[2]?.aiGenerated.text).toContain("제안 수칙 3-4")
  })

  it("applies all six topics in one project and one design revision", async () => {
    // Given
    const document = await fixture()
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: candidate.topics.map((topic) => ({ topicId: topic.id, fields: ["title", "lead", "actions", "closing"] })) })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })

    // Then
    expect(result.project.topics.map((topic) => topic.title)).toEqual(candidate.topics.map((topic) => topic.title))
    expect(result.project.projectRevision).toBe(document.project.projectRevision + 1)
    expect(result.design.designRevision).toBe(document.design.designRevision + 1)
    expect(result.project.revisionHistory[result.project.revisionHistory.length - 1]?.changedSectionIds).toHaveLength(6)
  })

  it("binds a pending AI image only to the selected topic slots", async () => {
    // Given
    const document = await fixture()
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const topicId = candidate.topics[3]?.id
    if (topicId === undefined) throw new Error("fixture topic is missing")
    const image = parseNewsletterAiImageCandidate({
      schemaVersion: 1,
      candidateId: "candidate-topic-4",
      assetType: "AI_GENERATED",
      exportApproval: "pending",
      provider: "mock",
      model: "deterministic-v1",
      mock: true,
      requestId: "request-image-4",
      createdAt: LATER,
      promptHash: "b".repeat(64),
      inputHashes: [],
      outputHash: "c".repeat(64),
      mediaType: "image/png",
      byteSize: 128,
      width: 16,
      height: 16,
      baseline: candidate.baseline,
      usage: { costStatus: "unknown" },
    })
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId, fields: ["imageCandidate"] }] })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER, imageCandidates: { [topicId]: image } })

    // Then
    expect(result.design.cardLayouts[4]?.image.assetId).toBe(image.candidateId)
    expect(result.design.a4Layout.modules[3]?.image.assetId).toBe(image.candidateId)
    expect(result.design.cardLayouts[3]).toEqual(document.design.cardLayouts[3])
    expect(result.design.assetManifest.find((asset) => asset.id === image.candidateId)).toMatchObject({ approvalStatus: "reference-only", exportApproval: "pending", registry: { classification: "AI_GENERATED", generation: { provider: "mock", requestId: "request-image-4", outputHash: "c".repeat(64) } } })
  })

  it("rejects review metadata as a project field without mutating the document", async () => {
    // Given
    const document = await fixture()
    const before = JSON.stringify(document)
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId: candidate.topics[0]?.id, fields: ["currentFactReview"] }] })

    // When / Then
    expect(() => applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })).toThrow("후보 검토 정보")
    expect(JSON.stringify(document)).toBe(before)
  })

  it("binds a reordered proposal image by canonical topic ID rather than proposal index", async () => {
    // Given
    const document = await fixture()
    const ordered = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const candidate = parseNewsletterAiProposal({ ...ordered, topics: [...ordered.topics].reverse() })
    const topicId = document.project.topics[0]?.id
    if (topicId === undefined) throw new Error("fixture topic is missing")
    const image = parseNewsletterAiImageCandidate({ schemaVersion: 1, candidateId: "candidate-first-topic", assetType: "AI_GENERATED", exportApproval: "pending", provider: "mock", model: "deterministic-v1", mock: true, requestId: "request-reordered", createdAt: LATER, promptHash: "d".repeat(64), inputHashes: [], outputHash: "e".repeat(64), mediaType: "image/png", byteSize: 128, width: 16, height: 16, baseline: candidate.baseline, usage: { costStatus: "unknown" } })
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId, fields: ["imageCandidate"] }] })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER, imageCandidates: { [topicId]: image } })

    // Then
    expect(result.design.cardLayouts[1]?.image.assetId).toBe(image.candidateId)
    expect(result.design.a4Layout.modules[0]?.image.assetId).toBe(image.candidateId)
    expect(result.design.cardLayouts[6]?.image.assetId).toBe(document.design.cardLayouts[6]?.image.assetId)
  })

  it("keeps the new V2 revisions loadable and restorable", async () => {
    // Given
    const document = await fixture()
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const topicId = candidate.topics[0]?.id
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId, fields: ["title", "lead"] }] })

    // When
    const applied = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })
    const restoredProject = await restoreRevision(applied.project, { revision: document.project.projectRevision, now: "2026-11-13T00:02:00.000Z" })
    const restoredDesign = restoreDesignRevision(applied.design, { revision: document.design.designRevision, now: "2026-11-13T00:02:00.000Z" })

    // Then
    expect(parseStudioDocument(applied)).toEqual(applied)
    expect(restoredProject.canonicalCopy).toEqual(document.project.canonicalCopy)
    expect(restoredDesign.cardLayouts).toEqual(document.design.cardLayouts)
  })

  it("keeps an explicit V1 title application loadable and restorable", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "ai-stage-v1", title: "합성 V1", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const document = { project, design }
    const candidate = proposal(createNewsletterAiBaseline(document), project.topics.map((topic) => topic.id))
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId: candidate.topics[0]?.id, fields: ["title"] }] })

    // When
    const applied = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER })
    const restored = restoreDesignRevision(applied.design, { revision: design.designRevision, now: "2026-11-13T00:02:00.000Z" })

    // Then
    expect(parseStudioDocument(applied)).toEqual(applied)
    expect(restored.designSchemaVersion).toBe(1)
    expect(restored.cardLayouts).toEqual(design.cardLayouts)
  })

  it("audits cover and A4 changes with exact unique stable page IDs", async () => {
    // Given
    const document = await fixture()
    const cover = document.design.cardLayouts[0]
    if (cover === undefined) throw new Error("fixture cover is missing")
    const cards = [{ ...cover, background: "#ffffff" }, ...document.design.cardLayouts.slice(1)]
    const a4 = { ...document.design.a4Layout, background: "#ffffff" }

    // When
    const changed = collectChangedDesignPageIds(document.design.cardLayouts, cards, document.design.a4Layout, a4)

    // Then
    expect(changed).toEqual(["a4-page", "card-cover"])
  })

  it("records both the topic card and A4 page for an image binding revision", async () => {
    // Given
    const document = await fixture()
    const candidate = proposal(createNewsletterAiBaseline(document), document.project.topics.map((topic) => topic.id))
    const topicId = candidate.topics[1]?.id
    if (topicId === undefined) throw new Error("fixture topic is missing")
    const image = parseNewsletterAiImageCandidate({ schemaVersion: 1, candidateId: "candidate-audit", assetType: "AI_GENERATED", exportApproval: "pending", provider: "mock", model: "deterministic-v1", mock: true, requestId: "request-audit", createdAt: LATER, promptHash: "f".repeat(64), inputHashes: [], outputHash: "1".repeat(64), mediaType: "image/png", byteSize: 128, width: 16, height: 16, baseline: candidate.baseline, usage: { costStatus: "unknown" } })
    const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: candidate.proposalId, baseline: candidate.baseline, selections: [{ topicId, fields: ["imageCandidate"] }] })

    // When
    const result = applyNewsletterAiProposal({ document, proposal: candidate, patch, now: LATER, imageCandidates: { [topicId]: image } })

    // Then
    expect(result.design.revisionHistory[result.design.revisionHistory.length - 1]?.changedPageIds).toEqual(["a4-page", "card-topic-2"])
    expect(restoreDesignRevision(result.design, { revision: document.design.designRevision, now: "2026-11-13T00:03:00.000Z" }).cardLayouts).toEqual(document.design.cardLayouts)
  })
})
