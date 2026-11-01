import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { Frame, RenderPage, RenderTextBlock, TextProvenance } from "./renderDocument"
import type { StructuredSectionText } from "./contentStructure"
import type { SceneLayer } from "./renderScene"
import type { OfficialElement, OfficialTextBinding } from "./officialTemplateSchema"
import { illustratedActionScene } from "./illustratedActionScene"
import { officialElementSourceImage } from "./officialTemplateSchema"

type Make = (id: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, required?: boolean) => RenderTextBlock
type Copy = { readonly text: string; readonly provenance: TextProvenance }
const bounds = { x: 0, y: 0, width: 1200, height: 1200 }
const paths = {
  brush: "M1 4Q5 2 9 3L21 2L24 5L23 18Q17 21 12 20L1 22L0 18Z",
  underline: "M1 11Q8 14 13 10T23 11 M3 18Q12 15 21 17",
  arrow: "M2 3Q2 16 19 20M15 14L20 20L14 23",
  spark: "M12 1L14 9L23 12L14 14L12 23L10 14L1 12L10 9Z",
  season: "M12 1L15 8L22 4L18 12L24 15L16 17L16 23L11 19L4 23L6 16L0 12L8 10L5 3L11 7Z",
  speech: "M2 3Q10 0 22 3L23 17Q17 21 12 19L7 24L8 19Q1 21 1 16Z",
} as const
export function compileOfficialTemplate(page: RenderPage, layout: CardDesignLayoutV2, content: StructuredSectionText, make: Make, unavailable: (message: string) => void): RenderPage {
  const template = layout.officialTemplate
  if (template === undefined) return page
  const actions = content.kind === "list" ? content.actions.map(value => value.replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u, "")) : []
  if (template.kind !== "cover" && actions.length !== 4) unavailable(`공식 교육형에는 원고의 행동 수칙 4개가 필요합니다. 현재 ${actions.length}개입니다.`)
  const closingText = template.closingText ?? layout.editorial?.closing ?? ""
  const titleParts = /^(\d{1,2}월)\s*(.*)$/u.exec(page.title.text)
  function copy(binding: OfficialTextBinding): Copy {
    switch (binding) {
      case "title": return page.title
      case "month": return { text: titleParts?.[1] ?? "", provenance: page.title.provenance }
      case "title-rest": return { text: titleParts?.[2] ?? page.title.text, provenance: page.title.provenance }
      case "lead": return { text: layout.editorial?.slogan ?? (content.kind === "list" ? content.lead ?? "" : ""), provenance: layout.editorial?.slogan === undefined ? page.body.provenance : { kind: "design-text", pageId: page.pageId, field: "slogan" } }
      case "closing": return { text: closingText, provenance: { kind: "design-text", pageId: page.pageId, field: "closing" } }
      case "issue": return page.badge ?? { text: "", provenance: { kind: "publication-meta" } }
      case "preview-0": case "preview-1": case "preview-2": case "preview-3": return page.topicOverview?.[Number(binding.slice(-1))] ?? { text: "", provenance: { kind: "project-title" } }
      case "number-0": case "number-1": case "number-2": case "number-3": return { text: String(Number(binding.slice(-1)) + 1).padStart(2, "0"), provenance: { kind: "template-static", templateVersion: page.templateVersion } }
      case "emphasis-0": case "emphasis-1": case "emphasis-2": case "emphasis-3": return { text: /\d+\s*(?:초|분|시간)/u.exec(actions[Number(binding.slice(-1))] ?? "")?.[0] ?? "", provenance: page.body.provenance }
      case "action-0": case "action-1": case "action-2": case "action-3": return { text: actions[Number(binding.slice(-1))] ?? "", provenance: page.body.provenance }
    }
  }
  function compile(element: OfficialElement): readonly SceneLayer[] {
    const id = `${page.pageId}-official-${element.id}`
    switch (element.kind) {
      case "text": {
        const source = copy(element.binding)
        const block = make(id, source.text, element.frame, element.style, source.provenance, false)
        return source.text.length === 0 ? [] : [{ ...block, kind: "text", layerId: id, zOrder: element.zOrder, clipBounds: bounds, collisionGroup: `${page.pageId}-official-text` }]
      }
      case "image": {
        if (element.visible === false) return []
        if (element.maskedOnly === true && (element.mask === undefined || element.maskEnabled === false)) return []
        const source = officialElementSourceImage(layout, element)
        if (source?.assetId === undefined) {
          unavailable(`${element.label}: 승인 삽화 연결이 필요합니다.`)
          return []
        }
        return [{ kind: "image", layerId: id, slotId: `official-${element.id}`, assetId: source.assetId, frame: element.frame, fit: element.fit, edgePolicy: element.edgePolicy, zOrder: element.zOrder, clipBounds: bounds, placeholderKind: "generic", ...(element.mask === undefined || element.maskEnabled === false ? {} : { clipPolygon: element.mask }) }]
      }
      case "ornament": {
        if (element.graphic === "source-prop") {
          const source = element.binding === undefined ? "" : copy(element.binding).text
          return illustratedActionScene(id, source, element.frame, bounds).filter(layer => !layer.layerId.endsWith("-organic-field")).map((layer, index) => ({ ...layer, ...(layer.kind === "path" && layer.layerId.endsWith("-scarf") ? { path: "M3 5Q12 0 21 5L19 11Q12 14 5 10Z M6 10L11 11L9 23L3 21Z M14 12L19 10L23 20L17 23Z" } : {}), ...(layer.kind === "path" && layer.layerId.endsWith("-weave") && /추위|목도리|보온/u.test(source) ? { path: "M5 6Q12 3 20 6M6 14L10 15M5 18L9 19M16 15L20 14M18 19L22 17M4 22L3 24M7 23V24M18 22L19 24M21 21L23 23" } : {}), zOrder: element.zOrder + index / 100 }))
        }
        return [{ kind: "path", layerId: id, frame: element.frame, path: paths[element.graphic], fill: element.fill ?? (element.graphic === "season" || element.graphic === "spark" ? element.color : "none"), stroke: element.graphic === "brush" ? "none" : element.color, strokeWidth: element.graphic === "underline" || element.graphic === "arrow" ? 1.3 : .4, zOrder: element.zOrder, clipBounds: bounds }]
      }
    }
  }
  return { ...page, officialLayers: [{ kind: "shape", layerId: `${page.pageId}-official-paper`, frame: bounds, fill: page.background, zOrder: 0, clipBounds: bounds }, ...template.elements.flatMap(compile)] }
}
