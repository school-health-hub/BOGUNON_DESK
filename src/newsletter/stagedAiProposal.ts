import type { NewsletterAiBaseline, NewsletterAiImageCandidate, NewsletterAiPatch, NewsletterAiProposal } from "../../electron-p0/newsletter-ai-protocol"
import { canonicalJson, semanticHashSync } from "./hash"
import { topicKey } from "./monthlyTopicBank"
import { parseNewsletterProject, type NewsletterProject } from "./schema"
import { parseNewsletterDesignState, type NewsletterDesignState, type NewsletterDesignStateV2 } from "./rendering/designSchema"
import { structureCanonicalText } from "./rendering/contentStructure"
import type { StudioDocument } from "./studioDocument"

export class NewsletterAiProposalConflictError extends Error {
  readonly name = "NewsletterAiProposalConflictError"
  constructor() { super("원고 또는 디자인이 AI 후보 생성 후 변경되었습니다. 후보를 다시 검토해 주세요.") }
}

export class NewsletterAiProposalApplyError extends Error {
  readonly name = "NewsletterAiProposalApplyError"
  constructor(message: string) { super(message) }
}

export function createNewsletterAiBaseline(document: StudioDocument): NewsletterAiBaseline {
  return {
    projectId: document.project.projectId,
    projectRevision: document.project.projectRevision,
    projectHash: semanticHashSync(document.project),
    designRevision: document.design.designRevision,
    designHash: semanticHashSync(document.design),
  }
}

export function bindNewsletterAiProposalToDocument(document: StudioDocument, proposal: NewsletterAiProposal): NewsletterAiProposal {
  return {
    ...proposal,
    topics: proposal.topics.map((topic, index) => {
      const targetTopic = document.project.topics[index]
      if (!targetTopic) throw new NewsletterAiProposalApplyError("AI 원고 후보와 현재 문서의 주제 수가 일치하지 않습니다.")
      return { ...topic, id: targetTopic.id }
    }),
  }
}

function baselineMatches(left: NewsletterAiBaseline, right: NewsletterAiBaseline): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function copyText(section: NewsletterProject["canonicalCopy"]["sections"][number], lead: string | undefined, actions: readonly string[] | undefined): string {
  const current = structureCanonicalText(section.aiGenerated.text)
  const currentLead = current.kind === "paragraph" ? current.body : current.lead ?? ""
  const currentActions = current.kind === "paragraph" ? [] : current.actions
  return [lead ?? currentLead, ...(actions ?? currentActions).map((action, index) => `${index + 1}. ${action}`)].filter((line) => line.length > 0).join("\n")
}

function appendProjectRevision(project: NewsletterProject, proposal: NewsletterAiProposal, patch: NewsletterAiPatch, now: string): NewsletterProject {
  const selections = new Map(patch.selections.map((selection) => [selection.topicId, new Set(selection.fields)]))
  const proposals = new Map(proposal.topics.map((topic) => [topic.id, topic]))
  const changedIds: string[] = []
  const sections = project.canonicalCopy.sections.map((section) => {
    const fields = selections.get(section.topicId)
    const topic = proposals.get(section.topicId)
    if (fields === undefined) return section
    if (topic === undefined) throw new NewsletterAiProposalApplyError("선택한 주제 후보가 없습니다.")
    const copyChanged = fields.has("lead") || fields.has("actions")
    const closingChanged = fields.has("closing")
    if (!copyChanged && !closingChanged) return section
    const nextText = copyChanged ? copyText(section, fields.has("lead") ? topic.lead : undefined, fields.has("actions") ? topic.actions : undefined) : section.aiGenerated.text
    const aiGenerated = nextText === section.aiGenerated.text ? section.aiGenerated : { text: nextText, generatedAt: now }
    const source = topic.sources[0]
    const topicSelection = closingChanged ? {
      selectedMonth: `${now.slice(0, 4)}-${String(proposal.month).padStart(2, "0")}`,
      source: {
        kind: "manual" as const,
        label: source === undefined ? "AI 생성 후보 · 출처 검토 필요" : `${source.publisher} · ${source.title}`,
        reference: source?.url ?? "ai-proposal:verification-required",
        ...(source?.sha256 === undefined ? {} : { sha256: source.sha256 }),
      },
      sourceYear: Number(now.slice(0, 4)),
      sourceMonth: proposal.month,
      closing: topic.closing,
      reviewStatus: "pending" as const,
    } : section.topicSelection
    const sectionChanged = canonicalJson(aiGenerated) !== canonicalJson(section.aiGenerated) || canonicalJson(topicSelection) !== canonicalJson(section.topicSelection)
    if (!sectionChanged) return section
    changedIds.push(section.id)
    const payload = section.userEdit === undefined ? aiGenerated : { aiGenerated, userEdit: section.userEdit }
    return { ...section, aiGenerated, ...(topicSelection === undefined ? {} : { topicSelection }), revision: section.revision + 1, semanticHash: semanticHashSync(payload) }
  })
  const topics = project.topics.map((topic) => {
    const fields = selections.get(topic.id)
    const candidate = proposals.get(topic.id)
    return fields?.has("title") === true && candidate !== undefined ? { ...topic, title: candidate.title } : topic
  })
  if (new Set(topics.map((topic) => topicKey(topic.title))).size !== topics.length) throw new NewsletterAiProposalApplyError("같거나 유사한 주제가 중복되었습니다.")
  const titleChanged = canonicalJson(topics) !== canonicalJson(project.topics)
  if (!titleChanged && changedIds.length === 0) return project
  const revision = project.projectRevision + 1
  const canonicalCopy = { sections }
  return parseNewsletterProject({
    ...project,
    topics,
    canonicalCopy,
    projectRevision: revision,
    ...(titleChanged ? { topicTitleHistory: [...(project.topicTitleHistory ?? []), { throughRevision: project.projectRevision, titles: project.topics.map((topic) => topic.title) }] } : {}),
    revisionHistory: [...project.revisionHistory, { revision, createdAt: now, changedSectionIds: changedIds, snapshot: canonicalCopy }],
  })
}

