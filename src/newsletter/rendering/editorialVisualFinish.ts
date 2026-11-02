import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "./designSchema"
import { DesignCardNotFoundError } from "./designState"
import type { Frame } from "./renderDocument"
import { EditorialLayoutError, type EditorialLayoutType } from "./editorialLayout"

export const VISUAL_FINISH = {
  previews: Array.from({ length: 4 }, (_, index) => ({ x: 78 + index * 267, y: 365, width: 243, height: 200 })),
  panels: Array.from({ length: 4 }, (_, index) => ({ x: 72 + (index % 2) * 544, y: 365 + Math.floor(index / 2) * 345, width: 512, height: 325 })),
  stories: Array.from({ length: 4 }, (_, index) => ({ x: 610 + (index % 2) * 265, y: 380 + Math.floor(index / 2) * 325, width: 245, height: 310 })),
} as const

export function visualFinishImageFrames(type: EditorialLayoutType): readonly Frame[] {
  const frames = type === "A" ? VISUAL_FINISH.previews : type === "B" ? VISUAL_FINISH.panels : VISUAL_FINISH.stories
  return frames.map(frame => type === "A" ? { x: frame.x + 38, y: frame.y + 75, width: 167, height: 115 } : type === "B" ? { x: frame.x + 20, y: frame.y + 90, width: 472, height: 225 } : { x: frame.x + 2, y: frame.y + 5, width: 240, height: 180 })
}

export function applyEditorialVisualFinish(design: NewsletterDesignStateV2, input: { readonly cardIndices: readonly number[]; readonly now: string }): NewsletterDesignStateV2 {
  const indices = new Set(input.cardIndices)
  for (const index of indices) {
    const card = design.cardLayouts[index]
    if (card === undefined || !Number.isInteger(index)) throw new DesignCardNotFoundError(index)
    if (card.editorial === undefined || card.editorial.layoutType === "D") throw new EditorialLayoutError("시각 마감은 기존 TYPE A/B/C 카드에 적용합니다.")
  }
  const cardLayouts = design.cardLayouts.map((card, index) => {
    if (!indices.has(index) || card.editorial === undefined) return card
    const type = card.editorial.layoutType
    const frames = visualFinishImageFrames(type)
    const moduleImages = card.editorial.moduleImages?.map((image, i) => {
      const frame = frames[i]
      if (frame === undefined) return image
      return { ...image, fit: "contain" as const, edgePolicy: "none" as const, frame }
    })
    return { ...card, officialTemplate: undefined, editorial: { ...card.editorial, foregroundMask: undefined, referenceLayout: undefined, visualFinish: true as const, ...(moduleImages === undefined ? {} : { moduleImages }) },
      ...(type === "A" ? { image: { ...card.image, frame: { x: 70, y: 500, width: 1060, height: 550 }, fit: "cover" as const, edgePolicy: "feather" as const }, closingFrame: { x: 80, y: 1080, width: 860, height: 55 }, ...(card.brand === undefined ? {} : { brand: { ...card.brand, mascot: { ...card.brand.mascot, frame: { x: 990, y: 970, width: 140, height: 160 }, edgePolicy: "none" as const } } }) } : {}),
      ...(type === "C" ? { image: { ...card.image, frame: { x: 72, y: 390, width: 500, height: 640 }, fit: "contain" as const, edgePolicy: "none" as const } } : {}),
    }
  })
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, assetManifest: design.assetManifest, a4Layout: design.a4Layout, cardLayouts }
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...design, ...snapshot, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: cardLayouts.filter((_, index) => indices.has(index)).map(card => card.pageId), snapshotVersion: 2, snapshot }] })
}
