import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import { SEPTEMBER_INNER_TEMPLATE, SEPTEMBER_INNER_TOKENS, septemberInnerActionStyle, septemberInnerTitleStyle } from "./skillMasterCardDesign"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
const prefix = /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u

function titleSize(text: string, cover: boolean): number {
  if (cover) return text.length > 24 ? 72 : text.length > 16 ? 84 : 98
  return text.length > 24 ? 56 : text.length > 16 ? 68 : 82
}

export function compileSkillMaster(page: RenderPage, layout: CardDesignLayoutV2, content: StructuredSectionText, make: Make): RenderPage {
  const config = layout.editorial
  if (config === undefined) return page
  const cover = config.layoutType === "A"
  const actions = content.kind === "list" ? content.actions : []
  const modules = cover ? [] : actions.slice(0, 4).flatMap((action, index) => {
    const frame = SEPTEMBER_INNER_TEMPLATE.actions[index]
    const actionFrame = SEPTEMBER_INNER_TEMPLATE.actionText[index]
    const miniArtFrame = SEPTEMBER_INNER_TEMPLATE.miniArt[index]
    if (frame === undefined || actionFrame === undefined || miniArtFrame === undefined) return []
    const sourceImage = config.moduleImages?.[index]
    return [{ frame,
      number: make(`${page.pageId}-master-number-${index}`, String(index + 1), { x: miniArtFrame.x, y: miniArtFrame.y, width: 1, height: 1 }, { ...layout.bodyStyle, fontSize: 1, fontWeight: 400, lineHeight: 1, color: "transparent" }, { kind: "template-static", templateVersion: page.templateVersion }, false),
      action: make(`${page.pageId}-master-action-${index}`, action.replace(prefix, ""), actionFrame, { ...layout.bodyStyle, ...septemberInnerActionStyle(action), color: SEPTEMBER_INNER_TOKENS.color.body }, page.body.provenance),
      ...(sourceImage?.assetId === undefined ? {} : { image: { ...sourceImage, frame: miniArtFrame, fit: "contain" as const, edgePolicy: "none" as const } }),
    }]
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 4).map((topic, index) => make(topic.id, topic.text, { x: 145 + index * 255, y: 905, width: 178, height: 140 }, { ...layout.bodyStyle, fontSize: 20, fontWeight: 750, align: "left", lineHeight: 1.25 }, topic.provenance)) : page.topicOverview
  const closingText = config.closing ?? page.closing?.text ?? ""
  const closingProvenance: TextProvenance = config.closing === undefined && page.closing !== undefined ? page.closing.provenance : { kind: "design-text", pageId: page.pageId, field: "closing" }
  return { ...page, editorial: { layoutType: config.layoutType, compositionPreset: "september-master", season: config.season, studentComposition: config.studentComposition, modules },
    ...(!cover ? { image: { ...page.image, frame: SEPTEMBER_INNER_TEMPLATE.image, fit: "cover" as const, edgePolicy: "rounded" as const } } : {}),
    ...(topicOverview === undefined ? {} : { topicOverview }),
    badge: page.badge === undefined ? undefined : make(page.badge.id, page.badge.text, cover ? { x: 405, y: 78, width: 390, height: 48 } : SEPTEMBER_INNER_TEMPLATE.badge, { ...page.badge.style, ...(cover ? { fontSize: 27, fontWeight: 700, lineHeight: 1.2 } : SEPTEMBER_INNER_TOKENS.type.badge), color: "#FFFFFF", align: "center" }, page.badge.provenance),
    title: make(page.title.id, page.title.text, cover ? layout.titleFrame : SEPTEMBER_INNER_TEMPLATE.title, { ...page.title.style, ...(cover ? { fontSize: titleSize(page.title.text, true), fontWeight: 800, lineHeight: 1.12 } : septemberInnerTitleStyle(page.title.text)), color: SEPTEMBER_INNER_TOKENS.color.ink, align: "center" }, page.title.provenance),
    lead: make(`${page.pageId}-master-lead`, config.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), cover ? layout.leadFrame : SEPTEMBER_INNER_TEMPLATE.lead, { ...layout.bodyStyle, ...(cover ? { fontSize: 31, fontWeight: 650, lineHeight: 1.3 } : SEPTEMBER_INNER_TOKENS.type.lead), color: SEPTEMBER_INNER_TOKENS.color.body, align: "center" }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-master-closing`, closingText, cover ? layout.closingFrame : SEPTEMBER_INNER_TEMPLATE.closing, { ...layout.bodyStyle, ...(cover ? { fontSize: 25, fontWeight: 650, lineHeight: 1.3 } : SEPTEMBER_INNER_TOKENS.type.closing), color: SEPTEMBER_INNER_TOKENS.color.greenStrong, align: "center" }, closingProvenance, false),
  }
}
