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

export class DesignCardNotFoundError extends Error {
  readonly name = "DesignCardNotFoundError"
  constructor(readonly cardIndex: number) { super(`design card not found: ${cardIndex}`) }
}
export class DesignRevisionNotFoundError extends Error {
  readonly name = "DesignRevisionNotFoundError"
  constructor(readonly revision: number) { super(`design revision not found: ${revision}`) }
}
type CardPatch = { readonly background?: string; readonly titleStyle?: Partial<TextStyle>; readonly bodyStyle?: Partial<TextStyle>; readonly titleFrame?: Partial<CardDesignLayoutV1["titleFrame"]>; readonly bodyFrame?: Partial<CardDesignLayoutV1["bodyFrame"]> }
type UpdateCardInput = { readonly cardIndex: number; readonly patch: CardPatch; readonly now: string }

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
  const cards = design.cardLayouts.map((card, index) => index === input.cardIndex ? { ...card, ...updated } : card)
  const snapshot = snapshotV2(design, cards)
  const revision = design.designRevision + 1
  return parseNewsletterDesignState({ ...design, designRevision: revision, ...snapshot, revisionHistory: [...design.revisionHistory, { revision, createdAt: input.now, changedPageIds: [target.pageId], snapshotVersion: 2, snapshot }] })
}

function topicCard(card: CardDesignLayoutV1, index: number): CardDesignLayoutV2 {
  const cover = index === 0
  return {
    ...card,
    titleFrame: cover ? { x: 72, y: 160, width: 680, height: 240 } : { x: 72, y: 70, width: 1056, height: 150 },
    bodyFrame: cover ? { x: 72, y: 650, width: 1056, height: 320 } : { x: 548, y: 338, width: 580, height: 500 },
    leadFrame: cover ? { x: 72, y: 420, width: 680, height: 90 } : { x: 72, y: 238, width: 1056, height: 72 },
    actionListFrame: cover ? { x: 72, y: 650, width: 1056, height: 320 } : { x: 548, y: 338, width: 580, height: 500 },
    closingFrame: cover ? { x: 72, y: 1010, width: 1056, height: 100 } : { x: 72, y: 890, width: 1056, height: 130 },
    image: { ...card.image, frame: cover ? { x: 760, y: 150, width: 360, height: 460 } : { x: 72, y: 338, width: 440, height: 500 } },
    accent: ["#2f7257", "#2f7257", "#d96a24", "#2469a7", "#7354a5", "#248b94", "#2f7257"][index] ?? "#2f7257",
    listMarkerStyle: "source",
    imageTextColumnRatio: cover ? 0.36 : 0.42,
    coverLayout: cover ? "topics-grid" : "feature-right",
  }
}

function upgradeSnapshotV2(source: DesignSnapshotV1): DesignSnapshotV2 {
  const modules = source.a4Layout.modules.map((module, index) => ({
    ...module,
    titleFrame: { x: module.frame.x + 20, y: module.frame.y + 18, width: module.frame.width - 40, height: 48 },
    leadFrame: { x: module.frame.x + 212, y: module.frame.y + 76, width: 300, height: 42 },
    actionListFrame: { x: module.frame.x + 212, y: module.frame.y + 126, width: 300, height: 146 },
    closingFrame: { x: module.frame.x + 20, y: module.frame.y + 292, width: module.frame.width - 40, height: 50 },
    image: { ...module.image, frame: { x: module.frame.x + 20, y: module.frame.y + 76, width: 172, height: 196 } },
    accent: ["#2f7257", "#d96a24", "#2469a7", "#7354a5", "#248b94", "#2f7257"][index] ?? "#2f7257",
    listMarkerStyle: "source" as const,
    imageTextColumnRatio: 0.36,
  }))
  const snapshot: DesignSnapshotV2 = {
    designSchemaVersion: 2,
    canonicalProjectRevision: source.canonicalProjectRevision,
    templateId: source.templateId,
    templateVersion: source.templateVersion + 1,
    publicationMeta: source.publicationMeta,
    a4Layout: { ...source.a4Layout, titleFrame: { x: 59, y: 59, width: 1122, height: 110 }, publicationMetaFrame: { x: 59, y: 185, width: 1122, height: 48 }, modules },
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
