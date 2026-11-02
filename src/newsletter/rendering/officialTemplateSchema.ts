import { z } from "zod"

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/)
const frame = z.object({ x: z.number().min(0).max(1200), y: z.number().min(0).max(1200), width: z.number().positive().max(1200), height: z.number().positive().max(1200) }).readonly().superRefine((value, context) => {
  if (value.x + value.width > 1200 || value.y + value.height > 1200) context.addIssue({ code: "custom", message: "official element must remain inside the card" })
})
const style = z.object({ fontFamily: z.literal("Pretendard"), fontSize: z.number().positive().max(200), fontWeight: z.number().int().min(100).max(900), lineHeight: z.number().min(1).max(2), color, align: z.enum(["left", "center", "right"]) }).readonly()
const mask = z.object({ assetId: id, sha256: z.string().regex(/^[a-f0-9]{64}$/), sourceWidth: z.number().int().positive().max(20000), sourceHeight: z.number().int().positive().max(20000), points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).readonly()).min(3).max(64).readonly() }).readonly()
const textBinding = z.enum(["title", "month", "title-rest", "lead", "closing", "issue", "preview-0", "preview-1", "preview-2", "preview-3", "action-0", "action-1", "action-2", "action-3", "number-0", "number-1", "number-2", "number-3", "emphasis-0", "emphasis-1", "emphasis-2", "emphasis-3"])
const imageBinding = z.enum(["main", "mascot", "decoration", "module-0", "module-1", "module-2", "module-3"])
const base = { id, label: z.string().min(1).max(80), frame, zOrder: z.number().int().min(0).max(100) } as const
const textElement = z.object({ ...base, kind: z.literal("text"), binding: textBinding, style }).readonly()
const imageElement = z.object({ ...base, kind: z.literal("image"), assetId: id.optional(), visible: z.boolean().optional(), maskedOnly: z.literal(true).optional(), maskEnabled: z.boolean().optional(), binding: imageBinding, fit: z.enum(["contain", "cover"]), edgePolicy: z.enum(["rounded", "none", "soft", "feather"]), mask: mask.optional() }).readonly()
const ornamentElement = z.object({ ...base, kind: z.literal("ornament"), graphic: z.enum(["brush", "underline", "arrow", "spark", "season", "source-prop", "speech"]), binding: textBinding.optional(), color, fill: color.optional() }).readonly()
export const officialTemplateElementSchema = z.discriminatedUnion("kind", [textElement, imageElement, ornamentElement])
export const officialTemplateSchema = z.object({ version: z.literal(1), kind: z.enum(["cover", "education", "story"]), closingText: z.string().max(1000).optional(), previewTopicIndices: z.array(z.number().int().min(0).max(5)).length(4).readonly().optional(), elements: z.array(officialTemplateElementSchema).min(1).max(100).readonly() }).readonly().superRefine((template, context) => {
  const ids = template.elements.map(element => element.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "official element IDs must be unique" })
  const bindings = template.elements.flatMap(element => element.kind === "text" ? [element.binding] : [])
  const titlePresent = bindings.includes("title") || (bindings.includes("month") && bindings.includes("title-rest"))
  if (!titlePresent) context.addIssue({ code: "custom", message: "official template requires an editable title" })
  if (template.kind !== "cover" && ["action-0", "action-1", "action-2", "action-3"].some(binding => !bindings.some(candidate => candidate === binding))) context.addIssue({ code: "custom", message: "official education requires four editable source actions" })
})
export type OfficialTemplate = z.infer<typeof officialTemplateSchema>
export type OfficialElement = z.infer<typeof officialTemplateElementSchema>
export type OfficialTextBinding = z.infer<typeof textBinding>
export type OfficialImageBinding = z.infer<typeof imageBinding>
export type OfficialImageElement = Extract<OfficialElement, { readonly kind: "image" }>
type BoundImage = { readonly assetId?: string }
export type OfficialSourceCard = { readonly image: BoundImage; readonly brand?: { readonly mascot: BoundImage; readonly seasonalDecoration?: BoundImage }; readonly editorial?: { readonly moduleImages?: readonly BoundImage[] }; readonly officialTemplate?: OfficialTemplate }
export function officialSourceImage(card: OfficialSourceCard, binding: OfficialImageBinding): BoundImage | undefined {
  switch (binding) {
    case "main": return card.image
    case "mascot": return card.brand?.mascot
    case "decoration": return card.brand?.seasonalDecoration
    case "module-0": return card.editorial?.moduleImages?.[0]
    case "module-1": return card.editorial?.moduleImages?.[1]
    case "module-2": return card.editorial?.moduleImages?.[2]
    case "module-3": return card.editorial?.moduleImages?.[3]
  }
}
export function officialElementSourceImage(card: OfficialSourceCard, element: OfficialImageElement): BoundImage | undefined {
  return element.assetId === undefined ? officialSourceImage(card, element.binding) : { assetId: element.assetId }
}
export function validateOfficialTemplate(card: OfficialSourceCard, index: number, assets: readonly { readonly id: string; readonly sha256: string }[], issue: (message: string) => void): void {
  const template = card.officialTemplate
  if (template === undefined) return
  if ((index === 0) !== (template.kind === "cover")) issue("official cover is available only on the first card")
  for (const element of template.elements) {
    if (element.kind !== "image") continue
    if (element.assetId !== undefined && !assets.some(asset => asset.id === element.assetId)) issue("official image asset must exist in the manifest")
    if (element.mask === undefined) continue
    const source = officialElementSourceImage(card, element)
    if (source?.assetId !== element.mask.assetId || assets.find(asset => asset.id === source.assetId)?.sha256 !== element.mask.sha256) issue("official image mask must match its bound asset ID and SHA")
  }
}
export function clearChangedOfficialMasks(card: OfficialSourceCard, assets: readonly { readonly id: string; readonly sha256: string }[]): OfficialTemplate | undefined {
  if (card.officialTemplate === undefined) return undefined
  return { ...card.officialTemplate, elements: card.officialTemplate.elements.map(element => {
    if (element.kind !== "image" || element.mask === undefined) return element
    const source = officialElementSourceImage(card, element)
    if (source?.assetId === element.mask.assetId && assets.find(asset => asset.id === source.assetId)?.sha256 === element.mask.sha256) return element
    const { mask: removedMask, ...rest } = element
    void removedMask
    return rest
  }) }
}