type AdvanceDesignInput = {
  readonly design: NewsletterDesignState
  readonly topicIds: readonly string[]
  readonly proposal: NewsletterAiProposal
  readonly patch: NewsletterAiPatch
  readonly projectRevision: number
  readonly now: string
  readonly imageCandidates?: Readonly<Record<string, NewsletterAiImageCandidate>>
  readonly imageTargets?: Readonly<Record<string, { readonly kind: "cover" } | { readonly kind: "topic"; readonly topicId: string } | { readonly kind: "action"; readonly topicId: string; readonly actionIndex: 0 | 1 | 2 | 3 }>>
  readonly imageEntries?: readonly { readonly topicId: string; readonly candidate: NewsletterAiImageCandidate; readonly target: { readonly kind: "cover" } | { readonly kind: "topic"; readonly topicId: string } | { readonly kind: "action"; readonly topicId: string; readonly actionIndex: 0 | 1 | 2 | 3 } }[]
}

export function collectChangedDesignPageIds(
  beforeCards: NewsletterDesignState["cardLayouts"],
  afterCards: NewsletterDesignState["cardLayouts"],
  beforeA4: NewsletterDesignState["a4Layout"],
  afterA4: NewsletterDesignState["a4Layout"],
): readonly string[] {
  const pages = canonicalJson(beforeA4) === canonicalJson(afterA4) ? [] : ["a4-page"]
  for (const [index, card] of afterCards.entries()) {
    if (canonicalJson(beforeCards[index]) !== canonicalJson(card) && !pages.includes(card.pageId)) pages.push(card.pageId)
  }
  return pages
}

