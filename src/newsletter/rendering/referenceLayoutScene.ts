import type { Frame, RenderImage, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { seasonalSceneLayers } from "./editorialScene"
import { editorialActionIcon } from "./editorialIcons"
import { REFERENCE_LAYOUT } from "./referenceLayout"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
const pales = ["#FBECEF", "#E8F5EF", "#E9F4FA", "#FBF1DE"] as const
const accents = ["#B64C67", "#267E6E", "#387C9D", "#A77531"] as const
function shape(id: string, frame: Frame, fill: string, zOrder: number, radius = 0, stroke?: string): SceneLayer { return { kind: "shape", layerId: id, frame, fill, zOrder, radius, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) } }
function text(block: RenderTextBlock, group: string): SceneLayer { return { ...block, kind: "text", layerId: block.id, zOrder: 30, clipBounds: safe, collisionGroup: group } }
function image(id: string, value: RenderImage, zOrder: number): SceneLayer { return { ...value, kind: "image", layerId: id, zOrder, clipBounds: safe, placeholderKind: "generic" } }
function bubble(id: string, frame: Frame, fill: string, zOrder: number): SceneLayer { return { kind: "path", layerId: id, frame, path: "M2 5Q1 1 6 1H19Q24 1 23 6V17Q23 21 18 21H12L8 24L9 21H6Q1 21 2 16Z", fill, stroke: "#FFFFFF", strokeWidth: .25, zOrder, clipBounds: safe } }

export function buildReferenceLayoutScene(page: RenderPage): NewsletterPageScene {
  const config = page.editorial
  const id = `${page.pageId}-reference`
  const layers: SceneLayer[] = [shape(`${id}-paper`, bounds, page.background, 0)]
  if (config === undefined) return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
  const cover = config.layoutType === "A"
  const panel = config.layoutType === "B"
  layers.push(shape(`${id}-border`, { x: 28, y: 28, width: 1144, height: 1144 }, "none", 1, 28, "#85B299"), ...seasonalSceneLayers(`${id}-top-season`, config.season, 68, 180), ...seasonalSceneLayers(`${id}-bottom-season`, config.season, 65, 1090))
  if (cover) layers.push(image(`${id}-campus-students`, page.image, 4))
  layers.push(text(page.title, `${id}-header`))
  if (page.badge !== undefined) layers.push(text(page.badge, `${id}-meta`))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(shape(`${id}-theme-band`, { x: page.lead.frame.x - 18, y: page.lead.frame.y - 8, width: page.lead.frame.width + 36, height: page.lead.frame.height + 8 }, cover ? "#FBECEF" : "#E8F5EF", 3, 35), text(page.lead, `${id}-header`))
  if (cover) {
    for (const [index, topic] of (page.topicOverview ?? []).entries()) {
      const frame = REFERENCE_LAYOUT.previews[index]
      if (frame === undefined) continue
      layers.push({ kind: "path", layerId: `${id}-topic-bubble-${index}`, frame, path: "M2 8Q2 1 12 1Q21 0 23 8Q26 18 20 22Q10 26 3 21Q0 16 2 8Z", fill: pales[index] ?? pales[0], stroke: "#FFFFFF", strokeWidth: .3, zOrder: 9, clipBounds: safe })
      const art = config.previewImages?.[index]
      if (art !== undefined) layers.push(image(`${id}-topic-art-${index}`, art, 11))
      layers.push(text(topic, `${id}-preview-${index}`))
    }
    if (config.foregroundMask?.assetId === page.image.assetId) layers.push(image(`${id}-student-foreground`, { ...page.image, slotId: `${page.image.slotId}-foreground`, clipPolygon: config.foregroundMask }, 15))
  } else {
    if (!panel) layers.push(shape(`${id}-story-field`, { x: 60, y: 330, width: 560, height: 685 }, "#FBECEF", 2, 20), image(`${id}-main-life-scene`, page.image, 10))
    for (const [index, module] of config.modules.entries()) {
      const accent = accents[index] ?? accents[0]
      const color = pales[index] ?? pales[0]
      if (panel) {
        if (index === 1) layers.push(bubble(`${id}-education-panel-${index}`, module.frame, color, 2))
        else layers.push(shape(`${id}-education-panel-${index}`, index === 2 ? { ...module.frame, y: module.frame.y + 85, height: module.frame.height - 85 } : module.frame, color, 2, index === 3 ? 12 : 28, "#D8E2DC"))
        layers.push(shape(`${id}-number-badge-${index}`, { x: module.number.frame.x - 4, y: module.number.frame.y - 4, width: 58, height: 50 }, accent, 8, 15))
        if (index === 0 || index === 2) layers.push(editorialActionIcon(`${id}-action-prop-${index}`, `${module.action.text} ${module.description?.text ?? ""}`, { x: module.frame.x + 40, y: module.frame.y + 253, width: 78, height: 78 }, accent))
        if (index === 3) layers.push(bubble(`${id}-report-speech`, { x: module.frame.x + 70, y: module.frame.y + 12, width: module.frame.width - 86, height: 140 }, "#FFFFFF", 3))
      } else {
        layers.push(shape(`${id}-life-ground-${index}`, module.frame, color, 2, index % 2 === 0 ? 18 : 6))
        if (module.caption !== undefined) layers.push(bubble(`${id}-life-caption-field-${index}`, { x: module.frame.x + 4, y: module.frame.y + 4, width: module.frame.width - 8, height: 112 }, "#FFFFFF", 12), text(module.caption, `${id}-caption-${index}`))
      }
      if (module.image !== undefined) layers.push(image(`${id}-action-life-scene-${index}`, module.image, 10))
      layers.push(text(module.number, `${id}-action-${index}`), text(module.action, `${id}-action-${index}`))
      if (module.description !== undefined) layers.push(text(module.description, `${id}-action-${index}`))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) layers.push(shape(`${id}-closing-brush`, page.closing.frame, "#FBECEF", 14, 32), text(page.closing, `${id}-footer`))
  if (page.mascot?.assetId !== undefined) layers.push(image(`${id}-approved-mascot`, page.mascot, 25))
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
