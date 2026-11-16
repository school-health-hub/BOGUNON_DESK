import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import { SEPTEMBER_INNER_TEMPLATE, SEPTEMBER_INNER_TOKENS, keepEditorialPhrases, septemberInnerActionStyle, septemberInnerTitleStyle } from "./skillMasterCardDesign"
import { layoutText } from "./typography"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
const prefix = /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u

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
    const cleanAction = action.replace(prefix, "")
    return [{ frame,
      number: make(`${page.pageId}-master-number-${index}`, String(index + 1), { x: miniArtFrame.x, y: miniArtFrame.y, width: 1, height: 1 }, { ...layout.bodyStyle, fontSize: 1, fontWeight: 400, lineHeight: 1, color: "transparent" }, { kind: "template-static", templateVersion: page.templateVersion }, false),
      action: keepEditorialPhrases(make(`${page.pageId}-master-action-${index}`, cleanAction, actionFrame, { ...layout.bodyStyle, ...septemberInnerActionStyle(cleanAction, actionFrame.width), color: SEPTEMBER_INNER_TOKENS.color.body }, page.body.provenance)),
      ...(sourceImage?.assetId === undefined ? {} : { image: { ...sourceImage, frame: miniArtFrame, fit: "contain" as const, edgePolicy: "none" as const } }),
    }]
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 6).map((topic, index) => make(topic.id, topic.text.split("\n")[0] ?? topic.text, { x: 175 + index % 3 * 365, y: 856 + Math.floor(index / 3) * 140, width: 220, height: 94 }, { ...layout.bodyStyle, fontSize: 24, fontWeight: 750, align: "left", lineHeight: 1.2 }, topic.provenance)) : page.topicOverview
  const closingText = config.closing ?? page.closing?.text ?? ""
  const leadText = config.slogan ?? (content.kind === "list" ? content.lead ?? "" : "")
  const titleStyle = septemberInnerTitleStyle(page.title.text)
  const wrappedTitle = !cover && layoutText(page.title.text, { ...page.title.style, ...titleStyle }, SEPTEMBER_INNER_TEMPLATE.title).lines.length > 1
  const leadFrame = wrappedTitle ? { ...SEPTEMBER_INNER_TEMPLATE.lead, y: 310 } : SEPTEMBER_INNER_TEMPLATE.lead
  let leadStyle: TextStyle = { ...layout.bodyStyle, ...SEPTEMBER_INNER_TOKENS.type.lead }
  if (!cover) {
    for (const fontSize of [29, 28, 26]) {
      leadStyle = { ...leadStyle, fontSize }
      if (!layoutText(leadText, leadStyle, leadFrame).overflow) break
    }
  }
  const coverTitle = page.title.text.replace(/\s+/gu, " ")
  const coverTitleStyle = { ...page.title.style, fontSize: 96, fontWeight: 900, lineHeight: 1.06, align: "center" as const }
  if (cover) {
    for (const fontSize of [96, 90, 84, 76, 68]) {
      coverTitleStyle.fontSize = fontSize
      if (!layoutText(coverTitle, coverTitleStyle, layout.titleFrame).overflow) break
    }
  }
  const closingProvenance: TextProvenance = config.closing === undefined && page.closing !== undefined ? page.closing.provenance : { kind: "design-text", pageId: page.pageId, field: "closing" }
  return { ...page, editorial: { layoutType: config.layoutType, compositionPreset: "september-master", season: config.season, studentComposition: config.studentComposition, modules },
    ...(!cover ? { image: { ...page.image, frame: SEPTEMBER_INNER_TEMPLATE.image, fit: layout.image.fit, edgePolicy: "rounded" as const } } : {}),
    ...(topicOverview === undefined ? {} : { topicOverview }),
    badge: page.badge === undefined ? undefined : make(page.badge.id, page.badge.text, cover ? { x: 405, y: 78, width: 390, height: 48 } : { ...SEPTEMBER_INNER_TEMPLATE.badge, y: SEPTEMBER_INNER_TEMPLATE.badge.y + 14, height: 42 }, { ...page.badge.style, ...(cover ? { fontSize: 27, fontWeight: 700, lineHeight: 1.2 } : SEPTEMBER_INNER_TOKENS.type.badge), color: "#FFFFFF", align: "center" }, page.badge.provenance),
    title: make(page.title.id, cover ? coverTitle : page.title.text, cover ? layout.titleFrame : SEPTEMBER_INNER_TEMPLATE.title, { ...page.title.style, ...(cover ? coverTitleStyle : septemberInnerTitleStyle(page.title.text)), color: SEPTEMBER_INNER_TOKENS.color.ink, align: cover ? "left" : "center" }, page.title.provenance),
    lead: make(`${page.pageId}-master-lead`, leadText, cover ? layout.leadFrame : leadFrame, { ...layout.bodyStyle, ...(cover ? { fontSize: 26, fontWeight: 650, lineHeight: 1.3 } : leadStyle), color: SEPTEMBER_INNER_TOKENS.color.body, align: "center" }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: keepEditorialPhrases(make(`${page.pageId}-master-closing`, closingText, cover ? layout.closingFrame : { x: SEPTEMBER_INNER_TEMPLATE.closing.x + 60, y: SEPTEMBER_INNER_TEMPLATE.closing.y + 18, width: SEPTEMBER_INNER_TEMPLATE.closing.width - 120, height: 72 }, { ...layout.bodyStyle, ...(cover ? { fontSize: 25, fontWeight: 650, lineHeight: 1.3 } : SEPTEMBER_INNER_TOKENS.type.closing), color: SEPTEMBER_INNER_TOKENS.color.greenStrong, align: "center" }, closingProvenance, false)),
  }
}
