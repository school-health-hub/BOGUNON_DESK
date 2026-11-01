import { compileIllustratedCard } from "./illustratedCardCompiler"
import { compileSkillMaster } from "./skillMasterCompiler"
import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { Frame, RenderImage, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import type { StructuredSectionText } from "./contentStructure"
import { editorialFrames, type EditorialLayout } from "./editorialLayout"

export type EditorialModule = { readonly frame: Frame; readonly action: RenderTextBlock; readonly number: RenderTextBlock; readonly image?: RenderImage }
export type RenderEditorial = { readonly compositionPreset?: "september-master" | "illustrated-ab"; readonly layoutType: EditorialLayout["layoutType"]; readonly season: EditorialLayout["season"]; readonly studentComposition: EditorialLayout["studentComposition"]; readonly modules: readonly EditorialModule[]; readonly previewImages?: readonly RenderImage[] }
type MakeBlock = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
type Input = { readonly page: RenderPage; readonly layout: CardDesignLayoutV2; readonly content: StructuredSectionText; readonly make: MakeBlock; readonly unavailable: (message: string) => void }
const prefix = /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u

export function compileEditorialCard({ page, layout, content, make, unavailable }: Input): RenderPage {
  const config = layout.editorial
  if (config === undefined) return page
  if (config.layoutType === "A" && page.image.assetId === undefined) unavailable("선택한 학생 구성에 맞는 표지 대표 장면을 선택해 주세요.")
  const frames = editorialFrames(config.layoutType)
  const provenance = page.body.provenance
  const actions = content.kind === "list" ? content.actions : []
  if (config.layoutType !== "A" && actions.length !== 4) unavailable(`TYPE ${config.layoutType}에는 원고의 실천 항목이 정확히 4개 필요합니다. 현재 ${actions.length}개입니다.`)
  if (config.compositionPreset === "illustrated-ab") return compileIllustratedCard(page, layout, content, make)
  if (config.compositionPreset === "september-master") return compileSkillMaster(page, layout, content, make)
  const modules = config.layoutType === "A" ? [] : actions.slice(0, 4).flatMap((action, i): readonly EditorialModule[] => {
    const frame = frames.moduleFrames[i]
    if (frame === undefined) return []
    const sourceImage = config.moduleImages?.[i]
    const fallback = config.layoutType === "B" && i === 0 && sourceImage?.assetId === undefined && page.image.assetId !== undefined ? { ...page.image, frame: page.image.frame } : undefined
    const image = sourceImage?.assetId === undefined ? fallback : sourceImage
    const isStory = config.layoutType === "C"
    const isService = config.layoutType === "D"
    const firstScene = config.layoutType === "B" && i === 0 && image !== undefined
    const fontSize = isStory ? 27 : isService || firstScene ? 30 : 32
    const actionFrame = firstScene ? { x: frame.x + 285, y: frame.y + 65, width: 205, height: 240 } : isStory ? { x: frame.x + 22, y: frame.y + 70, width: frame.width - 44, height: image === undefined ? 150 : 108 } : isService ? { x: frame.x + (image === undefined ? 160 : 78), y: frame.y + 20, width: image === undefined ? frame.width - 182 : 295, height: 120 } : { x: frame.x + 84, y: frame.y + 22, width: frame.width - 110, height: 126 }
    return [{ frame, action: make(`${page.pageId}-editorial-action-${i + 1}`, action.replace(prefix, ""), actionFrame, { ...layout.bodyStyle, fontSize, fontWeight: 750, lineHeight: 1.32 }, provenance), number: make(`${page.pageId}-editorial-number-${i + 1}`, String(i + 1).padStart(2, "0"), { x: frame.x + 20, y: frame.y + 20, width: 48, height: 42 }, { ...layout.bodyStyle, fontSize: 28, fontWeight: 800, color: "#ffffff", align: "center", lineHeight: 1.2 }, { kind: "template-static", templateVersion: page.templateVersion }), ...(image === undefined ? {} : { image }) }]
  })
  const tagline = config.slogan ?? (content.kind === "list" ? content.lead ?? "" : "")
  const leadFrame = config.layoutType === "A" || layout.leadFrame.y !== frames.leadFrame.y ? layout.leadFrame : { ...layout.leadFrame, y: page.title.lines.length === 1 ? frames.leadFrame.y : 305 }
  const topicOverview = config.layoutType === "A" ? (page.topicOverview ?? []).flatMap((topic, i) => {
    const frame = frames.moduleFrames[i]
    return frame === undefined ? [] : [make(topic.id, topic.text, { x: frame.x + 82, y: frame.y + 12, width: frame.width - 94, height: 82 }, { ...layout.bodyStyle, fontSize: 24, fontWeight: 750, lineHeight: 1.15, color: "#0D254D" }, topic.provenance)]
  }) : page.topicOverview
  return {
    ...page,
    title: { ...page.title, frame: { ...page.title.frame, height: Math.min(page.title.frame.height, page.title.lines.length * page.title.style.fontSize * page.title.style.lineHeight) } },
    editorial: { layoutType: config.layoutType, season: config.season, studentComposition: config.studentComposition, modules },
    ...(topicOverview === undefined ? {} : { topicOverview }),
    lead: make(`${page.pageId}-editorial-lead`, tagline, leadFrame, { ...layout.bodyStyle, color: layout.accent, fontWeight: 650 }, config.slogan === undefined ? provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" }, false),
    closing: make(`${page.pageId}-editorial-closing`, config.closing ?? "", layout.closingFrame, { ...layout.bodyStyle, fontSize: 26, fontWeight: 650, color: "#175D3A", align: "center" }, { kind: "design-text", pageId: page.pageId, field: "closing" }, false),
  }
}
