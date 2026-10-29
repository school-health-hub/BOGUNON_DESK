import { buildA4PageScene, buildCardScene, newsletterPageSceneHash, validateNewsletterScene, type ImageSceneLayer, type NewsletterPageScene, type SceneLayer, type ShapeSceneLayer, type TextSceneLayer } from "../rendering/renderScene"
import type { RenderDocument, RenderPage } from "../rendering/renderDocument"
import { newsletterPlaceholderDataUrl } from "../rendering/placeholders"

type A4Page = RenderDocument["a4"]
export class SvgAssetMissingError extends Error {
  readonly name = "SvgAssetMissingError"
  constructor(readonly assetId: string) { super(`resolved asset is missing: ${assetId}`) }
}
function escapeXml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;") }
function textAnchor(layer: TextSceneLayer): { readonly anchor: "start" | "middle" | "end"; readonly x: number } {
  switch (layer.style.align) {
    case "left": return { anchor: "start", x: layer.frame.x }
    case "center": return { anchor: "middle", x: layer.frame.x + layer.frame.width / 2 }
    case "right": return { anchor: "end", x: layer.frame.x + layer.frame.width }
  }
  throw new Error("Unsupported newsletter text alignment")
}
function renderText(layer: TextSceneLayer): string {
  const horizontal = textAnchor(layer)
  const lineHeight = layer.style.fontSize * layer.style.lineHeight
  const spans = layer.lines.map((line, index) => `<tspan x="${horizontal.x}" y="${layer.frame.y + layer.style.fontSize + index * lineHeight}">${escapeXml(line)}</tspan>`).join("")
  return `<text id="${escapeXml(layer.layerId)}" font-family="Pretendard" font-size="${layer.style.fontSize}" font-weight="${layer.style.fontWeight}" fill="${layer.style.color}" text-anchor="${horizontal.anchor}">${spans}</text>`
}
function renderImage(pageId: string, layer: ImageSceneLayer, assets: ReadonlyMap<string, string>): string {
  const clipId = `clip-${pageId}-${layer.slotId}`
  const source = layer.assetId === undefined ? newsletterPlaceholderDataUrl(layer.placeholderKind) : assets.get(layer.assetId)
  if (source === undefined && layer.assetId !== undefined) throw new SvgAssetMissingError(layer.assetId)
  const aspect = layer.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
  return `<defs><clipPath id="${clipId}"><rect x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" rx="12"/></clipPath></defs><image id="${escapeXml(layer.layerId)}" href="${escapeXml(source ?? newsletterPlaceholderDataUrl("generic"))}" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" preserveAspectRatio="${aspect}" clip-path="url(#${clipId})"/>`
}
function renderShape(layer: ShapeSceneLayer): string {
  const stroke = layer.stroke === undefined ? "" : ` stroke="${layer.stroke}"`
  return `<rect id="${escapeXml(layer.layerId)}" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" rx="${layer.radius ?? 0}" fill="${layer.fill}"${stroke}/>`
}
function renderLayer(pageId: string, layer: SceneLayer, assets: ReadonlyMap<string, string>): string {
  switch (layer.kind) {
    case "shape": return renderShape(layer)
    case "image": return renderImage(pageId, layer, assets)
    case "text": return renderText(layer)
  }
}
export function renderNewsletterSceneSvg(scene: NewsletterPageScene, assets: ReadonlyMap<string, string>): string {
  const layers = [...scene.layers].sort((left, right) => left.zOrder - right.zOrder || left.layerId.localeCompare(right.layerId)).map((layer) => renderLayer(scene.pageId, layer, assets)).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}" data-template-version="${scene.templateVersion}" data-scene-hash="${newsletterPageSceneHash(scene)}">${layers}</svg>`
}
export function validateA4SafeArea(page: A4Page): readonly string[] {
  const scene = buildA4PageScene(page)
  return validateNewsletterScene({ projectId: "validation", projectRevision: 1, designRevision: 1, pages: [scene] }).filter((issue) => issue.kind === "clip-bounds").map((issue) => issue.layerId)
}
export function renderCardSvg(page: RenderPage, assets: ReadonlyMap<string, string>): string { return renderNewsletterSceneSvg(buildCardScene(page), assets) }
export function renderA4Svg(page: A4Page, assets: ReadonlyMap<string, string>): string { return renderNewsletterSceneSvg(buildA4PageScene(page), assets) }
