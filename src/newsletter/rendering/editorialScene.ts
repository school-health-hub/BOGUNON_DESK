import { buildIllustratedCardScene } from "./illustratedCardScene"
import { buildSkillMasterScene } from "./skillMasterScene"
import type { Frame, RenderImage, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import type { EditorialLayout } from "./editorialLayout"
import { editorialFrames } from "./editorialLayout"
import { editorialActionIcon } from "./editorialIcons"

const PALES = ["#FBECEF", "#E8F5EF", "#E9F4FA", "#FBF1DE"] as const
const ACCENTS = ["#B64C67", "#267E6E", "#387C9D", "#A77531"] as const
const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
function shape(id: string, frame: Frame, fill: string, zOrder = 2, radius = 20, stroke?: string): SceneLayer {
  return { kind: "shape", layerId: id, frame, fill, radius, zOrder, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) }
}
function text(block: RenderTextBlock, group: string): SceneLayer {
  return { ...block, kind: "text", layerId: block.id, zOrder: 20, clipBounds: safe, collisionGroup: group }
}
function image(page: string, value: RenderImage, group: string): SceneLayer {
  return { kind: "image", layerId: `${page}-${value.slotId}`, ...value, zOrder: 10, clipBounds: safe, collisionGroup: group, placeholderKind: "generic" }
}
export function seasonalSceneLayers(id: string, season: EditorialLayout["season"], x = 990, y = 304): readonly SceneLayer[] {
  if (season === "none") return []
  const color = { spring: "#D59CA5", summer: "#79AD8D", autumn: "#CC9C50", winter: "#9DBECE" }[season]
  const path = season === "winter" ? "M12 2v20 M3 7l18 10 M3 17 21 7 M9 4l3 3 3-3 M9 20l3-3 3 3" : season === "autumn" ? "M12 2 14 8 19 5 17 11 23 12 17 15 19 20 13 18 12 23 10 18 4 20 6 15 1 12 7 11 5 5 10 8Z M12 12v12" : "M3 20Q-1 3 21 3Q21 25 3 20Z M3 20 16 8 M8 15l-1-5 M12 11h6"
  return Array.from({ length: 5 }, (_, i) => ({ kind: "path", layerId: `${id}-season-${i}`, frame: { x: x + i * 25, y: y + (i % 2) * 10, width: 20, height: 28 }, path, fill: season === "winter" ? "none" : color, stroke: color, strokeWidth: season === "winter" ? 1.4 : 0.7, zOrder: 1, clipBounds: bounds }))
}

export function buildEditorialCardScene(page: RenderPage): NewsletterPageScene {
  if (page.editorial?.compositionPreset === "illustrated-ab") return buildIllustratedCardScene(page)
  if (page.editorial?.compositionPreset === "september-master") return buildSkillMasterScene(page)
  const editorial = page.editorial
  const group = `editorial-${page.pageId}`
  const layers: SceneLayer[] = [shape(`${group}-background`, bounds, page.background, 0, 0), shape(`${group}-border`, { x: 28, y: 28, width: 1144, height: 1144 }, "none", 1, 32, "#85B299")]
  if (editorial === undefined) return { pageId: page.pageId, width: 1200, height: 1200, templateVersion: page.templateVersion, layers }
  layers.push(...seasonalSceneLayers(group, editorial.season))
  layers.push(shape(`${group}-header-rule`, { x: 80, y: 350, width: 1040, height: 2 }, "#B9CDBD", 1, 0))
  if (page.badge !== undefined) layers.push(text(page.badge, group))
  layers.push(text(page.title, group))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(text(page.lead, group))
  if (editorial.layoutType === "A") {
    layers.push(image(page.pageId, page.image, group))
    for (const [i, topic] of (page.topicOverview ?? []).entries()) {
      const frame = editorialFrames("A").moduleFrames[i]
      if (frame === undefined) continue
      layers.push(shape(`${group}-preview-${i}`, frame, PALES[i % 4] ?? PALES[0], 3, 30))
      layers.push(editorialActionIcon(`${group}-preview-prop-${i}`, topic.text, { x: frame.x + 16, y: frame.y + 25, width: 54, height: 54 }, ACCENTS[i % 4] ?? ACCENTS[0]))
      layers.push(text(topic, group))
    }
  } else {
    if (editorial.layoutType !== "B") layers.push(image(page.pageId, page.image, group))
    for (const [i, module] of editorial.modules.entries()) {
      const color = ACCENTS[i % 4] ?? ACCENTS[0]
      layers.push(shape(`${group}-module-${i}`, module.frame, PALES[i % 4] ?? PALES[0], 2, editorial.layoutType === "D" ? 24 : 20))
      layers.push(shape(`${group}-number-${i}`, { x: module.number.frame.x - 4, y: module.number.frame.y - 4, width: 56, height: 50 }, color, 5, 14))
      layers.push(text(module.number, group), text(module.action, group))
      if (module.image !== undefined) layers.push(image(page.pageId, module.image, group))
      else if (editorial.layoutType === "B" && module.action.lines.length < 4) {
        const size = module.action.lines.length < 3 ? 180 : 150
        layers.push(editorialActionIcon(`${group}-prop-${i}`, module.action.text, { x: module.frame.x + 290, y: module.frame.y + 135 + (180 - size), width: size, height: size }, color))
      } else if (editorial.layoutType === "C") {
        const size = module.action.lines.length < 4 ? 80 : 60
        layers.push(editorialActionIcon(`${group}-prop-${i}`, module.action.text, { x: module.frame.x + 120, y: module.frame.y + 200 + (80 - size), width: size, height: size }, color))
      } else if (editorial.layoutType === "D") layers.push(editorialActionIcon(`${group}-prop-${i}`, module.action.text, { x: module.frame.x + 82, y: module.frame.y + 40, width: 64, height: 64 }, color))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) {
    layers.push(shape(`${group}-closing-banner`, page.closing.frame, "#E9F2E6", 3, 30))
    layers.push(text(page.closing, group))
  }
  if (page.seasonalDecoration?.assetId !== undefined) layers.push(image(page.pageId, page.seasonalDecoration, `${group}-decoration`))
  if (page.mascot?.assetId !== undefined) layers.push(image(page.pageId, page.mascot, group))
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
