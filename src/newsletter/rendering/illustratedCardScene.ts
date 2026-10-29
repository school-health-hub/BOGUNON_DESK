import type { Frame, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { seasonalSceneLayers } from "./editorialScene"
import { illustratedActionScene } from "./illustratedActionScene"
import { ILLUSTRATED_CARD } from "./illustratedCardLayout"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
function shape(id: string, frame: Frame, fill: string, zOrder: number, radius = 0, stroke?: string): SceneLayer { return { kind: "shape", layerId: id, frame, fill, zOrder, radius, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) } }
function text(block: RenderTextBlock, group: string): SceneLayer { return { ...block, kind: "text", layerId: block.id, zOrder: 25, clipBounds: safe, collisionGroup: group } }
export function buildIllustratedCardScene(page: RenderPage): NewsletterPageScene {
  const config = page.editorial
  const id = `${page.pageId}-illustrated`
  const layers: SceneLayer[] = [shape(`${id}-background`, bounds, page.background, 0), shape(`${id}-border`, { x: 28, y: 28, width: 1144, height: 1144 }, "none", 1, 34, "#85B299")]
  if (config === undefined) return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
  const cover = config.layoutType === "A"
  layers.push({ kind: "path", layerId: `${id}-campus-field`, frame: { x: 65, y: 370, width: 1070, height: 680 }, path: "M0 18Q5 9 10 15Q16 6 24 13L24 24H0Z", fill: "#E5EED7", stroke: "none", strokeWidth: 0, zOrder: 3, clipBounds: safe })
  layers.push(...seasonalSceneLayers(id, config.season, 85, 90), ...seasonalSceneLayers(`${id}-lower`, config.season, 940, 1050))
  layers.push(shape(`${id}-issue-pill`, { x: 385, y: 68, width: 430, height: 70 }, "#176B45", 4, 35), text(page.title, id))
  if (page.badge !== undefined) layers.push(text(page.badge, id))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(text(page.lead, id))
  layers.push({ kind: "image", ...page.image, layerId: `${id}-main-students`, edgePolicy: "none", zOrder: 12, clipBounds: safe, placeholderKind: "generic" })
  if (cover) {
    for (const [index, topic] of (page.topicOverview ?? []).entries()) {
      const frame = ILLUSTRATED_CARD.previewFrames[index]
      if (frame === undefined) continue
      const size = Math.min(140, frame.height - 75)
      layers.push(...illustratedActionScene(`${id}-preview-${index}`, topic.text, { x: frame.x + (frame.width - size) / 2, y: frame.y, width: size, height: size }, safe), text(topic, id))
    }
  } else {
    for (const [index, module] of config.modules.entries()) {
      layers.push(...illustratedActionScene(`${id}-action-scene-${index}`, module.action.text, { x: module.frame.x + 66, y: module.frame.y + 5, width: 145, height: 145 }, safe))
      layers.push(text(module.number, id), text(module.action, id))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) layers.push(shape(`${id}-closing-surface`, page.closing.frame, "#F4F8EE", 4, 30, "#B8CFB1"), text(page.closing, id))
  if (page.mascot?.assetId !== undefined) layers.push({ kind: "image", ...page.mascot, layerId: `${id}-otter`, edgePolicy: "none", zOrder: 18, clipBounds: safe, placeholderKind: "generic" })
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
