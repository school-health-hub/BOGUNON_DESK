import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import { VISUAL_FINISH } from "./editorialVisualFinish"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
export function compileVisualFinish(page: RenderPage, layout: CardDesignLayoutV2, content: StructuredSectionText, make: Make): RenderPage {
  const config = layout.editorial
  if (config === undefined) return page
  const cover = config.layoutType === "A"
  const panel = config.layoutType === "B"
  const frames = cover ? VISUAL_FINISH.previews : panel ? VISUAL_FINISH.panels : VISUAL_FINISH.stories
  const actions = content.kind === "list" ? content.actions : []
  const modules = cover ? [] : actions.slice(0, 4).flatMap((action, index) => {
    const frame = frames[index]
    if (frame === undefined) return []
    const image = config.moduleImages?.[index]
    return [{ frame,
      number: make(`${page.pageId}-finish-number-${index}`, String(index + 1).padStart(2, "0"), { x: frame.x + 12, y: frame.y + (panel ? 17 : 10), width: 48, height: 42 }, { ...layout.bodyStyle, fontSize: 27, fontWeight: 800, color: panel ? "#FFFFFF" : layout.accent, align: "center", lineHeight: 1.2 }, { kind: "template-static", templateVersion: page.templateVersion }),
      action: make(`${page.pageId}-finish-action-${index}`, action.replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u, ""), panel ? { x: frame.x + 80, y: frame.y + 16, width: 414, height: 74 } : { x: frame.x + 8, y: frame.y + 193, width: 229, height: 113 }, { ...layout.bodyStyle, fontSize: panel ? 30 : 27, fontWeight: 750, lineHeight: 1.2, align: panel ? "left" : "center" }, page.body.provenance),
      ...(image?.assetId === undefined ? {} : { image }),
    }]
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 4).flatMap((topic, index) => {
    const frame = frames[index]
    return frame === undefined ? [] : [make(topic.id, topic.text, { x: frame.x + 10, y: frame.y + 8, width: frame.width - 20, height: 66 }, { ...layout.bodyStyle, fontSize: 25, fontWeight: 750, lineHeight: 1.2, align: "center", color: "#173D40" }, topic.provenance)]
  }) : page.topicOverview
  return { ...page, title: { ...page.title, frame: { ...page.title.frame, height: Math.min(page.title.frame.height, page.title.lines.length * page.title.style.fontSize * page.title.style.lineHeight) } }, editorial: { layoutType: config.layoutType, visualFinish: true, season: config.season, studentComposition: config.studentComposition, modules, ...(cover && config.moduleImages !== undefined ? { previewImages: config.moduleImages } : {}) },
    ...(topicOverview === undefined ? {} : { topicOverview }),
    lead: make(`${page.pageId}-finish-lead`, config.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), layout.leadFrame, { ...layout.bodyStyle, fontSize: 30, fontWeight: 650, align: cover ? "center" : "left", color: layout.accent }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-finish-closing`, config.closing ?? "", layout.closingFrame, { ...layout.bodyStyle, fontSize: 26, fontWeight: 650, color: "#175D3A", align: "center" }, { kind: "design-text", pageId: page.pageId, field: "closing" }, false),
  }
}
