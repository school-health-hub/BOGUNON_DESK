import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { StructuredSectionText } from "./contentStructure"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import { REFERENCE_LAYOUT } from "./referenceLayout"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
const prefix = /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u
export function compileReferenceLayout(page: RenderPage, layout: CardDesignLayoutV2, content: StructuredSectionText, make: Make): RenderPage {
  const config = layout.editorial
  if (config === undefined) return page
  const cover = config.layoutType === "A"
  const panel = config.layoutType === "B"
  const frames = cover ? REFERENCE_LAYOUT.previews : panel ? REFERENCE_LAYOUT.panels : REFERENCE_LAYOUT.stories
  const actions = content.kind === "list" ? content.actions : []
  const modules = cover ? [] : actions.slice(0, 4).flatMap((source, index) => {
    const frame = frames[index]
    if (frame === undefined) return []
    const action = source.replace(prefix, "")
    const actionFrame = panel ? { x: frame.x + 82, y: frame.y + 18, width: frame.width - 100, height: 86 } : { x: 105, y: 365 + index * 64, width: 495, height: 60 }
    const image = config.moduleImages?.[index]
    return [{ frame,
      action: make(`${page.pageId}-reference-action-${index}`, action, actionFrame, { ...layout.bodyStyle, fontSize: panel ? 33 : 26, fontWeight: panel ? 800 : 650, lineHeight: 1.25 }, page.body.provenance),
      number: make(`${page.pageId}-reference-number-${index}`, String(index + 1).padStart(2, "0"), panel ? { x: frame.x + 15, y: frame.y + 22, width: 50, height: 42 } : { x: 68, y: 370 + index * 64, width: 34, height: 30 }, { ...layout.bodyStyle, fontSize: panel ? 29 : 22, fontWeight: 800, color: panel ? "#FFFFFF" : layout.accent, align: "center", lineHeight: 1.2 }, { kind: "template-static", templateVersion: page.templateVersion }),
      ...(!panel ? { caption: make(`${page.pageId}-reference-caption-${index}`, action, { x: frame.x + 12, y: frame.y + 12, width: frame.width - 24, height: 105 }, { ...layout.bodyStyle, fontSize: 25, fontWeight: 650, lineHeight: 1.25, align: "center" }, page.body.provenance) } : {}),
      ...(image === undefined ? {} : { image }),
    }]
  })
  const topicOverview = cover ? page.topicOverview?.slice(0, 4).flatMap((topic, index) => {
    const frame = frames[index]
    return frame === undefined ? [] : [make(topic.id, topic.text, { x: frame.x + 12, y: frame.y + 12, width: frame.width - 24, height: 65 }, { ...layout.bodyStyle, fontSize: 25, fontWeight: 800, lineHeight: 1.2, align: "center" }, topic.provenance)]
  }) : page.topicOverview
  return { ...page,
    title: { ...page.title, frame: { ...page.title.frame, height: Math.min(page.title.frame.height, page.title.lines.length * page.title.style.fontSize * page.title.style.lineHeight) } },
    editorial: { layoutType: config.layoutType, referenceLayout: true, ...(config.foregroundMask === undefined ? {} : { foregroundMask: config.foregroundMask }), season: config.season, studentComposition: config.studentComposition, modules, ...(cover && config.moduleImages !== undefined ? { previewImages: config.moduleImages } : {}) },
    ...(topicOverview === undefined ? {} : { topicOverview }),
    lead: make(`${page.pageId}-reference-lead`, config.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), layout.leadFrame, { ...layout.bodyStyle, fontSize: cover ? 32 : 29, fontWeight: 650, align: "center", color: layout.accent }, config.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-reference-closing`, config.closing ?? "", layout.closingFrame, { ...layout.bodyStyle, fontSize: 28, fontWeight: 750, color: "#175D3A", align: "center" }, { kind: "design-text", pageId: page.pageId, field: "closing" }, false),
  }
}
