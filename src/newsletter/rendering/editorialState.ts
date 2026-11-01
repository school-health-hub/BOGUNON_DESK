import { parseNewsletterDesignStateV2, type CardDesignLayoutV2, type DesignSnapshotV2, type NewsletterDesignStateV2 } from "./designSchema"
import { DesignCardNotFoundError, DesignV2RequiredError, updateCardLayout } from "./designState"
import { editorialFrames, EditorialLayoutError, type EditorialLayoutType } from "./editorialLayout"
import type { Frame } from "./renderDocument"
function snapshotV2(design: NewsletterDesignStateV2, cardLayouts: readonly CardDesignLayoutV2[]): DesignSnapshotV2 {
  return { designSchemaVersion: 2, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout: design.a4Layout, cardLayouts, assetManifest: design.assetManifest }
}
export function applyEditorialLayout(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly layoutType: EditorialLayoutType; readonly now: string }): NewsletterDesignStateV2 {
  const card = design.cardLayouts[input.cardIndex]
  if (card === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  if ((input.cardIndex === 0) !== (input.layoutType === "A")) throw new EditorialLayoutError("TYPE A는 표지에, TYPE B/C/D는 주제 카드에 적용합니다.")
  const frames = editorialFrames(input.layoutType)
  const changed = updateCardLayout(design, { cardIndex: input.cardIndex, now: input.now, patch: { background: "#FFFCF5", editorial: { ...card.editorial, compositionPreset: undefined, layoutType: input.layoutType, studentComposition: card.editorial?.studentComposition ?? "mixed", season: card.editorial?.season ?? "autumn", ...(card.editorial?.moduleImages === undefined ? {} : { moduleImages: card.editorial.moduleImages.map((image, i) => ({ ...image, frame: frames.moduleImageFrames[i] ?? image.frame })) }) }, titleFrame: frames.titleFrame, leadFrame: frames.leadFrame, actionListFrame: frames.actionListFrame, closingFrame: frames.closingFrame, image: { frame: frames.imageFrame }, titleStyle: { fontSize: input.layoutType === "A" ? 106 : 84, lineHeight: 1.08, color: "#0D254D", fontWeight: 850, align: "left" }, bodyStyle: { fontSize: 30, lineHeight: 1.35 }, brand: { mascot: { frame: frames.mascotFrame } } } })
  if (changed.designSchemaVersion !== 2) throw new DesignV2RequiredError()
  return changed
}

export function updateA4MascotFrame(design: NewsletterDesignStateV2, input: { readonly mascotFrame: Partial<Frame>; readonly now: string }): NewsletterDesignStateV2 {
  const brand = design.a4Layout.brand
  if (brand === undefined) throw new EditorialLayoutError("A4 캐릭터 프레임이 없습니다.")
  const a4Layout = { ...design.a4Layout, brand: { ...brand, mascot: { ...brand.mascot, frame: { ...brand.mascot.frame, ...input.mascotFrame } } } }
  const next = { ...design, a4Layout }
  const snapshot = snapshotV2(next, next.cardLayouts)
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...next, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page"], snapshotVersion: 2, snapshot }] })
}

export function applyEditorialA4Layout(design: NewsletterDesignStateV2, input: { readonly now: string }): NewsletterDesignStateV2 {
  const brand = design.a4Layout.brand
  if (brand === undefined) throw new EditorialLayoutError("A4 브랜드 구성이 없습니다.")
  const modules = design.a4Layout.modules.map((module, i) => {
    const frame = { x: 59 + (i % 2) * 566, y: 300 + Math.floor(i / 2) * 390, width: 532, height: 370 }
    return { ...module, frame, titleFrame: { x: frame.x + 58, y: frame.y + 14, width: 438, height: 44 }, leadFrame: { x: frame.x + 18, y: frame.y + 65, width: 496, height: 34 }, actionListFrame: { x: frame.x + 210, y: frame.y + 108, width: 304, height: 221 }, closingFrame: { x: frame.x + 18, y: frame.y + 337, width: 496, height: 26 }, image: { ...module.image, frame: { x: frame.x + 18, y: frame.y + 108, width: 174, height: 212 } } }
  })
  const next = { ...design, a4Layout: { ...design.a4Layout, modules, footerFrame: { x: 59, y: 1610, width: 1122, height: 80 }, brand: { ...brand, compositionPreset: undefined, editorialLayout: true as const, utilityFrame: { x: 75, y: 1480, width: 516, height: 101 }, closingFrame: { x: 641, y: 1480, width: 524, height: 101 } } } }
  const snapshot = snapshotV2(next, next.cardLayouts)
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...next, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page"], snapshotVersion: 2, snapshot }] })
}

export function updateA4EditorialCopy(design: NewsletterDesignStateV2, input: { readonly patch: { readonly utilityText?: string; readonly closingText?: string; readonly sourceText?: string }; readonly now: string }): NewsletterDesignStateV2 {
  const brand = design.a4Layout.brand
  if (brand === undefined) throw new EditorialLayoutError("A4 브랜드 구성이 없습니다.")
  const next = { ...design, a4Layout: { ...design.a4Layout, brand: { ...brand, ...input.patch } } }
  const snapshot = snapshotV2(next, next.cardLayouts)
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...next, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page"], snapshotVersion: 2, snapshot }] })
}
