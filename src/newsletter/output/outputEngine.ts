import { assetExportPending, resolveDesignAssets, referencedDesignAssets } from "../rendering/assetResolution"
export { NewsletterAssetResolutionError } from "../rendering/assetResolution"
export type { NewsletterAssetResolver } from "../rendering/assetResolution"
import type { NewsletterAssetResolver } from "../rendering/assetResolution"
import type { NewsletterProject } from "../schema"
import type { NewsletterDesignState } from "../rendering/designSchema"
import { compileRenderDocument } from "../rendering/renderDocument"
import { A4_PAGE_POINTS, CARD_PAGE_POINTS, type PdfComposer, type PdfImagePage } from "./pdfComposer"
import { renderA4Svg, renderCardSvg, validateA4SafeArea } from "./svgRenderer"

export type { PdfComposer } from "./pdfComposer"

export type RasterizeRequest = {
  readonly svg: string
  readonly width: number
  readonly height: number
  readonly signal?: AbortSignal
}

export interface SvgRasterizer {
  ensureFontReady(): Promise<void>
  rasterize(request: RasterizeRequest): Promise<Uint8Array>
}

export type OutputArtifact = {
  readonly stableId: string
  readonly fileName: string
  readonly mediaType: "image/png" | "application/pdf"
  readonly bytes: Uint8Array
  readonly sha256: string
}

export type OutputManifest = {
  readonly reviewOnly?: true
  readonly projectId: string
  readonly projectRevision: number
  readonly designRevision: number
  readonly templateVersion: number
  readonly assetSha256: readonly string[]
  readonly createdAt: string
  readonly outputs: readonly {
    readonly stableId: string
    readonly fileName: string
    readonly outputType: "a4-png" | "card-png" | "a4-pdf" | "cards-pdf"
    readonly sha256: string
    readonly pixelSize?: { readonly width: number; readonly height: number }
    readonly pageSizePoints?: { readonly width: number; readonly height: number }
    readonly pageCount?: number
    readonly targetDpi?: 300
    readonly dpiMetadata?: "not-embedded"
  }[]
}

export type NewsletterOutputBundle = {
  readonly a4Png: OutputArtifact
  readonly cardPngs: readonly OutputArtifact[]
  readonly a4Pdf: OutputArtifact
  readonly cardsPdf: OutputArtifact
  readonly manifest: OutputManifest
}

type GenerateOutputInput = {
  readonly purpose?: "publication" | "qa"
  readonly project: NewsletterProject
  readonly projectRevision: number
  readonly design: NewsletterDesignState
  readonly designRevision: number
  readonly createdAt: string
  readonly rasterizer: SvgRasterizer
  readonly pdfComposer: PdfComposer
  readonly assetResolver?: NewsletterAssetResolver
  readonly signal?: AbortSignal
}

export class NewsletterOutputBlockedError extends Error {
  readonly name = "NewsletterOutputBlockedError"
  constructor(readonly reasons: readonly string[]) {
    super(`newsletter output blocked: ${reasons.join(", ")}`)
  }
}

export class NewsletterPngInvalidError extends Error {
  readonly name = "NewsletterPngInvalidError"
  constructor(readonly reason: string) {
    super(`newsletter PNG is invalid: ${reason}`)
  }
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DOMException("Newsletter output was cancelled", "AbortError")
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")
}

export function readPngDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) throw new NewsletterPngInvalidError("signature or IHDR is missing")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

async function artifact(stableId: string, fileName: string, mediaType: OutputArtifact["mediaType"], bytes: Uint8Array): Promise<OutputArtifact> {
  return { stableId, fileName, mediaType, bytes, sha256: await sha256(bytes) }
}

function assertDimensions(bytes: Uint8Array, width: number, height: number): void {
  const actual = readPngDimensions(bytes)
  if (actual.width !== width || actual.height !== height) throw new NewsletterPngInvalidError(`expected ${width}x${height}, received ${actual.width}x${actual.height}`)
}

