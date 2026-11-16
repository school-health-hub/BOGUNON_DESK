import { describe, expect, it } from "vitest"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NewsletterAiAssetStorage } from "../../electron-p0/main/newsletter-ai-asset-storage"
import { NewsletterAiCandidateStore } from "../../electron-p0/main/newsletter-ai-candidate-store"
import { createNewsletterAiHandler, NewsletterAiProjectAuthority, type NewsletterAiIpcService } from "../../electron-p0/main/newsletter-ai-ipc"
import { parseNewsletterAiImageCandidate, parseNewsletterAiPatch, parseNewsletterAiProposal } from "../../electron-p0/newsletter-ai-protocol"
import { createNewsletterProject } from "./project"
import { createNewsletterDesignState } from "./rendering/designSchema"
import { upgradeNewsletterDesignStateV2 } from "./rendering/designState"
import { parseStudioDocument, serializeStudioDocument } from "./studioDocument"
import { createNewsletterAiBaseline } from "./stagedAiProposal"
import { applyNewsletterAiCandidateAssets, NewsletterAiCandidateAssetError } from "./aiCandidateApplication"
import { generateNewsletterOutputs, NewsletterOutputBlockedError } from "./output/outputEngine"
import { resolveDesignAssets } from "./rendering/assetResolution"

const NOW = "2026-11-13T01:00:00.000Z"
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), value => value.charCodeAt(0))
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer))].map(value => value.toString(16).padStart(2, "0")).join("")

async function setup() {
  const project = await createNewsletterProject({ projectId: "ai-asset-apply", title: "합성 소식지", now: NOW })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW }), NOW)
  const document = { project, design }
  const baseline = createNewsletterAiBaseline(document)
  const proposal = parseNewsletterAiProposal({ schemaVersion: 1, proposalId: "proposal-assets", provider: "mock", model: "mock-text", mock: true, month: 11, schoolType: "coeducational", baseline, requestId: "request-assets", promptHash: "a".repeat(64), usage: { costStatus: "unknown" }, topics: project.topics.map((topic, index) => ({ id: topic.id, title: `주제 ${index + 1}`, lead: `도입 ${index + 1}`, actions: [1, 2, 3, 4].map(action => `수칙 ${index + 1}-${action}`), closing: `마무리 ${index + 1}`, sources: [], currentFactReview: "verification-required" })) })
  const topicId = project.topics[0]!.id
  const sha = await digest(PNG)
  const candidate = parseNewsletterAiImageCandidate({ schemaVersion: 1, candidateId: "ai-topic-image-1", assetType: "AI_GENERATED", exportApproval: "pending", provider: "mock", model: "mock-image", mock: true, requestId: "request-image", createdAt: NOW, promptHash: "b".repeat(64), inputHashes: [], outputHash: sha, mediaType: "image/png", byteSize: PNG.byteLength, width: 1, height: 1, baseline, usage: { costStatus: "unknown" } })
  const patch = parseNewsletterAiPatch({ schemaVersion: 1, proposalId: proposal.proposalId, baseline, selections: [{ topicId, fields: ["imageCandidate"] }] })
  return { document, proposal, patch, topicId, candidate, sha }
}

