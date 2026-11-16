import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2, type TextStyle } from "./designSchema"
import type { Frame, RenderDocument, RenderTextBlock } from "./renderDocument"
import type { NewsletterPageScene, SceneLayer } from "./renderScene"
import { structureCanonicalText } from "./contentStructure"
import { layoutText } from "./typography"
import { autumnBranchLayers, heartLayer } from "./skillMasterLocalIllustrations"

export const SEPTEMBER_A4_VERSION = "september-a4-1"
export function supportsSkillMasterA4(page: RenderDocument["a4"]): boolean {
  return page.modules.every(module => {
    const content = structureCanonicalText(module.body.provenance.kind === "canonical-section" ? module.body.provenance.sourceText : module.body.text)
    return content.kind === "list" && content.actions.length === 4
  })
}
const accents = ["#307348", "#A46E34", "#347B9A", "#806196", "#39867C", "#427456"] as const
export function applySeptemberA4Preset(design: NewsletterDesignStateV2, now: string): NewsletterDesignStateV2 {
  const brand = design.a4Layout.brand
  if (brand === undefined) throw new Error("A4 brand is required")
  const modules = design.a4Layout.modules.map((module, i) => {
    const frame = { x: 59 + i % 2 * 572, y: 300 + Math.floor(i / 2) * 370, width: 550, height: 352 }
    const image = design.cardLayouts[i + 1]?.image ?? module.image
    return { ...module, frame, accent: accents[i] ?? accents[0],
      titleFrame: { x: frame.x + 65, y: frame.y + 10, width: 468, height: 64 },
      leadFrame: { x: frame.x + 16, y: frame.y + 80, width: 176, height: 1 },
      actionListFrame: { x: frame.x + 222, y: frame.y + 83, width: 311, height: 256 },
      closingFrame: { x: frame.x + 16, y: frame.y + 340, width: 518, height: 1 },
      image: { ...image, slotId: module.image.slotId, frame: { x: frame.x + 12, y: frame.y + 83, width: 180, height: 252 }, edgePolicy: "rounded" as const },
    }
  })
  const a4Layout = { ...design.a4Layout, background: "#FFFEFB", titleFrame: { x: 75, y: 65, width: 880, height: 105 }, publicationMetaFrame: { x: 75, y: 225, width: 850, height: 40 }, modules, footerFrame: { x: 75, y: 1650, width: 1090, height: 35 },
    brand: { ...brand, compositionPreset: "september-master" as const, editorialLayout: true as const,
      mascot: { ...brand.mascot, visible: true, frame: { x: 955, y: 42, width: 220, height: 225 }, fit: "contain" as const },
      seasonalDecoration: { ...brand.seasonalDecoration, visible: false },
      utilityFrame: { x: 79, y: 1445, width: 510, height: 100 }, closingFrame: { x: 650, y: 1445, width: 510, height: 100 },
    } }
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, assetManifest: design.assetManifest, a4Layout, cardLayouts: design.cardLayouts }
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...design, a4Layout, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: now, changedPageIds: ["a4-page"], snapshotVersion: 2, snapshot }] })
}

