import { parseNewsletterAiImageCandidate, type NewsletterAiImageCandidate, type NewsletterAiPatch, type NewsletterAiProposal } from "../../electron-p0/newsletter-ai-protocol"
import type { StudioDocument } from "./studioDocument"
import { applyNewsletterAiProposal } from "./stagedAiProposal"

export type NewsletterAiAssetTarget =
  | { readonly kind: "cover" }
  | { readonly kind: "topic"; readonly topicId: string }
  | { readonly kind: "action"; readonly topicId: string; readonly actionIndex: 0 | 1 | 2 | 3 }

export class NewsletterAiCandidateAssetError extends Error {
  readonly name = "NewsletterAiCandidateAssetError"
  constructor() { super("AI 이미지 후보의 바이트 또는 SHA-256이 일치하지 않습니다.") }
}

type CandidatePayload = { readonly topicId?: string; readonly candidate: NewsletterAiImageCandidate; readonly bytes: Uint8Array; readonly target?: NewsletterAiAssetTarget; readonly generationTarget?: NewsletterAiAssetTarget }
type Input = {
  readonly document: StudioDocument
  readonly proposal: NewsletterAiProposal
  readonly patch: NewsletterAiPatch
  readonly candidates: Readonly<Record<string, CandidatePayload>>
  readonly currentAssets: ReadonlyMap<string, Uint8Array>
  readonly now: string
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("")
}

export async function applyNewsletterAiCandidateAssets(input: Input): Promise<{ readonly document: StudioDocument; readonly assets: ReadonlyMap<string, Uint8Array> }> {
  const selected = input.patch.selections.filter(selection => selection.fields.includes("imageCandidate"))
  const selectedTopics = new Set(selected.map(selection => selection.topicId))
  const chosen = Object.entries(input.candidates).flatMap(([key, payload]) => {
    const topicId = payload.topicId ?? key
    return selectedTopics.has(topicId) ? [{ topicId, payload }] : []
  })
  if (selected.some(selection => !chosen.some(entry => entry.topicId === selection.topicId))) throw new NewsletterAiCandidateAssetError()
  const targetIds = new Set<string>()
  for (const { topicId, payload } of chosen) {
    const target = payload.target ?? { kind: "topic", topicId }, generated = payload.generationTarget ?? { kind: "topic", topicId }
    if ((target.kind !== "cover" && target.topicId !== topicId) || (generated.kind !== "cover" && generated.topicId !== topicId)) throw new NewsletterAiCandidateAssetError()
    const targetId = target.kind === "cover" ? "cover" : target.kind === "topic" ? `topic:${target.topicId}` : `action:${target.topicId}:${target.actionIndex}`
    const generatedId = generated.kind === "cover" ? "cover" : generated.kind === "topic" ? `topic:${generated.topicId}` : `action:${generated.topicId}:${generated.actionIndex}`
    if (targetId !== generatedId || targetIds.has(targetId)) throw new NewsletterAiCandidateAssetError()
    targetIds.add(targetId)
  }
  const imageEntries: { readonly topicId: string; readonly candidate: NewsletterAiImageCandidate; readonly target: NewsletterAiAssetTarget }[] = []
  const verified: readonly { readonly reference: string; readonly bytes: Uint8Array }[] = await Promise.all(chosen.map(async ({topicId,payload}) => {
    const candidate = parseNewsletterAiImageCandidate(payload.candidate)
    const bytes = new Uint8Array(payload.bytes)
    if (bytes.byteLength !== candidate.byteSize || await sha256(bytes) !== candidate.outputHash) throw new NewsletterAiCandidateAssetError()
    imageEntries.push({topicId,candidate,target:payload.target ?? { kind: "topic", topicId }})
    return { reference: `asset:${candidate.outputHash}`, bytes }
  }))
  const document = applyNewsletterAiProposal({ document: input.document, proposal: input.proposal, patch: input.patch, now: input.now, imageEntries })
  const assets = new Map(input.currentAssets)
  for (const asset of verified) assets.set(asset.reference, new Uint8Array(asset.bytes))
  return { document, assets }
}
