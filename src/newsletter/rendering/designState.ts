import {
  parseNewsletterDesignState,
  parseNewsletterDesignStateV2,
  type CardDesignLayoutV1,
  type CardDesignLayoutV2,
  type DesignSnapshotV1,
  type DesignSnapshotV2,
  type NewsletterDesignState,
  type NewsletterDesignStateV1,
  type NewsletterDesignStateV2,
  type TextStyle,
} from "./designSchema"
import { a4ModuleRatio, a4ModuleVariant, cardRatio, cardVariant, coverLayoutFrames, NEWSLETTER_ACCENTS, type NewsletterLayoutVariant } from "./layoutVariants"

export class DesignCardNotFoundError extends Error {
  readonly name = "DesignCardNotFoundError"
  constructor(readonly cardIndex: number) { super(`design card not found: ${cardIndex}`) }
}
export class DesignRevisionNotFoundError extends Error {
  readonly name = "DesignRevisionNotFoundError"
  constructor(readonly revision: number) { super(`design revision not found: ${revision}`) }
}
export class DesignV2RequiredError extends Error {
  readonly name = "DesignV2RequiredError"
  constructor() { super("Newsletter DesignState V2 is required for structured layout editing") }
}
export type CardLayoutPatch = {
  readonly background?: string
  readonly accent?: string
  readonly listMarkerStyle?: CardDesignLayoutV2["listMarkerStyle"]
  readonly imageTextColumnRatio?: number
  readonly coverLayout?: CardDesignLayoutV2["coverLayout"]
  readonly titleStyle?: Partial<TextStyle>
  readonly bodyStyle?: Partial<TextStyle>
  readonly titleFrame?: Partial<CardDesignLayoutV1["titleFrame"]>
  readonly bodyFrame?: Partial<CardDesignLayoutV1["bodyFrame"]>
  readonly leadFrame?: Partial<CardDesignLayoutV2["leadFrame"]>
  readonly actionListFrame?: Partial<CardDesignLayoutV2["actionListFrame"]>
  readonly closingFrame?: Partial<CardDesignLayoutV2["closingFrame"]>
  readonly image?: { readonly frame?: Partial<CardDesignLayoutV2["image"]["frame"]>; readonly fit?: CardDesignLayoutV2["image"]["fit"] }
}
export type A4ModuleLayoutPatch = {
  readonly accent?: string
  readonly listMarkerStyle?: NewsletterDesignStateV2["a4Layout"]["modules"][number]["listMarkerStyle"]
  readonly imageTextColumnRatio?: number
  readonly titleFrame?: Partial<NewsletterDesignStateV2["a4Layout"]["modules"][number]["titleFrame"]>
  readonly leadFrame?: Partial<NewsletterDesignStateV2["a4Layout"]["modules"][number]["leadFrame"]>
  readonly actionListFrame?: Partial<NewsletterDesignStateV2["a4Layout"]["modules"][number]["actionListFrame"]>
  readonly closingFrame?: Partial<NewsletterDesignStateV2["a4Layout"]["modules"][number]["closingFrame"]>
  readonly image?: { readonly frame?: Partial<NewsletterDesignStateV2["a4Layout"]["modules"][number]["image"]["frame"]>; readonly fit?: NewsletterDesignStateV2["a4Layout"]["modules"][number]["image"]["fit"] }
}
type UpdateCardInput = { readonly cardIndex: number; readonly patch: CardLayoutPatch; readonly now: string }

function snapshotV1(design: NewsletterDesignStateV1, cardLayouts: readonly CardDesignLayoutV1[]): DesignSnapshotV1 {
  return { canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout: design.a4Layout, cardLayouts, assetManifest: design.assetManifest }
}
function snapshotV2(design: NewsletterDesignStateV2, cardLayouts: readonly CardDesignLayoutV2[]): DesignSnapshotV2 {
  return { designSchemaVersion: 2, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout: design.a4Layout, cardLayouts, assetManifest: design.assetManifest }
}

