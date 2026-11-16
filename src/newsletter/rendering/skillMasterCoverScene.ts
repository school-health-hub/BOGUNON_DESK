import type { Frame, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { autumnBranchLayers, healthShieldLayers, heartLayer } from "./skillMasterLocalIllustrations"
import { educationArtLayers, type EducationArt } from "./skillMasterEducationArt"
import { SEPTEMBER_INNER_TOKENS } from "./skillMasterCardDesign"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
export const SEPTEMBER_COVER_VERSION = "november-reference-cover-3-final"
const palette = SEPTEMBER_INNER_TOKENS.color
function surface(id: string, frame: Frame, fill: string, radius: number, stroke?: string, zOrder = 2): SceneLayer {
  return { kind: "shape", layerId: id, frame, fill, radius, zOrder, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke, strokeWidth: 1.5 }) }
}
function copy(block: RenderTextBlock, overrides: Partial<RenderTextBlock> = {}): SceneLayer {
  return { ...block, ...overrides, kind: "text", layerId: block.id, zOrder: 20, clipBounds: safe }
}
function previewArt(title: string): EducationArt | undefined {
  if (/손|위생/u.test(title)) return "wash"
  if (/추워|날씨|안전/u.test(title)) return "warm"
  if (/리듬|수면/u.test(title)) return "sleep"
  if (/마음/u.test(title)) return "planning"
  if (/식사|급식/u.test(title)) return "meal"
  if (/경계/u.test(title)) return "consent"
  return undefined
}

/** Reference-led cover: live text, one text-free student scene, original mascot. */
export function buildSkillMasterCoverScene(page: RenderPage): NewsletterPageScene {
  const id = `${page.pageId}-master`
  const layers: SceneLayer[] = [
    surface(`${id}-background`, bounds, palette.paper, 0, undefined, 0),
    surface(`${id}-border`, { x: 16, y: 16, width: 1168, height: 1168 }, "none", 34, palette.mintLine),
    surface(`${id}-brand-shadow`, { x: 365, y: 62, width: 470, height: 59 }, "#0D4F31", 30),
    surface(`${id}-brand-pill`, { x: 365, y: 57, width: 470, height: 59 }, palette.green, 30, undefined, 3),
    { kind: "text", layerId: `${id}-brand-label`, frame: { x: 375, y: 69, width: 450, height: 39 }, text: "보건실이 전하는 건강이야기", lines: ["보건실이 전하는 건강이야기"], style: { ...page.title.style, fontSize: 29, fontWeight: 750, color: "#FFFFFF", align: "center", lineHeight: 1.1 }, provenance: { kind: "template-static", templateVersion: page.templateVersion }, zOrder: 20, clipBounds: safe },
    heartLayer(`${id}-brand-heart-left`, { x: 315, y: 77, width: 27, height: 27 }),
    heartLayer(`${id}-brand-heart-right`, { x: 858, y: 77, width: 27, height: 27 }),
  ]
  layers.push(...autumnBranchLayers(`${id}-autumn`).map(layer => layer.frame.y < 900 ? layer : { ...layer, frame: { x: 5 + layer.frame.x * 0.3, y: layer.frame.y, width: layer.frame.width * 0.3, height: layer.frame.height * 0.5 } }))
  layers.push(copy(page.title, { style: { ...page.title.style, align: "center", color: palette.ink } }))
  layers.push(surface(`${id}-title-underline`, { x: 465, y: 245, width: 540, height: 8 }, "#C1DDAE", 4))
  if (page.lead !== undefined) layers.push(copy(page.lead))
  layers.push(...healthShieldLayers(`${id}-health`, { x: 1080, y: 170, width: 60, height: 64 }))
  if (page.image.assetId !== undefined) layers.push(
    surface(`${id}-scene-mat`, { x: page.image.frame.x - 7, y: page.image.frame.y - 7, width: page.image.frame.width + 14, height: page.image.frame.height + 14 }, "#FFFEF8", 28, "#D4E0C8"),
    { kind: "image", ...page.image, layerId: `${id}-student-scene`, zOrder: 10, clipBounds: bounds, placeholderKind: "generic" },
  )
  if (page.mascot?.assetId !== undefined) layers.push({ kind: "image", ...page.mascot, layerId: `${id}-mascot`, zOrder: 24, clipBounds: bounds, placeholderKind: "generic" })
  if (page.seasonalDecoration?.assetId !== undefined) layers.push({ kind: "image", ...page.seasonalDecoration, layerId: `${id}-decoration`, zOrder: 6, clipBounds: safe, placeholderKind: "generic" })
  if (page.closing !== undefined) {
    layers.push(surface(`${id}-closing-strip`, { x: 65, y: 752, width: 1070, height: 62 }, "#EFF6EB", 31, palette.mintLine), copy(page.closing))
    layers.push(heartLayer(`${id}-closing-left`, { x: 90, y: 773, width: 24, height: 24 }), heartLayer(`${id}-closing-right`, { x: 1085, y: 773, width: 24, height: 24 }))
  }
  for (const [index, topic] of (page.topicOverview ?? []).slice(0, 6).entries()) {
    const x = 60 + index % 3 * 365, y = 840 + Math.floor(index / 3) * 140
    layers.push(surface(`${id}-preview-surface-${index}`, { x, y, width: 350, height: 125 }, "#FFFCF2", 19, "#A8C6AA"), copy(topic))
    const art = previewArt(topic.text)
    if (art !== undefined) {
      const frame = { x: x + 12, y: y + 18, width: 94, height: 90 }
      layers.push({ kind: "path", layerId: `${id}-preview-shadow-${index}`, frame, path: "M2 22Q12 19.6 22 22Q12 24 2 22Z", fill: "#E5E5D6", stroke: "none", strokeWidth: 0, zOrder: 13, clipBounds: bounds })
      layers.push(...educationArtLayers(art, `${id}-preview-art-${index}`, frame).map(layer => layer.kind === "path" ? { ...layer, strokeWidth: layer.strokeWidth * 1.2 } : layer))
    }
  }
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
