import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout } from "./editorialState"
import { DesignCardNotFoundError } from "./designState"
import { SEPTEMBER_INNER_TEMPLATE } from "./skillMasterCardDesign"

export const SKILL_MASTER = {
  cover: { title: { x: 90, y: 130, width: 1020, height: 170 }, lead: { x: 100, y: 315, width: 1000, height: 60 }, image: { x: 80, y: 290, width: 760, height: 590 }, mascot: { x: 800, y: 430, width: 320, height: 450 }, closing: { x: 100, y: 1080, width: 1000, height: 55 } },
  body: { title: SEPTEMBER_INNER_TEMPLATE.title, lead: SEPTEMBER_INNER_TEMPLATE.lead, image: SEPTEMBER_INNER_TEMPLATE.image, mascot: SEPTEMBER_INNER_TEMPLATE.mascot, closing: SEPTEMBER_INNER_TEMPLATE.closing },
} as const

export function applySkillMasterPreset(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly now: string }): NewsletterDesignStateV2 {
  if (input.cardIndex < 1 || input.cardIndex > 6 || !Number.isInteger(input.cardIndex)) throw new DesignCardNotFoundError(input.cardIndex)
  const cover = applyEditorialLayout(design, { cardIndex: 0, layoutType: "A", now: input.now })
  const body = applyEditorialLayout(cover, { ...input, layoutType: "D" })
  const cardLayouts = body.cardLayouts.map((card, index) => {
    if (index !== 0 && index !== input.cardIndex) return card
    const frames = index === 0 ? SKILL_MASTER.cover : SKILL_MASTER.body
    return { ...card, titleFrame: frames.title, leadFrame: frames.lead, closingFrame: frames.closing,
      titleStyle: { ...card.titleStyle, fontSize: index === 0 ? 72 : 56, align: "center" as const },
      ...(index === 0 ? { actionListFrame: { x: 90, y: 875, width: 1010, height: 190 } } : {}),
      image: { ...card.image, frame: frames.image, edgePolicy: "none" as const },
      ...(card.editorial === undefined ? {} : { editorial: { ...card.editorial, foregroundMask: undefined, referenceLayout: undefined, visualFinish: undefined,
        moduleImages: index === 0 ? undefined : SEPTEMBER_INNER_TEMPLATE.miniArt.map((frame, moduleIndex) => ({ slotId: `module-${moduleIndex}`, frame, fit: "contain" as const, visible: false })),
        compositionPreset: "september-master" as const } }),
      ...(card.brand === undefined ? {} : { brand: { ...card.brand, previewTopicCount: 4 as const, mascot: { ...card.brand.mascot, frame: frames.mascot, edgePolicy: "none" as const } } }),
    }
  })
  const a4Layout = body.a4Layout
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: body.canonicalProjectRevision, templateId: body.templateId, templateVersion: body.templateVersion, publicationMeta: body.publicationMeta, assetManifest: body.assetManifest, a4Layout, cardLayouts }
  const revision = body.designRevision + 1
  return parseNewsletterDesignStateV2({ ...body, ...snapshot, designRevision: revision, revisionHistory: [...body.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["card-cover", body.cardLayouts[input.cardIndex]?.pageId], snapshotVersion: 2, snapshot }] })
}
