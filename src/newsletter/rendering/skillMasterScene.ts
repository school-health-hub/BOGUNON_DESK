import type { Frame, RenderPage, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { editorialActionIcon } from "./editorialIcons"
import { seasonalSceneLayers } from "./editorialScene"
import { SEPTEMBER_INNER_TEMPLATE, SEPTEMBER_INNER_TOKENS, septemberActionHighlights } from "./skillMasterCardDesign"
import { autumnBranchLayers, coughEtiquetteIllustration, healthShieldLayers, heartLayer, tissueThenWashIllustration } from "./skillMasterLocalIllustrations"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const safe = { x: 60, y: 60, width: 1080, height: 1080 }
const colors = ["#176B45", "#A77531", "#387C9D", "#77529A"] as const
function shape(id: string, frame: Frame, fill: string, radius = 0, stroke?: string, strokeWidth?: number): SceneLayer {
  return { kind: "shape", layerId: id, frame, fill, radius, zOrder: id.endsWith("-background") ? 0 : 2, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }), ...(strokeWidth === undefined ? {} : { strokeWidth }) }
}
function elevatedShape(id: string, frame: Frame, fill: string, radius = 0, stroke?: string): SceneLayer {
  return { kind: "shape", layerId: id, frame, fill, radius, zOrder: 5, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke }) }
}
function text(block: RenderTextBlock, group: string, textEffect?: Extract<SceneLayer, { readonly kind: "text" }>["textEffect"], highlights?: readonly string[]): SceneLayer { return { ...block, kind: "text", layerId: block.id, zOrder: 20, clipBounds: safe, collisionGroup: group, ...(textEffect === undefined ? {} : { textEffect }), ...(highlights === undefined || highlights.length === 0 ? {} : { highlights, highlightColor: SEPTEMBER_INNER_TOKENS.color.greenStrong }) } }
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
  const layers: SceneLayer[] = [shape(`${group}-background`, bounds, config === undefined ? page.background : SEPTEMBER_INNER_TOKENS.color.paper), shape(`${group}-border`, { x: 16, y: 16, width: 1168, height: 1168 }, "none", SEPTEMBER_INNER_TOKENS.radius.outer, SEPTEMBER_INNER_TOKENS.color.mintLine, 3)]
  if (config === undefined) return { pageId: page.pageId, width: 1200, height: 1200, templateVersion: page.templateVersion, layers }
  const cover = config.layoutType === "A"
  if (cover) layers.push(...seasonalSceneLayers(group, config.season, 80, 100))
  else layers.push(...autumnBranchLayers(`${group}-autumn`))
  layers.push(shape(`${group}-issue-pill-shadow`, { ...(cover ? { x: 390, y: 72, width: 420, height: 70 } : SEPTEMBER_INNER_TEMPLATE.badge), y: (cover ? 68 : SEPTEMBER_INNER_TEMPLATE.badge.y) + 5 }, "#0D4F31", cover ? 35 : SEPTEMBER_INNER_TOKENS.radius.pill))
  layers.push(shape(`${group}-issue-pill`, cover ? { x: 390, y: 68, width: 420, height: 70 } : SEPTEMBER_INNER_TEMPLATE.badge, SEPTEMBER_INNER_TOKENS.color.green, cover ? 35 : SEPTEMBER_INNER_TOKENS.radius.pill))
  if (!cover) layers.push(heartLayer(`${group}-badge-heart-left`, { x: 392, y: 87, width: 30, height: 30 }), heartLayer(`${group}-badge-heart-right`, { x: 778, y: 87, width: 30, height: 30 }))
  layers.push(text(page.title, group, cover ? undefined : { stroke: SEPTEMBER_INNER_TOKENS.color.titleOutline, strokeWidth: 3.5, shadow: { color: SEPTEMBER_INNER_TOKENS.color.titleShadow, dx: 0, dy: 5, blur: 2.5 } }))
  if (page.badge !== undefined) layers.push(text(page.badge, group))
  if (page.lead !== undefined && page.lead.text.length > 0) layers.push(text(page.lead, group))
  if (!cover) {
    layers.push(
      shape(`${group}-lead-rule-left`, SEPTEMBER_INNER_TEMPLATE.leadRuleLeft, SEPTEMBER_INNER_TOKENS.color.mintLine, 1),
      shape(`${group}-lead-rule-right`, SEPTEMBER_INNER_TEMPLATE.leadRuleRight, SEPTEMBER_INNER_TOKENS.color.mintLine, 1),
      ...healthShieldLayers(`${group}-health`, { x: 1025, y: 178, width: 74, height: 74 }),
      shape(`${group}-image-surface`, { x: page.image.frame.x - 5, y: page.image.frame.y - 5, width: page.image.frame.width + 10, height: page.image.frame.height + 10 }, SEPTEMBER_INNER_TOKENS.color.paper, SEPTEMBER_INNER_TOKENS.radius.image, SEPTEMBER_INNER_TOKENS.color.mintLine),
    )
  }
  if (page.image.assetId === undefined) layers.push(...missingArt(page, group))
  else layers.push({ kind: "image", ...page.image, layerId: `${group}-main-art`, zOrder: 10, clipBounds: cover ? safe : bounds, collisionGroup: `${group}-main-art`, placeholderKind: "generic" })
  if (cover) {
    for (const [index, topic] of (page.topicOverview ?? []).entries()) {
      const color = colors[index] ?? colors[0]
      layers.push(shape(`${group}-preview-${index}`, { x: 90 + index * 255, y: 875, width: 245, height: 190 }, "#FFFEF8", 24, "#D6DFC9"))
      layers.push(elevatedShape(`${group}-preview-icon-surface-${index}`, { x: 105 + index * 255, y: 902, width: 32, height: 32 }, "#F0F7F1", 16, color))
      layers.push(text(topic, group))
      layers.push(editorialActionIcon(`${group}-preview-icon-${index}`, topic.text, { x: 112 + index * 255, y: 909, width: 18, height: 18 }, color))
    }
  } else {
    for (const [index, module] of config.modules.entries()) {
      const miniArt = SEPTEMBER_INNER_TEMPLATE.miniArt[index]
      if (miniArt === undefined) continue
      layers.push(shape(`${group}-mini-art-surface-${index}`, miniArt, SEPTEMBER_INNER_TOKENS.color.mint, SEPTEMBER_INNER_TOKENS.radius.miniArt, SEPTEMBER_INNER_TOKENS.color.mintLine))
      if (module.image?.assetId === undefined) {
        if (index === 1) layers.push(...coughEtiquetteIllustration(`${group}-cough`, miniArt))
        else if (index === 2) layers.push(...tissueThenWashIllustration(`${group}-tissue-wash`, miniArt))
        else layers.push({ kind: "text", layerId: `${group}-mini-art-missing-${index}`, frame: { x: miniArt.x + 10, y: miniArt.y + 36, width: miniArt.width - 20, height: 44 }, zOrder: 20, clipBounds: miniArt, collisionGroup: `${group}-mini-art-${index}`, text: "미니 삽화\n필요", lines: ["미니 삽화", "필요"], style: { ...page.body.style, ...SEPTEMBER_INNER_TOKENS.type.missingArt, color: SEPTEMBER_INNER_TOKENS.color.green, align: "center" }, provenance: { kind: "template-static", templateVersion: page.templateVersion } })
      } else {
        layers.push({ kind: "image", ...module.image, layerId: `${group}-mini-art-${index}`, zOrder: 14, clipBounds: miniArt, placeholderKind: "generic" })
      }
      layers.push(text(module.action, group, undefined, septemberActionHighlights(module.action.text)))
      if (index < config.modules.length - 1) layers.push(shape(`${group}-action-divider-${index}`, { x: 680, y: module.frame.y + module.frame.height - 1, width: 430, height: 1 }, SEPTEMBER_INNER_TOKENS.color.divider))
    }
  }
  if (page.closing !== undefined && page.closing.text.length > 0) {
    const closingText = cover ? page.closing : { ...page.closing, frame: { ...page.closing.frame, y: page.closing.frame.y + 15 } }
    layers.push(shape(`${group}-closing-surface`, page.closing.frame, SEPTEMBER_INNER_TOKENS.color.paper, cover ? 28 : SEPTEMBER_INNER_TOKENS.radius.closing, SEPTEMBER_INNER_TOKENS.color.mintLine, 2), text(closingText, group))
    if (!cover) layers.push(heartLayer(`${group}-closing-heart-left`, { x: page.closing.frame.x + 24, y: page.closing.frame.y + 24, width: 28, height: 28 }), heartLayer(`${group}-closing-heart-right`, { x: page.closing.frame.x + page.closing.frame.width - 52, y: page.closing.frame.y + 24, width: 28, height: 28 }))
  }
  if (page.mascot?.assetId !== undefined) layers.push({ kind: "image", ...page.mascot, layerId: `${group}-mascot`, edgePolicy: "none", zOrder: 26, clipBounds: cover ? safe : bounds, ...(cover ? { collisionGroup: group } : {}), placeholderKind: "generic" })
  if (page.seasonalDecoration?.assetId !== undefined) layers.push({ kind: "image", ...page.seasonalDecoration, layerId: `${group}-decoration`, zOrder: 6, clipBounds: safe, placeholderKind: "generic" })
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