export function updateCardLayout(design: NewsletterDesignState, input: UpdateCardInput): NewsletterDesignState {
  const target = design.cardLayouts[input.cardIndex]
  if (target === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const updated = { ...target, ...(input.patch.background === undefined ? {} : { background: input.patch.background }), titleFrame: { ...target.titleFrame, ...input.patch.titleFrame }, bodyFrame: { ...target.bodyFrame, ...input.patch.bodyFrame }, titleStyle: { ...target.titleStyle, ...input.patch.titleStyle }, bodyStyle: { ...target.bodyStyle, ...input.patch.bodyStyle } }
  if (design.designSchemaVersion === 1) {
    const cards = design.cardLayouts.map((card, index) => index === input.cardIndex ? updated : card)
    const snapshot = snapshotV1(design, cards)
    const revision = design.designRevision + 1
    return parseNewsletterDesignState({ ...design, designRevision: revision, ...snapshot, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: [target.pageId], snapshot }] })
  }
  const structured = target as CardDesignLayoutV2
  const cards = design.cardLayouts.map((card, index) => index === input.cardIndex ? {
    ...card,
    ...updated,
    ...(input.patch.accent === undefined ? {} : { accent: input.patch.accent }),
    ...(input.patch.listMarkerStyle === undefined ? {} : { listMarkerStyle: input.patch.listMarkerStyle }),
    ...(input.patch.imageTextColumnRatio === undefined ? {} : { imageTextColumnRatio: input.patch.imageTextColumnRatio }),
    ...(input.patch.coverLayout === undefined ? {} : { coverLayout: input.patch.coverLayout }),
    leadFrame: { ...structured.leadFrame, ...input.patch.leadFrame },
    actionListFrame: { ...structured.actionListFrame, ...input.patch.actionListFrame },
    closingFrame: { ...structured.closingFrame, ...input.patch.closingFrame },
    image: { ...structured.image, ...input.patch.image, frame: { ...structured.image.frame, ...input.patch.image?.frame } },
  } : card)
  const snapshot = snapshotV2(design, cards)
  const revision = design.designRevision + 1
  return parseNewsletterDesignState({ ...design, designRevision: revision, ...snapshot, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: [target.pageId], snapshotVersion: 2, snapshot }] })
}

