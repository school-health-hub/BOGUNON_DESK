import type { Frame, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { editorialActionIcon } from "./editorialIcons"
import { seasonalSceneLayers } from "./editorialScene"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
const colors = ["#176B45", "#A77531", "#387C9D", "#77529A"] as const
function shape(id: string, frame: Frame, fill: string, radius = 0, stroke?: string): SceneLayer {
  return { kind: "shape", layerId: id, frame, fill, radius, zOrder: id.endsWith("-background") ? 0 : 2, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) }
}
function text(block: RenderTextBlock, group: string): SceneLayer { return { ...block, kind: "text", layerId: block.id, zOrder: 20, clipBounds: safe, collisionGroup: group } }

export function buildSkillMasterScene(page: RenderPage): NewsletterPageScene {
  const config = page.editorial
  const group = `${page.pageId}-master`
  const layers: SceneLayer[] = [shape(`${group}-background`, bounds, page.background), shape(`${group}-border`, { x: 28, y: 28, width: 1144, height: 1144 }, "none", 34, "#85B299")]
  if (config === undefined) return { pageId: page.pageId, width: 1200, height: 1200, templateVersion: page.templateVersion, layers }
  layers.push(...seasonalSceneLayers(group, config.season, 80, 100), shape(`${group}-issue-pill`, { x: 390, y: 68, width: 420, height: 70 }, "#176B45", 35))
  layers.push(text(page.title, group))
  if (page.badge !== undefined) layers.push(text(page.badge, group))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(text(page.lead, group))
  layers.push({ kind: "image", ...page.image, layerId: `${group}-main-art`, zOrder: 10, clipBounds: safe, collisionGroup: `${group}-main-art`, placeholderKind: "generic" })
  if (config.layoutType === "A") {
    for (const [index, topic] of (page.topicOverview ?? []).entries()) {
      layers.push(shape(`${group}-preview-${index}`, { x: 90 + index * 255, y: 885, width: 245, height: 165 }, "#FFFEF8", 24, "#D6DFC9"))
      layers.push(text(topic, group))
      layers.push(editorialActionIcon(`${group}-preview-icon-${index}`, topic.text, { x: 190 + index * 255, y: 1010, width: 40, height: 32 }, colors[index] ?? colors[0]))
    }
  } else {
    for (const [index, module] of config.modules.entries()) {
      const color = colors[index] ?? colors[0]
      layers.push(shape(`${group}-action-circle-${index}`, { x: 625, y: module.frame.y + 20, width: 70, height: 70 }, "#F1F7ED", 35, "#B8CFB1"))
      layers.push(text(module.number, group), text(module.action, group))
      layers.push(shape(`${group}-action-rule-${index}`, { x: 715, y: module.frame.y + 129, width: 385, height: 1 }, "#D9E5D3"))
      layers.push(editorialActionIcon(`${group}-action-icon-${index}`, module.action.text, { x: 594, y: module.frame.y + 90, width: 30, height: 30 }, color))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) {
    layers.push(shape(`${group}-closing-surface`, page.closing.frame, "#F4F8EE", 32, "#B8CFB1"), text(page.closing, group))
  }
  if (page.mascot?.assetId !== undefined) layers.push({ kind: "image", ...page.mascot, layerId: `${group}-mascot`, edgePolicy: "none", zOrder: 26, clipBounds: safe, collisionGroup: group, placeholderKind: "generic" })
  if (page.seasonalDecoration?.assetId !== undefined) layers.push({ kind: "image", ...page.seasonalDecoration, layerId: `${group}-decoration`, zOrder: 6, clipBounds: safe, placeholderKind: "generic" })
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
