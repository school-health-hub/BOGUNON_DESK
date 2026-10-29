import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout } from "./editorialState"
import { DesignCardNotFoundError } from "./designState"
import { ILLUSTRATED_CARD } from "./illustratedCardLayout"

export function applyIllustratedCardPreset(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly now: string }): NewsletterDesignStateV2 {
  if (!Number.isInteger(input.cardIndex) || input.cardIndex < 1 || input.cardIndex > 6) throw new DesignCardNotFoundError(input.cardIndex)
  const cover = applyEditorialLayout(design, { cardIndex: 0, layoutType: "A", now: input.now })
  const body = applyEditorialLayout(cover, { ...input, layoutType: "B" })
  const cardLayouts = body.cardLayouts.map((card, index) => {
    if (index !== 0 && index !== input.cardIndex) return card
    const frames = index === 0 ? ILLUSTRATED_CARD.cover : ILLUSTRATED_CARD.body
    return { ...card, titleFrame: frames.title, leadFrame: frames.lead, closingFrame: frames.closing,
      titleStyle: { ...card.titleStyle, fontSize: index === 0 ? 108 : 88, align: "center" as const },
      image: { ...card.image, frame: frames.image, edgePolicy: "none" as const },
      ...(card.editorial === undefined ? {} : { editorial: { ...card.editorial, season: design.cardLayouts[0]?.editorial?.season ?? "none", moduleImages: undefined, compositionPreset: "illustrated-ab" as const } }),
      ...(card.brand === undefined ? {} : { brand: { ...card.brand, previewTopicCount: 4 as const, mascot: { ...card.brand.mascot, frame: frames.mascot, edgePolicy: "none" as const } } }),
    }
  })
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: body.canonicalProjectRevision, templateId: body.templateId, templateVersion: body.templateVersion, publicationMeta: body.publicationMeta, assetManifest: body.assetManifest, a4Layout: design.a4Layout, cardLayouts }
  const revision = body.designRevision + 1
  return parseNewsletterDesignStateV2({ ...body, ...snapshot, designRevision: revision, revisionHistory: [...body.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["card-cover", body.cardLayouts[input.cardIndex]?.pageId], snapshotVersion: 2, snapshot }] })
}
