import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "./designSchema"
import { DesignCardNotFoundError } from "./designState"
import { EditorialLayoutError, type EditorialLayoutType } from "./editorialLayout"
import type { Frame } from "./renderDocument"
import type { ImagePolygon } from "./imagePolygon"

// Manually traced composition profile for the existing school hero; not recovered alpha.
const heroSha = "6ed886bfb2ccc5894d6c757acbca77fd3caa2dfb22b81125741e2f2e45b628af"
const heroForeground = [{ x: 0, y: 1 }, { x: .08, y: .80 }, { x: .14, y: .70 }, { x: .18, y: .66 }, { x: .19, y: .60 }, { x: .195, y: .575 }, { x: .198, y: .505 }, { x: .218, y: .445 }, { x: .24, y: .408 }, { x: .27, y: .392 }, { x: .30, y: .405 }, { x: .335, y: .445 }, { x: .352, y: .49 }, { x: .354, y: .55 }, { x: .365, y: .60 }, { x: .40, y: .69 }, { x: .42, y: .62 }, { x: .43, y: .57 }, { x: .455, y: .52 }, { x: .49, y: .48 }, { x: .53, y: .46 }, { x: .57, y: .49 }, { x: .61, y: .55 }, { x: .63, y: .62 }, { x: .65, y: .69 }, { x: .68, y: .64 }, { x: .70, y: .58 }, { x: .72, y: .49 }, { x: .74, y: .45 }, { x: .77, y: .44 }, { x: .80, y: .48 }, { x: .82, y: .53 }, { x: .84, y: .60 }, { x: .86, y: .70 }, { x: .92, y: .80 }, { x: 1, y: 1 }] as const satisfies ImagePolygon["points"]

export const REFERENCE_LAYOUT = {
  previews: [{ x: 75, y: 490, width: 240, height: 220 }, { x: 355, y: 400, width: 240, height: 220 }, { x: 655, y: 425, width: 240, height: 220 }, { x: 925, y: 540, width: 200, height: 220 }],
  panels: [{ x: 60, y: 320, width: 560, height: 365 }, { x: 635, y: 320, width: 505, height: 365 }, { x: 60, y: 700, width: 560, height: 350 }, { x: 635, y: 700, width: 505, height: 350 }],
  stories: [{ x: 640, y: 330, width: 240, height: 330 }, { x: 895, y: 330, width: 245, height: 330 }, { x: 640, y: 680, width: 240, height: 335 }, { x: 895, y: 680, width: 245, height: 335 }],
} as const

export function referenceImageFrames(type: EditorialLayoutType): readonly Frame[] {
  switch (type) {
    case "A": return REFERENCE_LAYOUT.previews.map(frame => ({ x: frame.x + 24, y: frame.y + 66, width: frame.width - 48, height: frame.height - 72 }))
    case "B": return [{ x: 235, y: 425, width: 365, height: 245 }, { x: 650, y: 445, width: 470, height: 225 }, { x: 230, y: 790, width: 370, height: 245 }, { x: 650, y: 825, width: 470, height: 210 }]
    case "C": return REFERENCE_LAYOUT.stories.map(frame => ({ x: frame.x + 4, y: frame.y + 90, width: frame.width - 8, height: frame.height - 96 }))
    case "D": return []
  }
}

export function applyReferenceLayout(design: NewsletterDesignStateV2, input: { readonly cardIndices: readonly number[]; readonly now: string }): NewsletterDesignStateV2 {
  const indices = new Set(input.cardIndices)
  for (const index of indices) {
    const card = design.cardLayouts[index]
    if (card === undefined || !Number.isInteger(index)) throw new DesignCardNotFoundError(index)
    if (card.editorial === undefined || card.editorial.layoutType === "D") throw new EditorialLayoutError("참고 구성은 기존 TYPE A/B/C 카드에 적용합니다.")
  }
  const cardLayouts = design.cardLayouts.map((card, index) => {
    if (!indices.has(index) || card.editorial === undefined) return card
    const type = card.editorial.layoutType
    const frames = referenceImageFrames(type)
    const moduleImages = card.editorial.moduleImages?.map((image, i) => ({ ...image, frame: frames[i] ?? image.frame, fit: "contain" as const, edgePolicy: "none" as const }))
    const cover = type === "A"
    const mascotFrame = cover ? { x: 935, y: 920, width: 205, height: 220 } : type === "C" ? { x: 140, y: 950, width: 185, height: 190 } : { x: 1000, y: 140, width: 140, height: 160 }
    const heroAsset = design.assetManifest.find(asset => asset.id === card.image.assetId)
    const foregroundMask = cover && heroAsset?.sha256 === heroSha ? { assetId: heroAsset.id, sha256: heroAsset.sha256, sourceWidth: 1536, sourceHeight: 1024, points: heroForeground } : undefined
    return { ...card, officialTemplate: undefined, editorial: { ...card.editorial, foregroundMask, referenceLayout: true as const, visualFinish: undefined, compositionPreset: undefined, ...(moduleImages === undefined ? {} : { moduleImages }) },
      titleFrame: cover ? { x: 90, y: 95, width: 1020, height: 150 } : { x: 110, y: 96, width: 870, height: 115 },
      titleStyle: { ...card.titleStyle, fontSize: cover ? 116 : 82, lineHeight: 1.08, align: "center" as const },
      leadFrame: cover ? { x: 185, y: 270, width: 830, height: 75 } : { x: 100, y: 230, width: 880, height: 60 },
      closingFrame: cover ? { x: 180, y: 1090, width: 725, height: 50 } : type === "C" ? { x: 350, y: 1060, width: 720, height: 80 } : { x: 150, y: 1085, width: 900, height: 55 },
      ...(cover ? { image: { ...card.image, frame: { x: 60, y: 390, width: 1080, height: 685 }, fit: "cover" as const, edgePolicy: "feather" as const } } : type === "C" ? { image: { ...card.image, frame: { x: 65, y: 635, width: 550, height: 380 }, fit: "contain" as const, edgePolicy: "none" as const } } : {}),
      ...(card.brand === undefined ? {} : { brand: { ...card.brand, mascot: { ...card.brand.mascot, frame: mascotFrame, edgePolicy: "none" as const, fit: "contain" as const } } }),
    }
  })
  const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, assetManifest: design.assetManifest, a4Layout: design.a4Layout, cardLayouts }
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...design, ...snapshot, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: cardLayouts.filter((_, index) => indices.has(index)).map(card => card.pageId), snapshotVersion: 2, snapshot }] })
}
