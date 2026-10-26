import { semanticHashSync } from "../hash"
import type { Frame, RenderDocument, RenderImage, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import type { TextStyle } from "./designSchema"

export const NEWSLETTER_PLACEHOLDER_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e7ece9'/%3E%3Cpath d='M16 42l10-12 8 8 7-9 9 13z' fill='%2399aaa2'/%3E%3C/svg%3E"

type SceneBase = { readonly layerId: string; readonly frame: Frame; readonly zOrder: number; readonly clipBounds: Frame; readonly collisionGroup?: string }
export type TextSceneLayer = SceneBase & { readonly kind: "text"; readonly text: string; readonly lines: readonly string[]; readonly style: TextStyle; readonly provenance: TextProvenance }
export type ImageSceneLayer = SceneBase & { readonly kind: "image"; readonly slotId: string; readonly assetId?: string; readonly fit: "contain" | "cover" }
export type ShapeSceneLayer = SceneBase & { readonly kind: "shape"; readonly fill: string; readonly stroke?: string; readonly radius?: number }
export type SceneLayer = TextSceneLayer | ImageSceneLayer | ShapeSceneLayer
export type NewsletterPageScene = { readonly pageId: string; readonly width: number; readonly height: number; readonly templateVersion: number; readonly layers: readonly SceneLayer[] }
export type NewsletterScene = { readonly projectId: string; readonly projectRevision: number; readonly designRevision: number; readonly pages: readonly NewsletterPageScene[] }
export type SceneValidationIssue = { readonly kind: "layout-collision" | "clip-bounds"; readonly pageId: string; readonly layerId: string; readonly message: string }

function pageBounds(width: number, height: number): Frame { return { x: 0, y: 0, width, height } }
function textLayer(block: RenderTextBlock, zOrder: number, clipBounds: Frame, collisionGroup: string): TextSceneLayer {
  return { kind: "text", layerId: block.id, frame: block.frame, zOrder, clipBounds, collisionGroup, text: block.text, lines: block.lines, style: block.style, provenance: block.provenance }
}
function imageLayer(pageId: string, image: RenderImage, zOrder: number, clipBounds: Frame, collisionGroup: string): ImageSceneLayer {
  return { kind: "image", layerId: `${pageId}-${image.slotId}`, frame: image.frame, zOrder, clipBounds, collisionGroup, slotId: image.slotId, ...(image.assetId === undefined ? {} : { assetId: image.assetId }), fit: image.fit }
}
function nonEmpty(block: RenderTextBlock | undefined): block is RenderTextBlock { return block !== undefined && block.text.length > 0 }

export function buildCardScene(page: RenderPage): NewsletterPageScene {
  const bounds = pageBounds(page.width, page.height)
  const safe = { x: 60, y: 60, width: page.width - 120, height: page.height - 120 }
  const content = `content-${page.pageId}`
  const layers: SceneLayer[] = [
    { kind: "shape", layerId: `${page.pageId}-background`, frame: bounds, zOrder: 0, clipBounds: bounds, fill: page.background },
    ...(page.accent === undefined ? [] : [{ kind: "shape" as const, layerId: `${page.pageId}-accent`, frame: { x: 60, y: 60, width: 12, height: 1080 }, zOrder: 1, clipBounds: safe, fill: page.accent, radius: 6 }]),
    imageLayer(page.pageId, page.image, 10, safe, content),
    textLayer(page.title, 20, safe, content),
    ...(nonEmpty(page.lead) ? [textLayer(page.lead, 21, safe, content)] : []),
    textLayer(page.body, 22, safe, content),
    ...(nonEmpty(page.closing) ? [textLayer(page.closing, 23, safe, content)] : []),
  ]
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}

export function buildNewsletterScene(document: RenderDocument): NewsletterScene {
  const page = document.a4
  const a4 = buildA4PageScene(page)
  return { projectId: document.projectId, projectRevision: document.projectRevision, designRevision: document.designRevision, pages: [a4, ...document.cards.map(buildCardScene)] }
}

export function buildA4PageScene(page: RenderDocument["a4"]): NewsletterPageScene {
  const bounds = pageBounds(page.width, page.height)
  const safe = { x: page.safeMargin, y: page.safeMargin, width: page.width - page.safeMargin * 2, height: page.height - page.safeMargin * 2 }
  const layers: SceneLayer[] = [
    { kind: "shape", layerId: "a4-background", frame: bounds, zOrder: 0, clipBounds: bounds, fill: page.background },
    textLayer(page.title, 20, safe, "a4-header"),
    textLayer(page.publicationMeta, 21, safe, "a4-header"),
    ...page.modules.flatMap((module, index): readonly SceneLayer[] => {
      const group = `a4-module-${index + 1}`
      return [
        { kind: "shape", layerId: `${module.moduleId}-surface`, frame: module.moduleFrame, zOrder: 2, clipBounds: safe, fill: "#ffffff", stroke: module.accent ?? "#d8e2dc", radius: 18 },
        imageLayer("a4-page", module.image, 10, module.moduleFrame, group),
        textLayer(module.title, 20, module.moduleFrame, group),
        ...(nonEmpty(module.lead) ? [textLayer(module.lead, 21, module.moduleFrame, group)] : []),
        textLayer(module.body, 22, module.moduleFrame, group),
        ...(nonEmpty(module.closing) ? [textLayer(module.closing, 23, module.moduleFrame, group)] : []),
      ]
    }),
    textLayer(page.footer, 30, safe, "a4-footer"),
  ]
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}

export function buildA4Scene(document: RenderDocument): NewsletterPageScene {
  return buildA4PageScene(document.a4)
}

function inside(inner: Frame, outer: Frame): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height
}
function intersects(left: Frame, right: Frame): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

export function validateNewsletterScene(scene: NewsletterScene): readonly SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = []
  for (const page of scene.pages) {
    for (const layer of page.layers) {
      if (!inside(layer.frame, layer.clipBounds)) issues.push({ kind: "clip-bounds", pageId: page.pageId, layerId: layer.layerId, message: `${layer.layerId}이 허용된 clip 경계를 벗어납니다.` })
    }
    const exclusive = page.layers.filter((layer) => layer.collisionGroup !== undefined)
    for (let leftIndex = 0; leftIndex < exclusive.length; leftIndex += 1) {
      const left = exclusive[leftIndex]
      if (left === undefined) continue
      for (let rightIndex = leftIndex + 1; rightIndex < exclusive.length; rightIndex += 1) {
        const right = exclusive[rightIndex]
        if (right === undefined || left.collisionGroup !== right.collisionGroup || !intersects(left.frame, right.frame)) continue
        issues.push({ kind: "layout-collision", pageId: page.pageId, layerId: `${left.layerId}+${right.layerId}`, message: `${left.layerId}과 ${right.layerId}이 겹칩니다.` })
      }
    }
  }
  return issues
}

export function validateNewsletterDocument(document: RenderDocument): readonly SceneValidationIssue[] { return validateNewsletterScene(buildNewsletterScene(document)) }
export function newsletterSceneHash(scene: NewsletterScene): string { return semanticHashSync(scene) }
export function newsletterPageSceneHash(scene: NewsletterPageScene): string { return semanticHashSync(scene) }
