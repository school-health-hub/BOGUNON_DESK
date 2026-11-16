import { imageFeatherGeometry } from "../rendering/imageFeather"
import { imagePolygonPoints } from "../rendering/imagePolygon"
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
  const highlights = layer.highlights ?? []
  const spans = layer.lines.map((line, index) => {
    const escaped = highlights.length === 0 ? escapeXml(line) : line.split(new RegExp(`(${highlights.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gu")).filter(value => value.length > 0).map(value => highlights.includes(value) ? `<tspan fill="${escapeXml(layer.highlightColor ?? layer.style.color)}" font-weight="800">${escapeXml(value)}</tspan>` : escapeXml(value)).join("")
    return `<tspan x="${horizontal.x}" y="${layer.frame.y + layer.style.fontSize + index * lineHeight}">${escaped}</tspan>`
  }).join("")
  const effect = layer.textEffect
  const stroke = effect?.stroke === undefined ? "" : ` stroke="${escapeXml(effect.stroke)}" stroke-width="${effect.strokeWidth ?? 1}" paint-order="stroke fill"`
  const filterId = `shadow-${layer.layerId}`.replace(/[^a-zA-Z0-9_-]/g, "-")
  const shadow = effect?.shadow
  const defs = shadow === undefined ? "" : `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur}" flood-color="${escapeXml(shadow.color)}"/></filter></defs>`
  const filter = shadow === undefined ? "" : ` filter="url(#${filterId})"`
  return `${defs}<text id="${escapeXml(layer.layerId)}" font-family="Pretendard" font-size="${layer.style.fontSize}" font-weight="${layer.style.fontWeight}" fill="${layer.style.color}" text-anchor="${horizontal.anchor}"${stroke}${filter}>${spans}</text>`
}
function renderImage(pageId: string, layer: ImageSceneLayer, assets: ReadonlyMap<string, string>): string {
  const clipId = `clip-${pageId}-${layer.slotId}`
  if (layer.clipPolygon !== undefined) {
    const { clipPolygon, ...unclipped } = layer
    return `<defs><clipPath id="${clipId}-polygon"><polygon points="${imagePolygonPoints(layer.frame, layer.fit, clipPolygon)}"/></clipPath></defs><g clip-path="url(#${clipId}-polygon)">${renderImage(pageId, unclipped, assets)}</g>`
  }
  const source = layer.assetId === undefined ? newsletterPlaceholderDataUrl(layer.placeholderKind) : assets.get(layer.assetId)
  if (source === undefined && layer.assetId !== undefined) throw new SvgAssetMissingError(layer.assetId)
  const aspect = layer.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
  const image = `<image id="${escapeXml(layer.layerId)}" href="${escapeXml(source ?? newsletterPlaceholderDataUrl("generic"))}" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" preserveAspectRatio="${aspect}"`
  if (layer.edgePolicy === "none") return `${image}/>`
  if (layer.edgePolicy === "feather") {
    const feather = imageFeatherGeometry(layer.frame)
    return `<defs><filter id="${clipId}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${feather.blur}"/></filter><mask id="${clipId}-feather" maskUnits="userSpaceOnUse" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}"><rect x="${feather.x}" y="${feather.y}" width="${feather.width}" height="${feather.height}" rx="${feather.radius}" fill="white" filter="url(#${clipId}-blur)"/></mask></defs>${image} mask="url(#${clipId}-feather)"/>`
  }
  if (layer.edgePolicy === "soft") return `<defs><radialGradient id="${clipId}-fade"><stop offset="65%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="${clipId}-soft" maskUnits="userSpaceOnUse" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}"><rect x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" fill="url(#${clipId}-fade)"/></mask></defs>${image} mask="url(#${clipId}-soft)"/>`
  return `<defs><clipPath id="${clipId}"><rect x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" rx="12"/></clipPath></defs><image id="${escapeXml(layer.layerId)}" href="${escapeXml(source ?? newsletterPlaceholderDataUrl("generic"))}" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" preserveAspectRatio="${aspect}" clip-path="url(#${clipId})"/>`
}
function renderShape(layer: ShapeSceneLayer): string {
  const stroke = layer.stroke === undefined ? "" : ` stroke="${layer.stroke}"`
  const strokeWidth = layer.strokeWidth === undefined ? "" : ` stroke-width="${layer.strokeWidth}"`
  return `<rect id="${escapeXml(layer.layerId)}" x="${layer.frame.x}" y="${layer.frame.y}" width="${layer.frame.width}" height="${layer.frame.height}" rx="${layer.radius ?? 0}" fill="${layer.fill}"${stroke}${strokeWidth}/>`
}
function renderLayer(pageId: string, layer: SceneLayer, assets: ReadonlyMap<string, string>): string {
  switch (layer.kind) {
    case "shape": return renderShape(layer)
    case "path": return `<path id="${escapeXml(layer.layerId)}" d="${escapeXml(layer.path)}" transform="translate(${layer.frame.x} ${layer.frame.y}) scale(${layer.frame.width / 24} ${layer.frame.height / 24})" fill="${escapeXml(layer.fill)}" stroke="${escapeXml(layer.stroke)}" stroke-width="${layer.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
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