function advanceDesignRevision(input: AdvanceDesignInput): NewsletterDesignState {
  const { design, proposal, patch, projectRevision, now } = input
  const selections = new Map(patch.selections.map((selection) => [selection.topicId, new Set(selection.fields)]))
  const legacyImageEntries = input.imageEntries === undefined ? patch.selections.flatMap((selection) => {
    if (!selection.fields.includes("imageCandidate")) return []
    const candidate = input.imageCandidates?.[selection.topicId]
    if (candidate === undefined || !baselineMatches(candidate.baseline, patch.baseline)) throw new NewsletterAiProposalApplyError("선택한 이미지 후보가 없거나 기준 Revision과 다릅니다.")
    return [{ topicId: selection.topicId, candidate, target: input.imageTargets?.[selection.topicId] ?? { kind: "topic" as const, topicId: selection.topicId } }]
  }) : []
  const imageEntries = input.imageEntries ?? legacyImageEntries
  for (const entry of imageEntries) {
    if (!selections.get(entry.topicId)?.has("imageCandidate") || !baselineMatches(entry.candidate.baseline, patch.baseline)) throw new NewsletterAiProposalApplyError("선택한 이미지 후보가 없거나 기준 Revision과 다릅니다.")
  }
  const revision = design.designRevision + 1
  if (design.designSchemaVersion === 1) {
    if (imageEntries.length > 0) throw new NewsletterAiProposalApplyError("이미지 후보 적용에는 DesignState V2가 필요합니다.")
    const cards = design.cardLayouts
    const snapshot = { canonicalProjectRevision: projectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout: design.a4Layout, cardLayouts: cards, assetManifest: design.assetManifest }
    return parseNewsletterDesignState({ ...design, ...snapshot, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: now, changedPageIds: [], snapshot }] })
  }
  const cards = design.cardLayouts.map((card, index) => {
    const topicId = input.topicIds[index - 1]
    const topic = proposal.topics.find((candidate) => candidate.id === topicId)
    const fields = topicId === undefined ? undefined : selections.get(topicId)
    const coverImage = index === 0 ? imageEntries.find(entry => entry.target.kind === "cover") : undefined
    if (index === 0) return coverImage === undefined ? card : { ...card, image: { ...card.image, assetId: coverImage.candidate.candidateId, visible: true } }
    if (topic === undefined || fields === undefined) return card
    const image = imageEntries.find((entry) => entry.target.kind === "topic" && entry.target.topicId === topic.id)
    const actionImages = imageEntries.filter((entry) => entry.target.kind === "action" && entry.target.topicId === topic.id)
    const editorial = card.editorial === undefined ? undefined : {
      ...card.editorial,
      ...(fields.has("lead") ? { slogan: topic.lead } : {}),
      ...(fields.has("closing") ? { closing: topic.closing } : {}),
      ...(card.editorial.moduleImages === undefined || actionImages.length === 0 ? {} : { moduleImages: card.editorial.moduleImages.map((module, moduleIndex) => {
        const action = actionImages.find(entry => entry.target.kind === "action" && entry.target.actionIndex === moduleIndex)
        return action === undefined ? module : { ...module, assetId: action.candidate.candidateId, visible: true }
      }) }),
    }
    return {
      ...card,
      ...(image === undefined ? {} : { image: { ...card.image, assetId: image.candidate.candidateId, visible: true } }),
      ...(editorial === undefined ? {} : { editorial }),
    }
  })
  const modules = design.a4Layout.modules.map((module, index) => {
    const topicId = input.topicIds[index]
    const image = topicId === undefined ? undefined : imageEntries.find((entry) => entry.target.kind === "topic" && entry.target.topicId === topicId)
    return image === undefined ? module : { ...module, image: { ...module.image, assetId: image.candidate.candidateId, visible: true } }
  })
  const generatedAssets = imageEntries.flatMap((entry): NewsletterDesignStateV2["assetManifest"] => design.assetManifest.some((asset) => asset.id === entry.candidate.candidateId) ? [] : [{
    id: entry.candidate.candidateId,
    sha256: entry.candidate.outputHash,
    mediaType: entry.candidate.mediaType,
    approvalStatus: "reference-only",
    exportApproval: "pending",
    originalName: `${entry.candidate.candidateId}.${entry.candidate.mediaType.split("/")[1]}`,
    localReference: `asset:${entry.candidate.outputHash}`,
    registry: { classification: "AI_GENERATED", purpose: "illustration", usageScope: "newsletter-output", generation: { provider: entry.candidate.provider, model: entry.candidate.model, requestId: entry.candidate.requestId, promptHash: entry.candidate.promptHash, outputHash: entry.candidate.outputHash, createdAt: entry.candidate.createdAt, mock: entry.candidate.mock } },
  }])
  const assets = [...design.assetManifest, ...generatedAssets]
  const a4Layout = { ...design.a4Layout, modules }
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: projectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout, cardLayouts: cards, assetManifest: assets }
  const changedPageIds = collectChangedDesignPageIds(design.cardLayouts, cards, design.a4Layout, a4Layout)
  return parseNewsletterDesignState({ ...design, ...snapshot, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: now, changedPageIds, snapshotVersion: 2, snapshot }] })
}

type ApplyNewsletterAiProposalInput = {
  readonly document: StudioDocument
  readonly proposal: NewsletterAiProposal
  readonly patch: NewsletterAiPatch
  readonly now: string
  readonly imageCandidates?: Readonly<Record<string, NewsletterAiImageCandidate>>
  readonly imageTargets?: Readonly<Record<string, { readonly kind: "cover" } | { readonly kind: "topic"; readonly topicId: string } | { readonly kind: "action"; readonly topicId: string; readonly actionIndex: 0 | 1 | 2 | 3 }>>
  readonly imageEntries?: readonly { readonly topicId: string; readonly candidate: NewsletterAiImageCandidate; readonly target: { readonly kind: "cover" } | { readonly kind: "topic"; readonly topicId: string } | { readonly kind: "action"; readonly topicId: string; readonly actionIndex: 0 | 1 | 2 | 3 } }[]
}

export function applyNewsletterAiProposal(input: ApplyNewsletterAiProposalInput): StudioDocument {
  const { document, proposal, patch, now } = input
  const current = createNewsletterAiBaseline(document)
  if (proposal.proposalId !== patch.proposalId || !baselineMatches(proposal.baseline, patch.baseline) || !baselineMatches(current, patch.baseline)) throw new NewsletterAiProposalConflictError()
  if (patch.selections.some((selection) => selection.fields.some((field) => field === "sources" || field === "currentFactReview" || field === "visualConcept"))) throw new NewsletterAiProposalApplyError("출처·검토 상태·시각 개념은 후보 검토 정보이며 원고 필드로 직접 적용할 수 없습니다.")
  const selectedIds = new Set(patch.selections.map((selection) => selection.topicId))
  if (patch.selections.some((selection) => !proposal.topics.some((topic) => topic.id === selection.topicId)) || selectedIds.size !== patch.selections.length) throw new NewsletterAiProposalApplyError("선택한 주제 후보가 올바르지 않습니다.")
  const project = appendProjectRevision(document.project, proposal, patch, now)
  const design = advanceDesignRevision({ design: document.design, topicIds: document.project.topics.map((topic) => topic.id), proposal, patch, projectRevision: project.projectRevision, now, imageCandidates: input.imageCandidates, imageTargets: input.imageTargets, imageEntries: input.imageEntries })
  return { project, design }
}
