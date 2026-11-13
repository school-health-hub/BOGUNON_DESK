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
function elevatedShape(id: string, frame: Frame, fill: string, radius = 0, stroke?: string): SceneLayer {
  return { kind: "shape", layerId: id, frame, fill, radius, zOrder: 5, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) }
}
function text(block: RenderTextBlock, group: string): SceneLayer { return { ...block, kind: "text", layerId: block.id, zOrder: 20, clipBounds: safe, collisionGroup: group } }
function missingArt(page: RenderPage, group: string): readonly SceneLayer[] {
  const frame = page.image.frame
  const textFrame = { x: frame.x + 40, y: frame.y + frame.height / 2 - 48, width: frame.width - 80, height: 96 }
  return [
    shape(`${group}-art-unassigned`, frame, "#F8F3E7", 32, "#A9C9BA"),
    { kind: "text", layerId: `${group}-art-unassigned-label`, frame: textFrame, zOrder: 20, clipBounds: safe, collisionGroup: `${group}-art-status`, text: "삽화 미지정\n검수용 미리보기", lines: ["삽화 미지정", "검수용 미리보기"], style: { ...page.body.style, fontSize: 26, fontWeight: 700, lineHeight: 1.45, color: "#45665A", align: "center" }, provenance: { kind: "template-static", templateVersion: page.templateVersion } },
  ]
}

export function buildSkillMasterScene(page: RenderPage): NewsletterPageScene {
  const config = page.editorial
  const group = `${page.pageId}-master`
  const layers: SceneLayer[] = [shape(`${group}-background`, bounds, page.background), shape(`${group}-border`, { x: 28, y: 28, width: 1144, height: 1144 }, "none", 34, "#85B299")]
  if (config === undefined) return { pageId: page.pageId, width: 1200, height: 1200, templateVersion: page.templateVersion, layers }
  layers.push(...seasonalSceneLayers(group, config.season, 80, 100), shape(`${group}-issue-pill`, { x: 390, y: 68, width: 420, height: 70 }, "#176B45", 35))
  layers.push(text(page.title, group))
  if (page.badge !== undefined) layers.push(text(page.badge, group))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(text(page.lead, group))
  if (page.image.assetId === undefined) layers.push(...missingArt(page, group))
  else layers.push({ kind: "image", ...page.image, layerId: `${group}-main-art`, zOrder: 10, clipBounds: safe, collisionGroup: `${group}-main-art`, placeholderKind: "generic" })
  if (config.layoutType === "A") {
    for (const [index, topic] of (page.topicOverview ?? []).entries()) {
      const color = colors[index] ?? colors[0]
      layers.push(shape(`${group}-preview-${index}`, { x: 90 + index * 255, y: 875, width: 245, height: 190 }, "#FFFEF8", 24, "#D6DFC9"))
      layers.push(elevatedShape(`${group}-preview-icon-surface-${index}`, { x: 105 + index * 255, y: 902, width: 32, height: 32 }, "#F0F7F1", 16, color))
      layers.push(text(topic, group))
      layers.push(editorialActionIcon(`${group}-preview-icon-${index}`, topic.text, { x: 112 + index * 255, y: 909, width: 18, height: 18 }, color))
    }
  } else {
    for (const [index, module] of config.modules.entries()) {
      const color = colors[index] ?? colors[0]
      layers.push(shape(`${group}-action-surface-${index}`, module.frame, index % 2 === 0 ? "#FFFDF8" : "#F5F9F2", 24, "#D4E3D7"))
      layers.push(elevatedShape(`${group}-action-circle-${index}`, { x: 634, y: module.frame.y + 34, width: 72, height: 72 }, "#EDF6EF", 24, color))
      layers.push({ kind: "shape", layerId: `${group}-action-number-${index}`, frame: { x: 630, y: module.frame.y + 8, width: 42, height: 34 }, fill: color, radius: 17, zOrder: 12, clipBounds: bounds })
      layers.push(text(module.number, group), text(module.action, group))
      layers.push(editorialActionIcon(`${group}-action-icon-${index}`, module.action.text, { x: 652, y: module.frame.y + 52, width: 36, height: 36 }, color))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) {
    layers.push(shape(`${group}-closing-surface`, page.closing.frame, "#F4F8EE", 32, "#B8CFB1"), text(page.closing, group))
  }
  if (page.mascot?.assetId !== undefined) layers.push({ kind: "image", ...page.mascot, layerId: `${group}-mascot`, edgePolicy: "none", zOrder: 26, clipBounds: safe, collisionGroup: group, placeholderKind: "generic" })
  if (page.seasonalDecoration?.assetId !== undefined) layers.push({ kind: "image", ...page.seasonalDecoration, layerId: `${group}-decoration`, zOrder: 6, clipBounds: safe, placeholderKind: "generic" })
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
