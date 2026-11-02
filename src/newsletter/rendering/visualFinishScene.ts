import type { Frame, RenderImage, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { seasonalSceneLayers } from "./editorialScene"
import { VISUAL_FINISH } from "./editorialVisualFinish"
import { illustratedActionScene } from "./illustratedActionScene"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
const pales = ["#FBECEF", "#E8F5EF", "#E9F4FA", "#FBF1DE"] as const
const accents = ["#B64C67", "#267E6E", "#387C9D", "#A77531"] as const
function shape(id: string, frame: Frame, fill: string, zOrder: number, radius = 0, stroke?: string): SceneLayer { return { kind: "shape", layerId: id, frame, fill, zOrder, radius, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) } }
function text(block: RenderTextBlock, group: string): SceneLayer { return { ...block, kind: "text", layerId: block.id, zOrder: 30, clipBounds: safe, collisionGroup: group } }
function image(id: string, source: RenderImage, zOrder: number): SceneLayer { return { kind: "image", ...source, layerId: id, zOrder, clipBounds: safe, placeholderKind: "generic" } }
export function buildVisualFinishScene(page: RenderPage): NewsletterPageScene {
  const config = page.editorial
  const id = `${page.pageId}-finish`
  const layers: SceneLayer[] = [shape(`${id}-background`, bounds, page.background, 0), shape(`${id}-border`, { x: 28, y: 28, width: 1144, height: 1144 }, "none", 1, 32, "#85B299")]
  if (config === undefined) return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
  const cover = config.layoutType === "A"
  const panel = config.layoutType === "B"
  layers.push(...seasonalSceneLayers(id, config.season), text(page.title, id))
  if (page.badge !== undefined) layers.push(text(page.badge, id))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(text(page.lead, id))
  if (cover || !panel) layers.push(image(`${id}-main-scene`, page.image, 10))
  if (cover) {
    for (const [index, topic] of (page.topicOverview ?? []).entries()) {
      const frame = VISUAL_FINISH.previews[index]
      if (frame === undefined) continue
      layers.push({ kind: "path", layerId: `${id}-preview-medallion-${index}`, frame, path: "M2 8Q2 1 12 1Q21 0 23 8Q26 18 20 22Q10 26 3 21Q0 16 2 8Z", fill: pales[index] ?? pales[0], stroke: "#FFFFFF", strokeWidth: .3, zOrder: 13, clipBounds: safe })
      const preview = config.previewImages?.[index]
      if (preview?.assetId !== undefined) layers.push(image(`${id}-preview-art-${index}`, preview, 16))
      else layers.push(...illustratedActionScene(`${id}-preview-${index}`, topic.text, { x: frame.x + 65, y: frame.y + 80, width: 115, height: 115 }, safe))
      layers.push(text(topic, id))
    }
  } else {
    for (const [index, module] of config.modules.entries()) {
      const accent = accents[index] ?? accents[0]
      if (panel) {
        layers.push(shape(`${id}-panel-${index}`, module.frame, pales[index] ?? pales[0], 2, 26), shape(`${id}-number-surface-${index}`, { x: module.number.frame.x - 4, y: module.number.frame.y - 3, width: 56, height: 48 }, accent, 5, 15))
      } else layers.push(shape(`${id}-story-ground-${index}`, { x: module.frame.x + 8, y: module.frame.y + 154, width: module.frame.width - 16, height: 38 }, pales[index] ?? pales[0], 3, 19))
      if (module.image !== undefined) layers.push(image(`${id}-action-scene-${index}`, module.image, 10))
      else layers.push(...illustratedActionScene(`${id}-action-${index}`, module.action.text, { x: module.frame.x + (panel ? 100 : 30), y: module.frame.y + (panel ? 110 : 5), width: 180, height: 180 }, safe))
      layers.push(text(module.number, id), text(module.action, id))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) layers.push(shape(`${id}-closing-banner`, page.closing.frame, "#E9F2E6", 3, 28), text(page.closing, id))
  if (page.mascot?.assetId !== undefined) layers.push(image(`${id}-mascot`, page.mascot, 24))
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