export function updateA4ModuleLayout(design: NewsletterDesignState, input: { readonly moduleIndex: number; readonly patch: A4ModuleLayoutPatch; readonly now: string }): NewsletterDesignStateV2 {
  if (design.designSchemaVersion !== 2) throw new DesignV2RequiredError()
  const target = design.a4Layout.modules[input.moduleIndex]
  if (target === undefined) throw new DesignCardNotFoundError(input.moduleIndex)
  const modules = design.a4Layout.modules.map((module, index) => index === input.moduleIndex ? {
    ...module,
    ...(input.patch.accent === undefined ? {} : { accent: input.patch.accent }),
    ...(input.patch.listMarkerStyle === undefined ? {} : { listMarkerStyle: input.patch.listMarkerStyle }),
    ...(input.patch.imageTextColumnRatio === undefined ? {} : { imageTextColumnRatio: input.patch.imageTextColumnRatio }),
    titleFrame: { ...module.titleFrame, ...input.patch.titleFrame },
    leadFrame: { ...module.leadFrame, ...input.patch.leadFrame },
    actionListFrame: { ...module.actionListFrame, ...input.patch.actionListFrame },
    closingFrame: { ...module.closingFrame, ...input.patch.closingFrame },
    image: { ...module.image, ...input.patch.image, frame: { ...module.image.frame, ...input.patch.image?.frame } },
  } : module)
  const next = { ...design, a4Layout: { ...design.a4Layout, modules } }
  const snapshot = snapshotV2(next, next.cardLayouts)
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({ ...next, designRevision: revision, ...snapshot, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page"], snapshotVersion: 2, snapshot }] })
}

export function applyCardLayoutVariant(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly variant: NewsletterLayoutVariant; readonly now: string }): NewsletterDesignStateV2 {
  const card = design.cardLayouts[input.cardIndex]
  if (card === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const preset = cardVariant(input.cardIndex, input.variant)
  return updateCardLayout(design, { cardIndex: input.cardIndex, now: input.now, patch: { leadFrame: preset.leadFrame, actionListFrame: preset.actionListFrame, closingFrame: preset.closingFrame, imageTextColumnRatio: preset.imageTextColumnRatio, image: { frame: preset.imageFrame } } }) as NewsletterDesignStateV2
}

export function applyCoverLayout(design: NewsletterDesignStateV2, input: { readonly layout: CardDesignLayoutV2["coverLayout"]; readonly now: string }): NewsletterDesignStateV2 {
  const preset = coverLayoutFrames(input.layout)
  return updateCardLayout(design, { cardIndex: 0, now: input.now, patch: { coverLayout: input.layout, titleFrame: preset.titleFrame, actionListFrame: preset.topicsFrame, image: { frame: preset.imageFrame } } }) as NewsletterDesignStateV2
}

export function applyA4LayoutVariant(design: NewsletterDesignStateV2, input: { readonly moduleIndex: number; readonly variant: NewsletterLayoutVariant; readonly now: string }): NewsletterDesignStateV2 {
  const module = design.a4Layout.modules[input.moduleIndex]
  if (module === undefined) throw new DesignCardNotFoundError(input.moduleIndex)
  const preset = a4ModuleVariant(module.frame, input.variant)
  return updateA4ModuleLayout(design, { moduleIndex: input.moduleIndex, now: input.now, patch: { titleFrame: preset.titleFrame, leadFrame: preset.leadFrame, actionListFrame: preset.actionListFrame, closingFrame: preset.closingFrame, imageTextColumnRatio: preset.imageTextColumnRatio, image: { frame: preset.imageFrame } } })
}

export function applyCardImageTextRatio(design: NewsletterDesignStateV2, input: { readonly cardIndex: number; readonly ratio: number; readonly now: string }): NewsletterDesignStateV2 {
  const card = design.cardLayouts[input.cardIndex]
  if (card === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const preset = cardRatio(input.cardIndex, input.ratio)
  return updateCardLayout(design, { cardIndex: input.cardIndex, now: input.now, patch: { leadFrame: preset.leadFrame, actionListFrame: preset.actionListFrame, closingFrame: preset.closingFrame, imageTextColumnRatio: preset.imageTextColumnRatio, image: { frame: preset.imageFrame } } }) as NewsletterDesignStateV2
}

export function applyA4ImageTextRatio(design: NewsletterDesignStateV2, input: { readonly moduleIndex: number; readonly ratio: number; readonly now: string }): NewsletterDesignStateV2 {
  const module = design.a4Layout.modules[input.moduleIndex]
  if (module === undefined) throw new DesignCardNotFoundError(input.moduleIndex)
  const preset = a4ModuleRatio(module.frame, input.ratio)
  return updateA4ModuleLayout(design, { moduleIndex: input.moduleIndex, now: input.now, patch: { titleFrame: preset.titleFrame, leadFrame: preset.leadFrame, actionListFrame: preset.actionListFrame, closingFrame: preset.closingFrame, imageTextColumnRatio: preset.imageTextColumnRatio, image: { frame: preset.imageFrame } } })
}

function topicCard(card: CardDesignLayoutV1, index: number): CardDesignLayoutV2 {
  const cover = index === 0
  const base: CardDesignLayoutV2 = {
    ...card,
    titleFrame: cover ? { x: 72, y: 160, width: 680, height: 240 } : { x: 72, y: 130, width: 1056, height: 150 },
    bodyFrame: cover ? { x: 72, y: 650, width: 1056, height: 320 } : { x: 548, y: 338, width: 580, height: 500 },
    leadFrame: cover ? { x: 72, y: 420, width: 680, height: 90 } : { x: 72, y: 238, width: 1056, height: 72 },
    actionListFrame: cover ? { x: 72, y: 650, width: 1056, height: 320 } : { x: 548, y: 338, width: 580, height: 500 },
    closingFrame: cover ? { x: 72, y: 1010, width: 1056, height: 100 } : { x: 72, y: 890, width: 1056, height: 130 },
    image: { ...card.image, frame: cover ? { x: 760, y: 150, width: 360, height: 460 } : { x: 72, y: 338, width: 440, height: 500 } },
    accent: index === 0 ? NEWSLETTER_ACCENTS[0] : NEWSLETTER_ACCENTS[index - 1] ?? NEWSLETTER_ACCENTS[0],
    listMarkerStyle: "source",
    imageTextColumnRatio: cover ? 0.36 : 0.42,
    coverLayout: cover ? "topics-grid" : "feature-right",
    brand: cover ? {
      mascot: { slotId: "cover-mascot", frame: { x: 710, y: 170, width: 418, height: 570 }, fit: "contain" },
      seasonalDecoration: { slotId: "cover-seasonal-decoration", frame: { x: 860, y: 64, width: 268, height: 130 }, fit: "contain" },
      previewTopicCount: 4,
    } : {
      mascot: { slotId: `topic-mascot-${index}`, frame: { x: 920, y: 820, width: 208, height: 270 }, fit: "contain" },
      seasonalDecoration: { slotId: `topic-seasonal-decoration-${index}`, frame: { x: 72, y: 64, width: 220, height: 120 }, fit: "contain" },
    },
  }
  const preset = cardVariant(index, "balanced")
  const coverPreset = coverLayoutFrames(base.coverLayout)
  return { ...base, titleFrame: cover ? coverPreset.titleFrame : base.titleFrame, actionListFrame: cover ? coverPreset.topicsFrame : preset.actionListFrame, leadFrame: preset.leadFrame, closingFrame: preset.closingFrame, imageTextColumnRatio: preset.imageTextColumnRatio, image: { ...base.image, frame: cover ? { x: 790, y: 548, width: 300, height: 170 } : preset.imageFrame } }
}

function upgradeSnapshotV2(source: DesignSnapshotV1): DesignSnapshotV2 {
  const modules = source.a4Layout.modules.map((module, index) => {
    const preset = a4ModuleVariant(module.frame, "balanced")
    return { ...module, titleFrame: preset.titleFrame, leadFrame: preset.leadFrame, actionListFrame: preset.actionListFrame, closingFrame: preset.closingFrame, image: { ...module.image, frame: preset.imageFrame }, accent: NEWSLETTER_ACCENTS[index] ?? NEWSLETTER_ACCENTS[0], listMarkerStyle: "source" as const, imageTextColumnRatio: preset.imageTextColumnRatio }
  })
  const snapshot: DesignSnapshotV2 = {
    designSchemaVersion: 2,
    canonicalProjectRevision: source.canonicalProjectRevision,
    templateId: source.templateId,
    templateVersion: source.templateVersion + 1,
    publicationMeta: source.publicationMeta,
    a4Layout: {
      ...source.a4Layout,
      titleFrame: { x: 210, y: 76, width: 650, height: 104 },
      publicationMetaFrame: { x: 210, y: 198, width: 650, height: 44 },
      footerFrame: { x: 59, y: 1608, width: 1122, height: 68 },
      modules,
      brand: {
        mascot: { slotId: "a4-header-mascot", frame: { x: 890, y: 60, width: 250, height: 228 }, fit: "contain" },
        seasonalDecoration: { slotId: "a4-seasonal-decoration", frame: { x: 60, y: 60, width: 190, height: 136 }, fit: "contain" },
        utilityFrame: { x: 59, y: 1524, width: 548, height: 60 },
        closingFrame: { x: 625, y: 1524, width: 556, height: 60 },
      },
    },
    cardLayouts: source.cardLayouts.map(topicCard),
    assetManifest: source.assetManifest,
  }
  return snapshot
}

export function upgradeNewsletterDesignStateV2(design: NewsletterDesignStateV1, now: string): NewsletterDesignStateV2 {
  const source = snapshotV1(design, design.cardLayouts)
  const snapshot = upgradeSnapshotV2(source)
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({
    projectId: design.projectId,
    designRevision: revision,
    ...snapshot,
    revisionHistory: [
      ...design.revisionHistory.map((entry) => ({ ...entry, snapshotVersion: 1 as const })),
      { revision, createdAt: now, changedPageIds: ["a4-page", ...snapshot.cardLayouts.map((card) => card.pageId)], snapshotVersion: 2, snapshot },
    ],
  })
}

export function restoreDesignRevision(design: NewsletterDesignState, input: { readonly revision: number; readonly now: string }): NewsletterDesignState {
  if (design.designSchemaVersion === 1) {
    const source = design.revisionHistory.find((entry) => entry.revision === input.revision)
    if (source === undefined) throw new DesignRevisionNotFoundError(input.revision)
    const revision = design.designRevision + 1
    return parseNewsletterDesignState({ ...design, designRevision: revision, ...structuredClone(source.snapshot), revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page", ...source.snapshot.cardLayouts.map((card) => card.pageId)], restoredFromRevision: source.revision, snapshot: structuredClone(source.snapshot) }] })
  }
  const source = design.revisionHistory.find((entry) => entry.revision === input.revision)
  if (source === undefined) throw new DesignRevisionNotFoundError(input.revision)
  const snapshot = source.snapshotVersion === 1 ? upgradeSnapshotV2(source.snapshot) : structuredClone(source.snapshot)
  const revision = design.designRevision + 1
  return parseNewsletterDesignState({ ...design, designRevision: revision, ...snapshot, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: ["a4-page", ...snapshot.cardLayouts.map((card) => card.pageId)], restoredFromRevision: source.revision, snapshotVersion: 2, snapshot }] })
}
