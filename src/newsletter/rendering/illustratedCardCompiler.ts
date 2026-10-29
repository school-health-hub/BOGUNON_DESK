import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import { ILLUSTRATED_CARD } from "./illustratedCardLayout"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
export function compileIllustratedCard(page: RenderPage, layout: CardDesignLayoutV2, content: StructuredSectionText, make: Make): RenderPage {
  const config = layout.editorial
  if (config === undefined) return page
  const cover = config.layoutType === "A"
  const actions = content.kind === "list" ? content.actions : []
  const modules = cover ? [] : actions.slice(0, 4).flatMap((action, index) => {
    const frame = ILLUSTRATED_CARD.actionFrames[index]
    if (frame === undefined) return []
    return [{ frame,
      number: make(`${page.pageId}-illustrated-number-${index}`, String(index + 1).padStart(2, "0"), { x: frame.x + 5, y: frame.y + 15, width: 48, height: 42 }, { ...layout.bodyStyle, fontSize: 27, fontWeight: 800, color: "#176B45", align: "center", lineHeight: 1.2 }, { kind: "template-static", templateVersion: page.templateVersion }),
      action: make(`${page.pageId}-illustrated-action-${index}`, action.replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u, ""), { x: frame.x + 5, y: frame.y + 169, width: 250, height: 116 }, { ...layout.bodyStyle, fontSize: 28, fontWeight: 750, lineHeight: 1.32, align: "center" }, page.body.provenance),
    }]
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 4).flatMap((topic, index) => {
    const frame = ILLUSTRATED_CARD.previewFrames[index]
    return frame === undefined ? [] : [make(topic.id, topic.text, { x: frame.x, y: frame.y + frame.height - 76, width: frame.width, height: 76 }, { ...layout.bodyStyle, fontSize: 27, fontWeight: 750, lineHeight: 1.2, align: "center", color: "#163E3E" }, topic.provenance)]
  }) : page.topicOverview
  return { ...page, editorial: { layoutType: config.layoutType, compositionPreset: "illustrated-ab", season: config.season, studentComposition: config.studentComposition, modules },
    ...(topicOverview === undefined ? {} : { topicOverview }),
    ...(page.badge === undefined ? {} : { badge: make(page.badge.id, page.badge.text, { x: 400, y: 80, width: 400, height: 45 }, { ...page.badge.style, fontSize: 27, color: "#FFFFFF", align: "center" }, page.badge.provenance) }),
    lead: make(`${page.pageId}-illustrated-lead`, config.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), layout.leadFrame, { ...layout.bodyStyle, fontSize: 30, fontWeight: 650, align: "center" }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-illustrated-closing`, config.closing ?? "", layout.closingFrame, { ...layout.bodyStyle, fontSize: 27, fontWeight: 650, color: "#175D3A", align: "center" }, { kind: "design-text", pageId: page.pageId, field: "closing" }, false),
  }
}
