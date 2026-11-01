import { z } from "zod"
import { parseNewsletterProject, type NewsletterProject } from "./schema"
import { parseNewsletterDesignState, type NewsletterDesignState } from "./rendering/designSchema"
import { bundledMascotSource } from "./rendering/bundledMascot"
import type { NewsletterAssetResolver } from "./rendering/assetResolution"
import { compileRenderDocument } from "./rendering/renderDocument"

export type StudioDocument = { readonly project: NewsletterProject; readonly design: NewsletterDesignState }
type ImageFile = { readonly name: string; arrayBuffer(): Promise<ArrayBuffer> }
const envelope = z.object({ project: z.unknown(), design: z.unknown() })
export class StudioDocumentError extends Error { readonly name = "StudioDocumentError" }

export function parseStudioDocument(input: unknown): StudioDocument {
  const value = envelope.parse(input)
  const project = parseNewsletterProject(value.project)
  const design = parseNewsletterDesignState(value.design)
  if (project.projectId !== design.projectId) throw new StudioDocumentError("원고와 디자인은 동일한 프로젝트여야 합니다.")
  const revisions = new Set(project.revisionHistory.map(entry => entry.revision))
  if (!revisions.has(design.canonicalProjectRevision) || design.revisionHistory.some(entry => !revisions.has(entry.snapshot.canonicalProjectRevision))) throw new StudioDocumentError("디자인이 참조하는 원고 Revision이 없습니다.")
  for (const entry of design.revisionHistory) {
    compileRenderDocument({ project, projectRevision: entry.snapshot.canonicalProjectRevision, design, designRevision: entry.revision })
  }
  return { project, design }
}
export function serializeStudioDocument(document: StudioDocument): string {
  return JSON.stringify(parseStudioDocument(document), null, 2)
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}
export async function addStudioAssetFiles(design: NewsletterDesignState, current: ReadonlyMap<string, Uint8Array>, files: readonly ImageFile[]): Promise<ReadonlyMap<string, Uint8Array>> {
  const next = new Map(current)
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const hash = await sha256(bytes)
    const asset = design.assetManifest.find(candidate => candidate.sha256 === hash)
    if (asset === undefined) throw new StudioDocumentError(`원장에 없는 이미지입니다: ${file.name}`)
    if (asset.approvalStatus !== "approved" || asset.localReference !== `asset:${hash}`) throw new StudioDocumentError(`렌더 승인되지 않은 이미지입니다: ${file.name}`)
    next.set(`asset:${hash}`, bytes)
  }
  return next
}
export function createStudioAssetResolver(design: NewsletterDesignState, bytes: ReadonlyMap<string, Uint8Array>): NewsletterAssetResolver {
  return { async resolve(reference) {
    const selected = bytes.get(reference)
    if (selected !== undefined) return selected
    const asset = design.assetManifest.find(candidate => candidate.localReference === reference)
    const source = asset === undefined ? undefined : bundledMascotSource(asset.id)
    if (source !== undefined) {
      const response = await fetch(source)
      if (!response.ok) throw new StudioDocumentError("승인 수달쌤 파일을 읽지 못했습니다.")
      return new Uint8Array(await response.arrayBuffer())
    }
    throw new StudioDocumentError("이 문서의 이미지 원본을 다시 선택해 주세요. SHA-256을 확인한 뒤 연결합니다.")
  } }
}