/** Same Scene vocabulary and SVG renderer as cards; no flattened page artwork. */
export function buildSkillMasterA4Scene(page: RenderDocument["a4"]): NewsletterPageScene {
  const bounds = { x: 0, y: 0, width: page.width, height: page.height }
  const safe = { x: 59, y: 59, width: 1122, height: 1636 }
  const layers: SceneLayer[] = []
  let paintOrder = 0
  const shape = (id: string, frame: Frame, fill: string, stroke?: string, radius = 0): void => { layers.push({ kind: "shape", layerId: id, frame, fill, ...(stroke === undefined ? {} : { stroke, strokeWidth: 1.5 }), radius, zOrder: paintOrder += 0.01, clipBounds: bounds }) }
  const text = (block: RenderTextBlock, frame: Frame, fontSize: number, color: string, weight = 600, align: TextStyle["align"] = "left"): void => {
    const style: TextStyle = { ...block.style, fontSize, color, fontWeight: weight, lineHeight: 1.23, align }
    const result = layoutText(block.text, style, frame)
    if (result.overflow) throw new Error(`A4 text does not fit: ${block.id}`)
    layers.push({ ...block, kind: "text", layerId: block.id, frame, lines: result.lines, style, zOrder: 20, clipBounds: safe, collisionGroup: block.id })
  }
  shape("a4-background", bounds, page.background)
  if (page.editorialSeason === "autumn") layers.push(...autumnBranchLayers("a4-autumn").filter(layer => layer.frame.y < 200).map(layer => ({ ...layer, frame: { x: layer.frame.x * 0.34, y: layer.frame.y * 0.34, width: layer.frame.width * 0.34, height: layer.frame.height * 0.34 }, clipBounds: bounds })))
  text(page.title, page.title.frame, 76, "#102B50", 900)
  const staticBlock = (id: string, value: string): RenderTextBlock => ({ ...page.title, id, text: value, lines: [value], provenance: { kind: "template-static", templateVersion: page.templateVersion } })
  text(staticBlock("a4-theme", "함께 지키는 건강한 학교생활"), { x: 80, y: 177, width: 810, height: 36 }, 27, "#307348", 700)
  shape("a4-school-field", { ...page.publicationMeta.frame, x: 59, width: 870, y: 219, height: 53 }, "#F6F9EE", "#8AB890", 18)
  text(page.publicationMeta, page.publicationMeta.frame, 23, "#305346", 650)
  if (page.mascot?.assetId !== undefined) layers.push({ ...page.mascot, kind: "image", layerId: "a4-mascot", zOrder: 10, clipBounds: bounds, placeholderKind: "generic" })
  for (const [index, module] of page.modules.entries()) {
    const f = module.moduleFrame, color = module.accent ?? accents[0]
    shape(`${module.moduleId}-surface`, f, "#FFFDF7", color, 20)
    shape(`${module.moduleId}-header`, { x: f.x + 2, y: f.y + 2, width: f.width - 4, height: 72 }, "#F0F5EA", undefined, 18)
    shape(`${module.moduleId}-number`, { x: f.x + 12, y: f.y + 16, width: 42, height: 42 }, color, undefined, 21)
    text(staticBlock(`${module.moduleId}-number-label`, String(index + 1).padStart(2, "0")), { x: f.x + 12, y: f.y + 22, width: 42, height: 31 }, 24, "#FFFFFF", 800, "center")
    text(module.title, module.title.frame, 26, color, 800)
    layers.push({ ...module.image, kind: "image", layerId: `${module.moduleId}-main-art`, zOrder: 10, clipBounds: f, placeholderKind: "generic" })
    const source = module.body.provenance.kind === "canonical-section" ? module.body.provenance.sourceText : module.body.text
    const content = structureCanonicalText(source)
    if (content.kind !== "list" || content.actions.length !== 4) throw new Error(`A4 needs exactly four canonical actions: ${module.sectionId}`)
    const actions = content.actions.map(action => action.replace(/^\s*(?:\d+[.)]|[-*•])\s+/u, ""))
    const style: TextStyle = { ...module.body.style, fontSize: 20, fontWeight: 600, lineHeight: 1.23, color: "#243C43", align: "left" }
    const frame = module.body.frame
    const rows = actions.map(action => layoutText(action, style, frame))
    const heights = rows.map(row => row.requiredHeight)
    const used = heights.reduce((sum, height) => sum + height, 0)
    if (used + 15 > frame.height) throw new Error(`A4 actions exceed print area: ${module.sectionId}`)
    const gap = Math.min(13, (frame.height - used) / 3)
    let y = frame.y
    actions.forEach((action, i) => {
      const height = heights[i] ?? 0
      shape(`${module.moduleId}-action-${i}-dot`, { x: f.x + 197, y: y + 3, width: 20, height: 20 }, color, undefined, 10)
      text(staticBlock(`${module.moduleId}-action-${i}-number`, String(i + 1)), { x: f.x + 197, y: y + 4, width: 20, height: 20 }, 15, "#FFFFFF", 800, "center")
      text({ ...module.body, id: `${module.moduleId}-action-${i}`, text: action }, { ...frame, y, height: height + 1 }, 20, style.color)
      y += height + gap
    })
  }
  for (const [index, block] of [page.utility, page.closing].entries()) {
    if (block === undefined) continue
    shape(`a4-guidance-${index}`, { x: block.frame.x - 20, y: 1430, width: 550, height: 130 }, index === 0 ? "#EFF5EC" : "#FAF1E2", "#B8CEAE", 18)
    text(block, block.frame, 23, "#315443", 650)
  }
  shape("a4-closing-strip", { x: 59, y: 1580, width: 1122, height: 52 }, "#E6F0E3", undefined, 26)
  text(staticBlock("a4-health-message", "내 생활에서 바꿀 한 가지, 함께 실천하는 건강한 11월"), { x: 110, y: 1591, width: 1020, height: 33 }, 25, "#28523B", 750, "center")
  layers.push({ ...heartLayer("a4-closing-heart", { x: 75, y: 1594, width: 25, height: 25 }), clipBounds: bounds })
  text(page.footer, page.footer.frame, 17, "#53635B", 500)
  return { pageId: page.pageId, width: page.width, height: page.height, templateVersion: page.templateVersion, layers }
}
