import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
export function compileSkillMaster(page: RenderPage, layout: CardDesignLayoutV2, content: StructuredSectionText, make: Make): RenderPage {
  const config = layout.editorial
  if (config === undefined) return page
  const cover = config.layoutType === "A"
  const actions = content.kind === "list" ? content.actions : []
  const modules = cover ? [] : actions.slice(0, 4).map((action, index) => {
    const y = 420 + index * 145
    const frame = { x: 625, y, width: 485, height: 130 }
    return { frame,
      number: make(`${page.pageId}-master-number-${index}`, String(index + 1), { x: 630, y: y + 25, width: 56, height: 56 }, { ...layout.bodyStyle, fontSize: 30, lineHeight: 1.2, fontWeight: 800, color: "#176B45", align: "center" }, { kind: "template-static", templateVersion: page.templateVersion }),
      action: make(`${page.pageId}-master-action-${index}`, action.replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u, ""), { x: 715, y: y + 16, width: 385, height: 106 }, { ...layout.bodyStyle, fontSize: 32, fontWeight: 750, lineHeight: 1.3 }, page.body.provenance),
    }
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 4).map((topic, index) => make(topic.id, topic.text, { x: 105 + index * 255, y: 915, width: 225, height: 95 }, { ...layout.bodyStyle, fontSize: 27, fontWeight: 750, align: "center", lineHeight: 1.25 }, topic.provenance)) : page.topicOverview
  return { ...page, editorial: { layoutType: config.layoutType, compositionPreset: "september-master", season: config.season, studentComposition: config.studentComposition, modules },
    ...(topicOverview === undefined ? {} : { topicOverview }),
    badge: page.badge === undefined ? undefined : make(page.badge.id, page.badge.text, { x: 405, y: 78, width: 390, height: 48 }, { ...page.badge.style, fontSize: 27, color: "#FFFFFF", align: "center" }, page.badge.provenance),
    lead: make(`${page.pageId}-master-lead`, config.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), layout.leadFrame, { ...layout.bodyStyle, fontSize: 31, fontWeight: 650, align: "center" }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-master-closing`, config.closing ?? "", layout.closingFrame, { ...layout.bodyStyle, fontSize: 27, fontWeight: 650, color: "#175D3A", align: "center" }, { kind: "design-text", pageId: page.pageId, field: "closing" }, false),
  }
}