export async function generateNewsletterOutputs(input: GenerateOutputInput): Promise<NewsletterOutputBundle> {
  const document = compileRenderDocument(input)
  const safeAreaIssues = validateA4SafeArea(document.a4).map((id) => `A4 safe area: ${id}`)
  const reasons = [...document.issues.map((issue) => `${issue.pageId}/${issue.blockId}: ${issue.kind}`), ...safeAreaIssues]
  if (reasons.length > 0) throw new NewsletterOutputBlockedError(reasons)
  if (input.purpose !== "qa") {
    const pending = referencedDesignAssets(input.design, input.designRevision).filter(assetExportPending)
    if (pending.length > 0) throw new NewsletterOutputBlockedError(pending.map((asset) => `${asset.id}: print approval pending`))
  }
  abortIfNeeded(input.signal)
  await input.rasterizer.ensureFontReady()
  const assets = await resolveDesignAssets(input.design, input.designRevision, input.assetResolver)
  const a4Bytes = await input.rasterizer.rasterize({ svg: renderA4Svg(document.a4, assets), width: 2480, height: 3508, ...(input.signal === undefined ? {} : { signal: input.signal }) })
  assertDimensions(a4Bytes, 2480, 3508)
  const cardBytes: Uint8Array[] = []
  for (const page of document.cards) {
    abortIfNeeded(input.signal)
    const bytes = await input.rasterizer.rasterize({ svg: renderCardSvg(page, assets), width: 1800, height: 1800, ...(input.signal === undefined ? {} : { signal: input.signal }) })
    assertDimensions(bytes, 1800, 1800)
    cardBytes.push(bytes)
  }
  const a4PdfBytes = await input.pdfComposer.compose([{ pngBytes: a4Bytes, pageSize: A4_PAGE_POINTS }])
  const cardPdfPages: readonly PdfImagePage[] = cardBytes.map((pngBytes) => ({ pngBytes, pageSize: CARD_PAGE_POINTS }))
  const cardsPdfBytes = await input.pdfComposer.compose(cardPdfPages)
  abortIfNeeded(input.signal)
  const a4Png = await artifact("a4-page", "newsletter-a4.png", "image/png", a4Bytes)
  const cardPngs = await Promise.all(document.cards.map((page, index) => artifact(page.pageId, `${String(index + 1).padStart(2, "0")}-${page.pageId}.png`, "image/png", cardBytes[index] ?? new Uint8Array())))
  const a4Pdf = await artifact("a4-pdf", "newsletter-a4.pdf", "application/pdf", a4PdfBytes)
  const cardsPdf = await artifact("cards-pdf", "newsletter-cards.pdf", "application/pdf", cardsPdfBytes)
  const designSnapshot = input.design.revisionHistory.find((entry) => entry.revision === input.designRevision)?.snapshot
  if (designSnapshot === undefined) throw new NewsletterOutputBlockedError([`design revision ${input.designRevision} is missing`])
  const pngMetadata = { targetDpi: 300 as const, dpiMetadata: "not-embedded" as const }
  const manifest: OutputManifest = {
    ...(input.purpose === "qa" ? { reviewOnly: true as const } : {}),
    projectId: document.projectId,
    projectRevision: document.projectRevision,
    designRevision: document.designRevision,
    templateVersion: designSnapshot.templateVersion,
    assetSha256: designSnapshot.assetManifest.map((asset) => asset.sha256),
    createdAt: input.createdAt,
    outputs: [
      { stableId: a4Png.stableId, fileName: a4Png.fileName, outputType: "a4-png", sha256: a4Png.sha256, pixelSize: { width: 2480, height: 3508 }, ...pngMetadata },
      ...cardPngs.map((card) => ({ stableId: card.stableId, fileName: card.fileName, outputType: "card-png" as const, sha256: card.sha256, pixelSize: { width: 1800, height: 1800 }, ...pngMetadata })),
      { stableId: a4Pdf.stableId, fileName: a4Pdf.fileName, outputType: "a4-pdf", sha256: a4Pdf.sha256, pageSizePoints: A4_PAGE_POINTS, pageCount: 1 },
      { stableId: cardsPdf.stableId, fileName: cardsPdf.fileName, outputType: "cards-pdf", sha256: cardsPdf.sha256, pageSizePoints: CARD_PAGE_POINTS, pageCount: 7 },
    ],
  }
  return { a4Png, cardPngs, a4Pdf, cardsPdf, manifest }
}