describe("Newsletter AI candidate asset application", () => {
  it("copies only explicitly selected bytes, persists provenance, and keeps publication pending", async () => {
    const fixture = await setup()
    const result = await applyNewsletterAiCandidateAssets({ ...fixture, candidates: { [fixture.topicId]: { candidate: fixture.candidate, bytes: PNG } }, currentAssets: new Map(), now: NOW })
    expect(result.assets.get(`asset:${fixture.sha}`)).toEqual(PNG)
    expect(result.assets.get(`asset:${fixture.sha}`)).not.toBe(PNG)
    const asset = result.document.design.assetManifest.find(value => value.id === fixture.candidate.candidateId)
    expect(asset).toMatchObject({ approvalStatus: "reference-only", exportApproval: "pending", registry: { classification: "AI_GENERATED", generation: { provider: "mock", model: "mock-image", requestId: "request-image", outputHash: fixture.sha, createdAt: NOW } } })
    expect(parseStudioDocument(JSON.parse(serializeStudioDocument(result.document))).design.assetManifest).toContainEqual(asset)
    const resolver = { resolve: async (reference: string) => result.assets.get(reference)! }
    await expect(resolveDesignAssets(result.document.design, result.document.design.designRevision, resolver)).rejects.toThrow(/approval/)
    expect((await resolveDesignAssets(result.document.design, result.document.design.designRevision, resolver, { allowPendingReview: true })).has(fixture.candidate.candidateId)).toBe(true)
    await expect(generateNewsletterOutputs({ project: result.document.project, projectRevision: result.document.project.projectRevision, design: result.document.design, designRevision: result.document.design.designRevision, createdAt: NOW, rasterizer: {} as never, pdfComposer: {} as never, assetResolver: resolver })).rejects.toBeInstanceOf(NewsletterOutputBlockedError)
  })

  it("resolves a pending preview after JSON save and a new local asset store instance", async () => {
    // Given
    const fixture = await setup()
    const applied = await applyNewsletterAiCandidateAssets({ ...fixture, candidates: { [fixture.topicId]: { candidate: fixture.candidate, bytes: PNG } }, currentAssets: new Map(), now: NOW })
    const reopened = parseStudioDocument(JSON.parse(serializeStudioDocument(applied.document)))
    const root = await mkdtemp(join(tmpdir(), "newsletter-ai-reopen-"))
    await new NewsletterAiAssetStorage(root).save({ projectId: reopened.project.projectId, sha256: fixture.sha, mediaType: "image/png", bytesBase64: btoa(String.fromCharCode(...PNG)) }, createNewsletterAiBaseline(reopened))
    const assets = new NewsletterAiAssetStorage(root)
    const frame = {}, contents = { id: 91, mainFrame: frame, getURL: () => "file:///newsletter/index.html" }
    const service: NewsletterAiIpcService = { status: async () => ({ connected: false, provider: null, textModel: null, imageModel: null, textAvailable: false, imageAvailable: false, textUnavailableReason: "offline", imageUnavailableReason: "offline" }), proposeText: async () => ({}), generateImageCandidate: async () => { throw new Error("not used") }, cancel: async () => undefined }
    const authority = new NewsletterAiProjectAuthority()
    authority.grant(contents.id, "reopen-session", reopened.project.projectId)
    const load = createNewsletterAiHandler({ action: "loadProjectAssets", contents, url: "file:///newsletter/index.html", service, store: new NewsletterAiCandidateStore(), assets, authority, sessionId: "reopen-session" })

    // When
    const loaded = await load({ sender: contents, senderFrame: frame }, { projectId: reopened.project.projectId, baseline: createNewsletterAiBaseline(reopened), sha256: [fixture.sha] })

    // Then
    if (!loaded.ok || !Array.isArray(loaded.data)) throw new Error("stored asset load failed")
    const restored = new Map<string, Uint8Array>(loaded.data.map(entry => {
      if (typeof entry !== "object" || entry === null || !("sha256" in entry) || !("bytesBase64" in entry) || typeof entry.sha256 !== "string" || typeof entry.bytesBase64 !== "string") throw new Error("invalid stored asset")
      return [`asset:${entry.sha256}`, Uint8Array.from(atob(entry.bytesBase64), value => value.charCodeAt(0))] as const
    }))
    const resolved = await resolveDesignAssets(reopened.design, reopened.design.designRevision, { resolve: async reference => { const value=restored.get(reference);if(value===undefined)throw new Error("missing restored asset");return value } }, { allowPendingReview: true })
    expect(resolved.get(fixture.candidate.candidateId)).toBe(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`)
  })

  it("rejects changed bytes without mutating the document or existing assets", async () => {
    const fixture = await setup()
    const before = JSON.stringify(fixture.document)
    const current = new Map<string, Uint8Array>([["asset:" + "f".repeat(64), Uint8Array.of(1)]])
    await expect(applyNewsletterAiCandidateAssets({ ...fixture, candidates: { [fixture.topicId]: { candidate: fixture.candidate, bytes: Uint8Array.of(1, 2, 3) } }, currentAssets: current, now: NOW })).rejects.toBeInstanceOf(NewsletterAiCandidateAssetError)
    expect(JSON.stringify(fixture.document)).toBe(before)
    expect([...current]).toEqual([["asset:" + "f".repeat(64), Uint8Array.of(1)]])
  })

  it("does not retain an unselected candidate", async () => {
    const fixture = await setup()
    const patch = parseNewsletterAiPatch({ ...fixture.patch, selections: [{ topicId: fixture.topicId, fields: ["title"] }] })
    const result = await applyNewsletterAiCandidateAssets({ ...fixture, patch, candidates: { [fixture.topicId]: { candidate: fixture.candidate, bytes: PNG } }, currentAssets: new Map(), now: NOW })
    expect(result.assets.size).toBe(0)
    expect(result.document.design.assetManifest.some(value => value.id === fixture.candidate.candidateId)).toBe(false)
  })

  it("binds a selected candidate to the cover without changing topic frames", async () => {
    const fixture = await setup()
    const beforeTopics = fixture.document.design.cardLayouts.slice(1)
    const result = await applyNewsletterAiCandidateAssets({ ...fixture, candidates: { [fixture.topicId]: { candidate: fixture.candidate, bytes: PNG, target: { kind: "cover" }, generationTarget: { kind: "cover" } } }, currentAssets: new Map(), now: NOW })
    expect(result.document.design.cardLayouts[0]?.image.assetId).toBe(fixture.candidate.candidateId)
    expect(result.document.design.cardLayouts.slice(1)).toEqual(beforeTopics)
  })

  it("binds a selected candidate to one action frame without changing sibling frames", async () => {
    const fixture = await setup()
    if (fixture.document.design.designSchemaVersion !== 2) throw new Error("V2 action fixture required")
    const card = fixture.document.design.cardLayouts[1]!
    const moduleImages = [0, 1, 2, 3].map(index => ({ ...card.image, slotId: `action-${index}` }))
    const design = { ...fixture.document.design, cardLayouts: fixture.document.design.cardLayouts.map((value, index) => index === 1 ? { ...value, editorial: { layoutType: "B" as const, studentComposition: "mixed" as const, season: "winter" as const, moduleImages } } : value) }
    const document = { project: fixture.document.project, design }
    const baseline = createNewsletterAiBaseline(document)
    const candidate = parseNewsletterAiImageCandidate({ ...fixture.candidate, baseline })
    const proposal = parseNewsletterAiProposal({ ...fixture.proposal, baseline })
    const patch = parseNewsletterAiPatch({ ...fixture.patch, baseline })
    const siblings = moduleImages.filter((_, index) => index !== 2)
    const result = await applyNewsletterAiCandidateAssets({ document, proposal, patch, candidates: { [fixture.topicId]: { candidate, bytes: PNG, target: { kind: "action", topicId: fixture.topicId, actionIndex: 2 }, generationTarget: { kind: "action", topicId: fixture.topicId, actionIndex: 2 } } }, currentAssets: new Map(), now: NOW })
    if (result.document.design.designSchemaVersion !== 2) throw new Error("V2 action result required")
    const nextCard = result.document.design.cardLayouts[1]
    if (nextCard?.editorial?.moduleImages === undefined) throw new Error("V2 action result required")
    expect(nextCard.editorial.moduleImages[2]?.assetId).toBe(candidate.candidateId)
    expect(nextCard.editorial.moduleImages.filter((_, index) => index !== 2)).toEqual(siblings)
  })

  it("applies every selected stable slot for one topic in one design revision", async () => {
    const fixture = await setup()
    if (fixture.document.design.designSchemaVersion !== 2) throw new Error("V2 multi-slot fixture required")
    const card = fixture.document.design.cardLayouts[1]!
    const moduleImages = [0, 1, 2, 3].map(index => ({ ...card.image, slotId: `action-${index}` }))
    const design = { ...fixture.document.design, cardLayouts: fixture.document.design.cardLayouts.map((value, index) => index === 1 ? { ...value, editorial: { layoutType: "B" as const, studentComposition: "mixed" as const, season: "winter" as const, moduleImages } } : value) }
    const document = { project: fixture.document.project, design }
    const baseline = createNewsletterAiBaseline(document)
    const topicBytes = PNG
    const actionBytes = Uint8Array.from([...PNG, 0])
    const topicHash = await digest(topicBytes)
    const actionHash = await digest(actionBytes)
    const topicCandidate = parseNewsletterAiImageCandidate({ ...fixture.candidate, candidateId: "ai-topic-multi", baseline, outputHash: topicHash, byteSize: topicBytes.byteLength })
    const actionCandidate = parseNewsletterAiImageCandidate({ ...fixture.candidate, candidateId: "ai-action-multi", baseline, outputHash: actionHash, byteSize: actionBytes.byteLength, requestId: "request-action-multi" })
    const proposal = parseNewsletterAiProposal({ ...fixture.proposal, baseline })
    const patch = parseNewsletterAiPatch({ ...fixture.patch, baseline })
    const beforeRevision = design.designRevision
    const result = await applyNewsletterAiCandidateAssets({ document, proposal, patch, candidates: {
      [`topic:${fixture.topicId}`]: { topicId: fixture.topicId, candidate: topicCandidate, bytes: topicBytes, target: { kind: "topic", topicId: fixture.topicId }, generationTarget: { kind: "topic", topicId: fixture.topicId } },
      [`action:${fixture.topicId}:1`]: { topicId: fixture.topicId, candidate: actionCandidate, bytes: actionBytes, target: { kind: "action", topicId: fixture.topicId, actionIndex: 1 }, generationTarget: { kind: "action", topicId: fixture.topicId, actionIndex: 1 } },
    }, currentAssets: new Map(), now: NOW })
    if (result.document.design.designSchemaVersion !== 2) throw new Error("V2 multi-slot result required")
    expect(result.document.design.designRevision).toBe(beforeRevision + 1)
    expect(result.document.design.cardLayouts[1]?.image.assetId).toBe(topicCandidate.candidateId)
    expect(result.document.design.cardLayouts[1]?.editorial?.moduleImages?.[1]?.assetId).toBe(actionCandidate.candidateId)
    expect(result.document.design.assetManifest.filter(asset => [topicCandidate.candidateId, actionCandidate.candidateId].includes(asset.id))).toHaveLength(2)
  })

  it("rejects retargeting and duplicate stable targets without mutating inputs", async () => {
    // Given
    const fixture = await setup(),before = JSON.stringify(fixture.document),assets = new Map<string,Uint8Array>()
    const target = { kind: "action" as const, topicId: fixture.topicId, actionIndex: 0 as const }
    const first = { topicId: fixture.topicId, candidate: fixture.candidate, bytes: PNG, target, generationTarget: { kind: "topic" as const, topicId: fixture.topicId } }
    // When / Then: generated topic art cannot be retargeted to an action frame.
    await expect(applyNewsletterAiCandidateAssets({ ...fixture, candidates: { first }, currentAssets: assets, now: NOW })).rejects.toBeInstanceOf(NewsletterAiCandidateAssetError)
    // When / Then: two candidates cannot claim the same stable action frame.
    await expect(applyNewsletterAiCandidateAssets({ ...fixture, candidates: { first: { ...first, generationTarget: target }, second: { ...first, generationTarget: target } }, currentAssets: assets, now: NOW })).rejects.toBeInstanceOf(NewsletterAiCandidateAssetError)
    expect(JSON.stringify(fixture.document)).toBe(before)
    expect(assets.size).toBe(0)
  })
})
