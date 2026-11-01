import { parseNewsletterDesignStateV2, type CardDesignLayoutV2, type NewsletterDesignStateV2 } from "./designSchema"
import { DesignCardNotFoundError } from "./designState"
import type { Frame } from "./renderDocument"
import { officialCoverRecipe, officialEducationRecipe } from "./officialTemplateRecipes"
import { clearChangedOfficialMasks, officialTemplateSchema } from "./officialTemplateSchema"

export function reviseOfficialComposition(design: NewsletterDesignStateV2, cardLayouts: readonly CardDesignLayoutV2[], changedPageIds: readonly string[], now: string): NewsletterDesignStateV2 {
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, assetManifest: design.assetManifest, a4Layout: design.a4Layout, cardLayouts }
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...design, ...snapshot, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: now, changedPageIds, snapshotVersion: 2, snapshot }] })
}
export function applyOfficialTemplate(design: NewsletterDesignStateV2, input: { readonly cardIndices: readonly number[]; readonly now: string }): NewsletterDesignStateV2 {
  const indices = new Set(input.cardIndices)
  for (const index of indices) if (!Number.isInteger(index) || design.cardLayouts[index] === undefined) throw new DesignCardNotFoundError(index)
  const cards = design.cardLayouts.map((card, index) => {
    if (!indices.has(index)) return card
    const officialTemplate = index === 0 ? officialCoverRecipe(card, design.assetManifest) : officialEducationRecipe()
    const sourceImages = [0, 1, 2, 3].map(moduleIndex => {
      const source = card.editorial?.moduleImages?.[moduleIndex]
      const element = officialTemplate.elements.find(value => value.kind === "image" && value.binding === `module-${moduleIndex}`)
      return source ?? { slotId: `official-${index}-source-${moduleIndex}`, frame: element?.frame ?? { x: 0, y: 0, width: 1, height: 1 }, fit: "contain" as const }
    })
    const editorial = { ...card.editorial, layoutType: card.editorial?.layoutType ?? (index === 0 ? "A" as const : "B" as const), studentComposition: card.editorial?.studentComposition ?? "mixed" as const, season: card.editorial?.season ?? "autumn" as const, moduleImages: sourceImages }
    return { ...card, officialTemplate, editorial }
  })
  return reviseOfficialComposition(design, cards, cards.filter((_, index) => indices.has(index)).map(card => card.pageId), input.now)
}
export function updateOfficialElementFrame(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly elementId: string; readonly patch: Partial<Frame>; readonly fit?: "contain" | "cover"; readonly assetId?: string; readonly visible?: boolean; readonly maskEnabled?: boolean; readonly style?: Partial<CardDesignLayoutV2["titleStyle"]>; readonly now: string }): NewsletterDesignStateV2 {
  const card = design.cardLayouts[input.cardIndex]
  if (card?.officialTemplate === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const template = officialTemplateSchema.parse({ ...card.officialTemplate, elements: card.officialTemplate.elements.map(element => element.id === input.elementId ? { ...element, frame: { ...element.frame, ...input.patch }, ...(element.kind === "image" ? { ...(input.assetId === undefined ? {} : { assetId: input.assetId }), ...(input.visible === undefined ? {} : { visible: input.visible }), ...(input.fit === undefined ? {} : { fit: input.fit }), ...(input.maskEnabled === undefined ? {} : { maskEnabled: input.maskEnabled }) } : {}), ...(element.kind === "text" && input.style !== undefined ? { style: { ...element.style, ...input.style } } : {}) } : element) })
  const cleared = clearChangedOfficialMasks({ ...card, officialTemplate: template }, design.assetManifest)
  return reviseOfficialComposition(design, design.cardLayouts.map((value, index) => index === input.cardIndex ? { ...value, officialTemplate: cleared } : value), [card.pageId], input.now)
}
export function removeOfficialTemplate(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly now: string }): NewsletterDesignStateV2 {
  const card = design.cardLayouts[input.cardIndex]
  if (card === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const { officialTemplate: removedTemplate, ...legacy } = card
  void removedTemplate
  return reviseOfficialComposition(design, design.cardLayouts.map((value, index) => index === input.cardIndex ? legacy : value), [card.pageId], input.now)
}
export function updateOfficialTemplateClosing(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly text: string; readonly now: string }): NewsletterDesignStateV2 {
  const card = design.cardLayouts[input.cardIndex]
  if (card?.officialTemplate === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const template = officialTemplateSchema.parse({ ...card.officialTemplate, closingText: input.text })
  return reviseOfficialComposition(design, design.cardLayouts.map((value, index) => index === input.cardIndex ? { ...value, officialTemplate: template } : value), [card.pageId], input.now)
}
