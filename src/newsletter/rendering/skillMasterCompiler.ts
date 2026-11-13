import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"

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
  const modules = cover ? [] : actions.slice(0, 4).map((action, index) => {
    const y = 405 + index * 150
    const frame = { x: 620, y, width: 500, height: 138 }
    return { frame,
      number: make(`${page.pageId}-master-number-${index}`, String(index + 1), { x: 636, y: y + 13, width: 32, height: 28 }, { ...layout.bodyStyle, fontSize: 18, lineHeight: 1.2, fontWeight: 800, color: "#FFFFFF", align: "center" }, { kind: "template-static", templateVersion: page.templateVersion }),
      action: make(`${page.pageId}-master-action-${index}`, action.replace(prefix, ""), { x: 730, y: y + 16, width: 370, height: 110 }, { ...layout.bodyStyle, fontSize: 25, fontWeight: 750, lineHeight: 1.32 }, page.body.provenance),
    }
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 4).map((topic, index) => make(topic.id, topic.text, { x: 145 + index * 255, y: 905, width: 178, height: 140 }, { ...layout.bodyStyle, fontSize: 20, fontWeight: 750, align: "left", lineHeight: 1.25 }, topic.provenance)) : page.topicOverview
  const closingText = config.closing ?? page.closing?.text ?? ""
  const closingProvenance: TextProvenance = config.closing === undefined && page.closing !== undefined ? page.closing.provenance : { kind: "design-text", pageId: page.pageId, field: "closing" }
  return { ...page, editorial: { layoutType: config.layoutType, compositionPreset: "september-master", season: config.season, studentComposition: config.studentComposition, modules },
    ...(topicOverview === undefined ? {} : { topicOverview }),
    badge: page.badge === undefined ? undefined : make(page.badge.id, page.badge.text, { x: 405, y: 78, width: 390, height: 48 }, { ...page.badge.style, fontSize: 27, color: "#FFFFFF", align: "center" }, page.badge.provenance),
    title: make(page.title.id, page.title.text, layout.titleFrame, { ...page.title.style, fontSize: titleSize(page.title.text, cover), lineHeight: 1.12, align: "center" }, page.title.provenance),
    lead: make(`${page.pageId}-master-lead`, config.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), layout.leadFrame, { ...layout.bodyStyle, fontSize: 31, fontWeight: 650, align: "center" }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-master-closing`, closingText, layout.closingFrame, { ...layout.bodyStyle, fontSize: 25, fontWeight: 650, color: "#175D3A", align: "center" }, closingProvenance, false),
  }
}
