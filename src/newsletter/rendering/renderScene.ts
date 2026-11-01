import { semanticHashSync } from "../hash"
import type { Frame, RenderDocument, RenderImage, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import type { TextStyle } from "./designSchema"
import { newsletterPlaceholderDataUrl, placeholderKindForSlot, type NewsletterPlaceholderKind } from "./placeholders"
import { buildEditorialCardScene, seasonalSceneLayers } from "./editorialScene"

export const NEWSLETTER_PLACEHOLDER_DATA_URL = newsletterPlaceholderDataUrl("generic")

type SceneBase = { readonly layerId: string; readonly frame: Frame; readonly zOrder: number; readonly clipBounds: Frame; readonly collisionGroup?: string }
export type TextSceneLayer = SceneBase & { readonly kind: "text"; readonly text: string; readonly lines: readonly string[]; readonly style: TextStyle; readonly provenance: TextProvenance }
export type ImageSceneLayer = SceneBase & { readonly edgePolicy?: "rounded" | "none" | "soft"; readonly kind: "image"; readonly slotId: string; readonly assetId?: string; readonly fit: "contain" | "cover"; readonly placeholderKind: NewsletterPlaceholderKind }
export type ShapeSceneLayer = SceneBase & { readonly kind: "shape"; readonly fill: string; readonly stroke?: string; readonly radius?: number }
export type PathSceneLayer = SceneBase & { readonly kind: "path"; readonly path: string; readonly fill: string; readonly stroke: string; readonly strokeWidth: number }
export type SceneLayer = TextSceneLayer | ImageSceneLayer | ShapeSceneLayer | PathSceneLayer
export type NewsletterPageScene = { readonly pageId: string; readonly width: number; readonly height: number; readonly templateVersion: number; readonly layers: readonly SceneLayer[] }
export type NewsletterScene = { readonly projectId: string; readonly projectRevision: number; readonly designRevision: number; readonly pages: readonly NewsletterPageScene[] }
export type SceneValidationIssue = { readonly kind: "layout-collision" | "clip-bounds"; readonly pageId: string; readonly layerId: string; readonly message: string }

function pageBounds(width: number, height: number): Frame { return { x: 0, y: 0, width, height } }
function textLayer(block: RenderTextBlock, zOrder: number, clipBounds: Frame, collisionGroup: string): TextSceneLayer {
  return { kind: "text", layerId: block.id, frame: block.frame, zOrder, clipBounds, collisionGroup, text: block.text, lines: block.lines, style: block.style, provenance: block.provenance }
}
function imageLayer(pageId: string, image: RenderImage, zOrder: number, clipBounds: Frame, collisionGroup?: string): ImageSceneLayer {
  return { kind: "image", layerId: `${pageId}-${image.slotId}`, frame: image.frame, zOrder, clipBounds, ...(collisionGroup === undefined ? {} : { collisionGroup }), slotId: image.slotId, ...(image.assetId === undefined ? {} : { assetId: image.assetId }), ...(image.edgePolicy === undefined ? {} : { edgePolicy: image.edgePolicy }), fit: image.fit, placeholderKind: placeholderKindForSlot(image.slotId) }
}
function nonEmpty(block: RenderTextBlock | undefined): block is RenderTextBlock { return block !== undefined && block.text.length > 0 }

export function buildCardScene(page: RenderPage): NewsletterPageScene {
  if (page.editorial !== undefined) return buildEditorialCardScene(page)
  const bounds = pageBounds(page.width, page.height)
  const safe = { x: 60, y: 60, width: page.width - 120, height: page.height - 120 }
  const content = `content-${page.pageId}`
  const layers: SceneLayer[] = [
    { kind: "shape", layerId: `${page.pageId}-background`, frame: bounds, zOrder: 0, clipBounds: bounds, fill: page.background },
    ...(page.structured ? [{ kind: "shape" as const, layerId: `${page.pageId}-outer-border`, frame: { x: 28, y: 28, width: 1144, height: 1144 }, zOrder: 1, clipBounds: bounds, fill: "none", stroke: page.accent ?? "#4f9178", radius: 34 }] : []),
    ...(page.accent === undefined ? [] : [
      { kind: "shape" as const, layerId: `${page.pageId}-accent`, frame: { x: 60, y: 60, width: 12, height: 1080 }, zOrder: 1, clipBounds: safe, fill: page.accent, radius: 6 },
      { kind: "shape" as const, layerId: `${page.pageId}-image-mat`, frame: { x: page.image.frame.x - 12, y: page.image.frame.y - 12, width: page.image.frame.width + 24, height: page.image.frame.height + 24 }, zOrder: 8, clipBounds: safe, fill: "#fffdf8", stroke: page.accent, radius: 26 },
    ]),
    ...(page.badge === undefined ? [] : [{ kind: "shape" as const, layerId: `${page.pageId}-badge-surface`, frame: { ...page.badge.frame, x: page.badge.frame.x - 16, width: page.badge.frame.width + 24 }, zOrder: 8, clipBounds: safe, fill: "#fffdf8", stroke: page.accent ?? "#d8e2dc", radius: 18 }]),
    imageLayer(page.pageId, page.image, 10, safe, content),
    textLayer(page.title, 20, safe, content),
    ...(nonEmpty(page.badge) ? [textLayer(page.badge, 20, safe, content)] : []),
    ...(nonEmpty(page.lead) ? [textLayer(page.lead, 21, safe, content)] : []),
    ...(page.topicOverview === undefined ? [textLayer(page.body, 22, safe, content)] : page.topicOverview.flatMap((topic, index): readonly SceneLayer[] => [
      { kind: "shape", layerId: `${topic.id}-surface`, frame: { x: topic.frame.x - 16, y: topic.frame.y - 14, width: topic.frame.width + 32, height: topic.frame.height + 28 }, zOrder: 18, clipBounds: safe, fill: index % 2 === 0 ? "#fffdf8" : "#f7f2e8", stroke: page.accent ?? "#d8e2dc", radius: 18 },
      textLayer(topic, 22, safe, content),
    ])),
    ...(nonEmpty(page.closing) ? [textLayer(page.closing, 23, safe, content)] : []),
    ...(page.seasonalDecoration === undefined ? [] : [imageLayer(page.pageId, page.seasonalDecoration, 6, safe)]),
    ...(page.mascot === undefined ? [] : [imageLayer(page.pageId, page.mascot, 26, safe)]),
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
        { kind: "shape", layerId: `${module.moduleId}-surface`, frame: module.moduleFrame, zOrder: 2, clipBounds: safe, fill: "#fffdf8", stroke: module.accent ?? "#d8e2dc", radius: 18 },
        ...(module.accent === undefined ? [] : [{ kind: "shape" as const, layerId: `${module.moduleId}-accent`, frame: { x: module.moduleFrame.x, y: module.moduleFrame.y, width: module.moduleFrame.width, height: 8 }, zOrder: 3, clipBounds: module.moduleFrame, fill: module.accent, radius: 4 }]),
        ...(module.image.edgePolicy === undefined || module.image.edgePolicy === "rounded" ? [{ kind: "shape" as const, layerId: `${module.moduleId}-image-mat`, frame: { x: module.image.frame.x - 8, y: module.image.frame.y - 8, width: module.image.frame.width + 16, height: module.image.frame.height + 16 }, zOrder: 8, clipBounds: module.moduleFrame, fill: "#f7f2e8", stroke: module.accent ?? "#d8e2dc", radius: 16 }] : []),
        imageLayer("a4-page", module.image, 10, module.moduleFrame, group),
        ...(module.number === undefined ? [] : [
          { kind: "shape" as const, layerId: `${module.moduleId}-number-badge`, frame: { x: module.moduleFrame.x + 10, y: module.moduleFrame.y + 10, width: 44, height: 44 }, zOrder: 19, clipBounds: module.moduleFrame, fill: module.accent ?? "#4f9178", radius: 22 },
          textLayer(module.number, 20, module.moduleFrame, group),
        ]),
        textLayer(module.title, 20, module.moduleFrame, group),
        ...(nonEmpty(module.lead) ? [textLayer(module.lead, 21, module.moduleFrame, group)] : []),
        textLayer(module.body, 22, module.moduleFrame, group),
        ...(page.editorialLayout === true && nonEmpty(module.closing) ? [{ kind: "shape" as const, layerId: `${module.moduleId}-closing-banner`, frame: { x: module.closing.frame.x - 6, y: module.closing.frame.y - 4, width: module.closing.frame.width + 12, height: module.closing.frame.height + 4 }, zOrder: 18, clipBounds: module.moduleFrame, fill: "#EDF5EF", radius: 14 }] : []),
        ...(nonEmpty(module.closing) ? [textLayer(module.closing, 23, module.moduleFrame, group)] : []),
      ]
    }),
    textLayer(page.footer, 30, safe, "a4-footer"),
    ...(page.utility === undefined ? [] : [
      { kind: "shape" as const, layerId: "a4-utility-surface", frame: page.editorialLayout === true ? { x: page.utility.frame.x - 16, y: page.utility.frame.y - 16, width: page.utility.frame.width + 32, height: page.utility.frame.height + 32 } : page.utility.frame, zOrder: 18, clipBounds: safe, fill: "#edf6ef", stroke: "#4f9178", radius: 18 },
      textLayer(page.utility, 20, safe, "a4-utility"),
    ]),
    ...(page.closing === undefined ? [] : [
      { kind: "shape" as const, layerId: "a4-closing-surface", frame: page.editorialLayout === true ? { x: page.closing.frame.x - 16, y: page.closing.frame.y - 16, width: page.closing.frame.width + 32, height: page.closing.frame.height + 32 } : page.closing.frame, zOrder: 18, clipBounds: safe, fill: "#fff3df", stroke: "#d98251", radius: 18 },
      textLayer(page.closing, 20, safe, "a4-closing"),
    ]),
    ...(page.editorialSeason === undefined ? page.seasonalDecoration === undefined ? [] : [imageLayer("a4-page", page.seasonalDecoration, 6, safe)] : [...seasonalSceneLayers("a4-editorial", page.editorialSeason, 80, 80), ...(page.seasonalDecoration?.assetId === undefined ? [] : [imageLayer("a4-page", page.seasonalDecoration, 6, safe)])]),
    ...(page.mascot === undefined ? [] : [imageLayer("a4-page", page.mascot, 26, safe)]),
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
