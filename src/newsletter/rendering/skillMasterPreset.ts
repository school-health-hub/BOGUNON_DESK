import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialA4Layout, applyEditorialLayout } from "./editorialState"
import { DesignCardNotFoundError } from "./designState"

export const SKILL_MASTER = {
  cover: { title: { x: 90, y: 130, width: 1020, height: 170 }, lead: { x: 100, y: 315, width: 1000, height: 60 }, image: { x: 80, y: 290, width: 760, height: 590 }, mascot: { x: 800, y: 430, width: 320, height: 450 }, closing: { x: 100, y: 1080, width: 1000, height: 55 } },
  body: { title: { x: 110, y: 155, width: 980, height: 165 }, lead: { x: 110, y: 325, width: 980, height: 65 }, image: { x: 80, y: 420, width: 510, height: 580 }, mascot: { x: 960, y: 990, width: 160, height: 150 }, closing: { x: 100, y: 1065, width: 815, height: 70 } },
} as const

export function applySkillMasterPreset(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly now: string }): NewsletterDesignStateV2 {
  if (input.cardIndex < 1 || input.cardIndex > 6 || !Number.isInteger(input.cardIndex)) throw new DesignCardNotFoundError(input.cardIndex)
  const a4 = applyEditorialA4Layout(design, input)
  const cover = applyEditorialLayout(a4, { cardIndex: 0, layoutType: "A", now: input.now })
  const body = applyEditorialLayout(cover, { ...input, layoutType: "D" })
  const cardLayouts = body.cardLayouts.map((card, index) => {
    if (index !== 0 && index !== input.cardIndex) return card
    const frames = index === 0 ? SKILL_MASTER.cover : SKILL_MASTER.body
    return { ...card, titleFrame: frames.title, leadFrame: frames.lead, closingFrame: frames.closing,
      titleStyle: { ...card.titleStyle, fontSize: index === 0 ? 104 : 88, align: "center" as const },
      image: { ...card.image, frame: frames.image, edgePolicy: "none" as const },
      ...(card.editorial === undefined ? {} : { editorial: { ...card.editorial, moduleImages: undefined, compositionPreset: "september-master" as const } }),
      ...(card.brand === undefined ? {} : { brand: { ...card.brand, previewTopicCount: 4 as const, mascot: { ...card.brand.mascot, frame: frames.mascot, edgePolicy: "none" as const } } }),
    }
  })
  const a4Layout = { ...body.a4Layout, titleFrame: { x: 75, y: 72, width: 880, height: 125 }, publicationMetaFrame: { x: 75, y: 214, width: 880, height: 50 },
    modules: body.a4Layout.modules.map((module, index) => ({ ...module, image: { ...module.image, edgePolicy: index === input.cardIndex - 1 ? "none" as const : "soft" as const } })),
    ...(body.a4Layout.brand === undefined ? {} : { brand: { ...body.a4Layout.brand, compositionPreset: "september-master" as const, mascot: { ...body.a4Layout.brand.mascot, frame: { x: 970, y: 62, width: 195, height: 220 }, edgePolicy: "none" as const } } }),
  }
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: body.canonicalProjectRevision, templateId: body.templateId, templateVersion: body.templateVersion, publicationMeta: body.publicationMeta, assetManifest: body.assetManifest, a4Layout, cardLayouts }
  const revision = body.designRevision + 1
  return parseNewsletterDesignStateV2({ ...body, ...snapshot, designRevision: revision, revisionHistory: [...body.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page", "card-cover", body.cardLayouts[input.cardIndex]?.pageId], snapshotVersion: 2, snapshot }] })
}
